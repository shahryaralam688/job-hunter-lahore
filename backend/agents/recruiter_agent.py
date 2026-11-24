import asyncio
import json
from typing import Any, Dict, List

from pydantic import BaseModel

from agents.base import BaseAgent
from agents.llm_helper import generate_with_fallback
from config import DEFAULT_SYSTEM_PROMPTS, GEMINI_API_KEY
from models import AgentStatus, RecruiterEvaluation


class BatchEvaluationItem(BaseModel):
    index: int
    match_score: float
    fit_reason: str
    missing_skills: List[str]
    salary_or_type: str


class BatchEvaluationResponse(BaseModel):
    evaluations: List[BatchEvaluationItem]


EXCLUDE_TITLE_TERMS = (
    "plumbing", "plumber", "draughtsman", "hvac", "mechanical", "civil engineer",
    "electrical engineer", "driver", "chef", "cook", "nurse", "pharmacist",
    "housekeeping", "security guard", "receptionist", "call center",
    "principal ", "distinguished ", "vp of engineering", "chief technology",
)

INELIGIBLE_REGION_TERMS = (
    "us citizens only", "us citizen only", "u.s. citizens", "us work authorization",
    "must reside in the us", "united states only", "us only", "security clearance",
    "eu citizenship", "eu work permit", "uk only", "canada only", "germany only",
    "10+ years", "12+ years", "15+ years",
)

RELEVANT_TERMS = (
    "software", "developer", "engineer", "react", "next", "typescript", "javascript",
    "ios", "swift", "mobile", "python", "fastapi", "node", "ai", "ml", "data",
    "full stack", "fullstack", "frontend", "backend", "cloud", "devops", "qa",
    "unity", "ar", "vr", "it officer", "banking", "fintech", "lecturer", "faculty",
    "computer science", "cyber", "erp", "product manager", "tech",
)


def _prefilter_score(
    job: Dict[str, Any],
    cv_text: str,
    cv_skills: List[str] | None = None,
) -> float:
    title = job.get("title", "").lower()
    desc = job.get("description", "").lower()
    loc = job.get("location", "").lower()
    combined = f"{title} {loc} {desc[:1500]}"

    if any(bad in title for bad in EXCLUDE_TITLE_TERMS):
        return -1.0
    if any(region in combined for region in INELIGIBLE_REGION_TERMS):
        return -1.0

    hits = sum(1 for kw in RELEVANT_TERMS if kw in combined)
    cv_words = {w.strip(".,-()/").lower() for w in cv_text.split() if len(w) > 3}
    dynamic_skills = {s.lower() for s in (cv_skills or []) if len(s.strip()) > 1}
    target_tokens = dynamic_skills | {"swift", "swiftui", "react", "next", "typescript", "python", "fastapi", "unity", "docker"}
    cv_hits = sum(1 for w in target_tokens if w in combined and (w in cv_words or w in dynamic_skills))
    pk_bonus = 3.0 if any(p in combined for p in ("pakistan", "lahore", "karachi", "islamabad", "worldwide", "anywhere", "emea")) else 0.0
    return hits + cv_hits * 2.0 + pk_bonus


def _local_fallback_evaluate(job: Dict[str, Any], cv_text: str) -> RecruiterEvaluation:
    text = f"{job['title']} {job['description']}".lower()
    cv_lower = cv_text.lower()

    target_skills = [
        "swift", "swiftui", "uikit", "ios", "react", "next.js", "nextjs",
        "typescript", "tailwind", "unity", "arkit", "arfoundation", "ar", "c#",
        "python", "fastapi", "node.js", "docker", "software", "full stack",
    ]
    matched = [s for s in target_skills if s in text and s in cv_lower]

    if "java" in text and "spring boot" in text:
        return RecruiterEvaluation(
            match_score=3.5,
            fit_reason="Core stack requires Java/Spring Boot & Kafka, which does not align with your iOS/React/Python profile.",
            missing_skills=["Java", "Spring Boot", "Apache Kafka", "Kubernetes"],
            salary_or_type=f"{job.get('work_type', 'On-site')} · {job.get('location', 'Pakistan')}",
        )

    base_score = min(9.5, 6.0 + len(matched) * 0.65)
    score = round(base_score, 1)

    missing = []
    if "postgresql" in text and "postgresql" not in cv_lower:
        missing.append("PostgreSQL")
    if "react native" in text and "react native" not in cv_lower:
        missing.append("React Native")
    if not missing and score < 9.0:
        missing.append("Domain-specific nuances")

    salary_or_type = f"{job.get('work_type', 'On-site')} · {job.get('location', 'Pakistan')}"
    if "pkr" in text:
        salary_or_type += " · PKR listed"
    elif "$2,400" in text:
        salary_or_type += " · $2,400–$3,200/mo"

    return RecruiterEvaluation(
        match_score=score,
        fit_reason=f"Overlap on {', '.join(matched[:4]) or 'software engineering'} for {job.get('work_type', 'On-site')} role at {job['company']}.",
        missing_skills=missing,
        salary_or_type=salary_or_type,
    )


