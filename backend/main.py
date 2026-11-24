from contextlib import asynccontextmanager
from typing import Any, Dict, Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from agents.cv_analyzer_agent import analyze_cv_standalone
from agents.pipeline_manager import pipeline_manager
from auth import is_supabase_auth_configured, require_user, verify_supabase_token
from config import CORS_ORIGINS, DEFAULT_SYSTEM_PROMPTS, GEMINI_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
from database import (
    clear_mock_jobs,
    get_settings,
    init_db,
    list_jobs,
    list_recent_logs,
    list_runs,
    update_job_status,
    update_settings,
)
from models import CVAnalyzeRequest, CVCleanRequest, JobStatusUpdate, PipelineRunRequest, SettingsPayload

scheduler = AsyncIOScheduler(timezone="Asia/Karachi")
SCHEDULE_JOB_ID = "daily_job_hunter_pkt"


async def _scheduled_run() -> None:
    await pipeline_manager.start_pipeline()


def _sync_scheduler(enabled: bool) -> Optional[str]:
    existing = scheduler.get_job(SCHEDULE_JOB_ID)
    if enabled:
        if not existing:
            scheduler.add_job(
                _scheduled_run,
                CronTrigger(hour=9, minute=0, timezone="Asia/Karachi"),
                id=SCHEDULE_JOB_ID,
                replace_existing=True,
            )
        job = scheduler.get_job(SCHEDULE_JOB_ID)
        return job.next_run_time.isoformat() if job and job.next_run_time else None
    else:
        if existing:
            scheduler.remove_job(SCHEDULE_JOB_ID)
        return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    scheduler.start()
    settings = get_settings()
    _sync_scheduler(bool(settings.get("auto_schedule_enabled", False)))
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="Job Hunter Lahore API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "gemini_configured": bool(GEMINI_API_KEY and GEMINI_API_KEY != "your_gemini_api_key_here"),
        "telegram_configured": bool(TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID),
        "supabase_auth_configured": is_supabase_auth_configured(),
    }


@app.get("/api/pipeline/status", dependencies=[Depends(require_user)])
async def get_pipeline_status() -> Dict[str, Any]:
    snap = pipeline_manager.get_snapshot()
    job = scheduler.get_job(SCHEDULE_JOB_ID)
    snap["next_scheduled_run"] = job.next_run_time.isoformat() if job and job.next_run_time else None
    return snap


@app.post("/api/pipeline/run", dependencies=[Depends(require_user)])
async def run_pipeline(body: Optional[PipelineRunRequest] = None) -> Dict[str, Any]:
    mock_override = body.mock_mode if body else None
    return await pipeline_manager.start_pipeline(mock_mode_override=mock_override)


@app.post("/api/pipeline/stop", dependencies=[Depends(require_user)])
async def stop_pipeline() -> Dict[str, Any]:
    return await pipeline_manager.stop_pipeline()


@app.get("/api/logs", dependencies=[Depends(require_user)])
async def get_logs(limit: int = 120) -> Dict[str, Any]:
    return {"logs": list_recent_logs(limit=limit)}


@app.get("/api/jobs", dependencies=[Depends(require_user)])
async def get_jobs(shortlisted_only: bool = True) -> Dict[str, Any]:
    return {"jobs": list_jobs(shortlisted_only=shortlisted_only)}


@app.patch("/api/jobs/{job_id}/status", dependencies=[Depends(require_user)])
async def patch_job_status(job_id: int, body: JobStatusUpdate) -> Dict[str, Any]:
    updated = update_job_status(job_id, body.status.value)
    if not updated:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"job": updated}


@app.post("/api/jobs/reset-mock", dependencies=[Depends(require_user)])
async def reset_mock_data() -> Dict[str, Any]:
    deleted = clear_mock_jobs()
    return {"deleted": deleted}


@app.get("/api/runs", dependencies=[Depends(require_user)])
async def get_runs(limit: int = 50) -> Dict[str, Any]:
    return {"runs": list_runs(limit=limit)}


