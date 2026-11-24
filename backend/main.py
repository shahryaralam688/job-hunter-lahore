from contextlib import asynccontextmanager
from typing import Any, Dict, Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

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
from models import JobStatusUpdate, PipelineRunRequest, SettingsPayload

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