class RecruiterAgent(BaseAgent):
    name = "recruiter"
    label = "Recruiter Agent"

    async def run(
        self,
        jobs: List[Dict[str, Any]],
        settings: Dict[str, Any],
        mock_mode: bool,
        cv_analysis: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        self.start_timer()
        self.check_cancelled()

        if not jobs:
            await self.log("No new jobs to evaluate.")
            await self.set_state(AgentStatus.COMPLETED, "No new jobs to screen", 0, 0)
            return {"evaluated": [], "shortlisted": []}

        cv_text = settings.get("cv_text", "")
        min_score = float(settings.get("min_match_score", 7.0))
        system_prompt = settings.get("prompts", {}).get("recruiter") or DEFAULT_SYSTEM_PROMPTS["recruiter"]
        cv_skills: List[str] = list((cv_analysis or {}).get("core_skills", []))
        cv_context: str = str((cv_analysis or {}).get("search_context_brief", "")).strip()

        if not mock_mode and (not GEMINI_API_KEY or GEMINI_API_KEY == "your_gemini_api_key_here"):
            raise RuntimeError("GEMINI_API_KEY is missing. Set it or enable Mock/Test Mode.")

        # Step 1: Fast local pre-filter so irrelevant jobs don't waste API calls
        scored_candidates = []
        skipped_prefilter = 0
        for job in jobs:
            rel = _prefilter_score(job, cv_text, cv_skills)
            if rel < 0:
                skipped_prefilter += 1
                continue
            scored_candidates.append((rel, job))

        scored_candidates.sort(key=lambda x: x[0], reverse=True)
        filtered_jobs = [j for _, j in scored_candidates[:30]]

        if skipped_prefilter or len(jobs) > len(filtered_jobs):
            await self.log(
                f"Pre-filtered {len(jobs)} jobs -> keeping top {len(filtered_jobs)} relevant engineering/IT/faculty roles ({skipped_prefilter} unrelated skipped)."
            )

        evaluated: List[Dict[str, Any]] = []
        shortlisted: List[Dict[str, Any]] = []
        total = len(filtered_jobs)
        batch_size = 10

        for start in range(0, total, batch_size):
            self.check_cancelled()
            batch = filtered_jobs[start : start + batch_size]
            await self.set_state(
                AgentStatus.RUNNING,
                f"Batch scoring jobs {start + 1}-{start + len(batch)} of {total}",
                start,
                total,
            )

            eval_map: Dict[int, RecruiterEvaluation] = {}

            if mock_mode:
                await asyncio.sleep(0.35)
                for idx, job in enumerate(batch):
                    eval_map[idx] = _local_fallback_evaluate(job, cv_text)
            else:
                jobs_block = "\n\n".join(
                    f"[JOB {idx}]\nTitle: {j['title']}\nCompany: {j['company']}\n"
                    f"Location: {j['location']} ({j.get('work_type', 'On-site')})\n"
                    f"Description: {j.get('description', '')[:900]}"
                    for idx, j in enumerate(batch)
                )
                prompt = (
                    f"CV SEARCH CONTEXT BRIEF:\n{cv_context or 'Not provided'}\n\n"
                    f"CANDIDATE CV:\n{cv_text[:2500]}\n\n"
                    f"EVALUATE THESE {len(batch)} JOBS:\n{jobs_block}\n\n"
                    "Return JSON with 'evaluations': list of objects with 'index' (0-based int), "
                    "'match_score' (0-10 float), 'fit_reason' (1 concise line), "
                    "'missing_skills' (list of strings), and 'salary_or_type' (string)."
                )
                try:
                    raw_text = await generate_with_fallback(
                        contents=prompt,
                        system_instruction=system_prompt,
                        response_schema=BatchEvaluationResponse,
                        temperature=0.2,
                        timeout_seconds=20.0,
                    )
                    if raw_text:
                        parsed = BatchEvaluationResponse.model_validate_json(raw_text)
                        for item in parsed.evaluations:
                            eval_map[item.index] = RecruiterEvaluation(
                                match_score=max(0.0, min(10.0, float(item.match_score))),
                                fit_reason=item.fit_reason,
                                missing_skills=item.missing_skills,
                                salary_or_type=item.salary_or_type,
                            )
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    await self.log(
                        f"Gemini batch fallback used for jobs {start + 1}-{start + len(batch)} ({exc})",
                        level="WARN",
                    )

            for idx, job in enumerate(batch):
                ev = eval_map.get(idx) or _local_fallback_evaluate(job, cv_text)
                is_shortlisted = ev.match_score >= min_score
                merged = {
                    **job,
                    "match_score": round(ev.match_score, 1),
                    "fit_reason": ev.fit_reason,
                    "missing_skills": ev.missing_skills,
                    "salary_or_type": ev.salary_or_type,
                    "shortlisted": is_shortlisted,
                }
                evaluated.append(merged)

                if is_shortlisted:
                    shortlisted.append(merged)
                    await self.log(
                        f"SHORTLISTED [{merged['match_score']}/10] {job['title']} @ {job['company']} — {ev.fit_reason}"
                    )
                else:
                    await self.log(
                        f"SKIPPED [{merged['match_score']}/10 < {min_score}] {job['title']} @ {job['company']}"
                    )

            await self.set_state(
                AgentStatus.RUNNING,
                f"Screened {start + len(batch)}/{total} ({len(shortlisted)} shortlisted)",
                start + len(batch),
                total,
            )

        await self.set_state(
            AgentStatus.COMPLETED,
            f"Shortlisted {len(shortlisted)} of {total} jobs (min score {min_score})",
            total,
            total,
        )
        return {"evaluated": evaluated, "shortlisted": shortlisted}