@app.get("/api/settings", dependencies=[Depends(require_user)])
async def read_settings() -> Dict[str, Any]:
    settings = get_settings()
    job = scheduler.get_job(SCHEDULE_JOB_ID)
    return {
        "settings": settings,
        "next_scheduled_run": job.next_run_time.isoformat() if job and job.next_run_time else None,
        "gemini_configured": bool(GEMINI_API_KEY and GEMINI_API_KEY != "your_gemini_api_key_here"),
        "telegram_configured": bool(TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID),
    }


@app.put("/api/settings", dependencies=[Depends(require_user)])
async def save_settings(payload: SettingsPayload) -> Dict[str, Any]:
    updated = update_settings(payload.model_dump())
    next_run = _sync_scheduler(bool(updated.get("auto_schedule_enabled", False)))
    return {"settings": updated, "next_scheduled_run": next_run}


@app.post("/api/settings/reset-prompts", dependencies=[Depends(require_user)])
async def reset_prompts() -> Dict[str, Any]:
    updated = update_settings({"prompts": DEFAULT_SYSTEM_PROMPTS})
    return {"settings": updated}


@app.post("/api/cv/analyze", dependencies=[Depends(require_user)])
async def analyze_cv(body: Optional[CVAnalyzeRequest] = None) -> Dict[str, Any]:
    settings = get_settings()
    cv_text = (body.cv_text if body and body.cv_text is not None else settings.get("cv_text", ""))
    keywords = (body.keywords if body and body.keywords is not None else settings.get("keywords", []))
    mock_mode = (body.mock_mode if body and body.mock_mode is not None else bool(settings.get("mock_mode", True)))
    prompt_override = settings.get("prompts", {}).get("cv_analyzer", "")
    analysis = await analyze_cv_standalone(
        cv_text=cv_text,
        user_keywords=keywords,
        prompt_override=prompt_override,
        mock_mode=mock_mode,
    )
    return {"analysis": analysis}


@app.post("/api/cv/clean", dependencies=[Depends(require_user)])
async def clean_cv_text(body: CVCleanRequest) -> Dict[str, Any]:
    import asyncio
    import re
    from google import genai
    from google.genai import types

    normalized = re.sub(r"[ \t]{2,}", " ", re.sub(r"\n{3,}", "\n\n", body.raw_text.replace("\r\n", "\n"))).strip()[:15000]
    if not normalized:
        return {"cleaned_text": "", "used_llm": False}

    use_mock = bool(body.mock_mode)
    if not use_mock and GEMINI_API_KEY and GEMINI_API_KEY != "your_gemini_api_key_here":
        try:
            client = genai.Client(api_key=GEMINI_API_KEY, http_options=types.HttpOptions(timeout=12000))
            cfg = types.GenerateContentConfig(
                system_instruction=(
                    "You are a concise CV text cleaner. Reformat raw extracted CV text into clean, readable "
                    "plain text sections (Name/Contact, Summary, Skills, Experience, Education). "
                    "Do NOT invent or remove any facts. Return plain text only."
                ),
                temperature=0.1,
            )
            resp = await asyncio.wait_for(
                asyncio.to_thread(
                    client.models.generate_content,
                    model="gemini-2.5-flash-lite",
                    contents=normalized[:12000],
                    config=cfg,
                ),
                timeout=14.0,
            )
            if resp and resp.text and len(resp.text.strip()) >= 30:
                cleaned = re.sub(r"\n{3,}", "\n\n", resp.text.replace("\r\n", "\n")).strip()[:15000]
                return {"cleaned_text": cleaned, "used_llm": True}
        except Exception:
            pass

    return {"cleaned_text": normalized, "used_llm": False}


@app.websocket("/ws/pipeline")
async def pipeline_ws(websocket: WebSocket) -> None:
    if is_supabase_auth_configured():
        token = websocket.query_params.get("token", "").strip()
        user = await verify_supabase_token(token) if token else None
        if not user:
            await websocket.close(code=4401)
            return

    await pipeline_manager.subscribe(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pipeline_manager.unsubscribe(websocket)
    except Exception:
        pipeline_manager.unsubscribe(websocket)
