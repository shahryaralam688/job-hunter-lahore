import asyncio
import json
from typing import Any, Dict, List

from google import genai
from google.genai import types

from agents.base import BaseAgent
from config import DEFAULT_SYSTEM_PROMPTS, GEMINI_API_KEY, GEMINI_MODEL
from models import AgentStatus, RecruiterEvaluation


def _mock_evaluate(job: Dict[str, Any], cv_text: str) -> RecruiterEvaluation:
    text = f"{job['title']} {job['description']}".lower()
    cv_lower = cv_text.lower()

    target_skills = [
        "swift", "swiftui", "uikit", "ios", "react", "next.js", "nextjs",
        "typescript", "tailwind", "unity", "arkit", "arfoundation", "ar", "c#",
    ]
    matched = [s for s in target_skills if s in text and s in cv_lower]

    if "java" in text and "spring boot" in text:
        return RecruiterEvaluation(
            match_score=3.5,
            fit_reason="Core stack requires Java/Spring Boot & Kafka, which does not align with your iOS/React/AR profile.",
            missing_skills=["Java", "Spring Boot", "Apache Kafka", "Kubernetes"],
            salary_or_type=f"{job.get('work_type', 'On-site')} · {job.get('location', 'Lahore')}",
        )

    base_score = min(9.5, 6.2 + len(matched) * 0.65)
    score = round(base_score, 1)

    missing = []
    if "postgresql" in text and "postgresql" not in cv_lower:
        missing.append("PostgreSQL")
    if "shader" in text and "shader" not in cv_lower:
        missing.append("Shader Optimization")
    if "react native" in text and "react native" not in cv_lower:
        missing.append("React Native")
    if not missing and score < 9.2:
        missing.append("Domain-specific CI/CD nuances")

    salary_or_type = f"{job.get('work_type', 'On-site')} · {job.get('location', 'Lahore')}"
    if "pkr" in text:
        salary_or_type += " · PKR 320k–450k"
    elif "$2,400" in text:
        salary_or_type += " · $2,400–$3,200/mo"

    return RecruiterEvaluation(
        match_score=score,
        fit_reason=f"Strong overlap on {', '.join(matched[:4]) or 'core engineering'} for a {job.get('work_type', 'On-site')} role at {job['company']}.",
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

        client = None
        if not mock_mode:
            if not GEMINI_API_KEY or GEMINI_API_KEY == "your_gemini_api_key_here":
                raise RuntimeError("GEMINI_API_KEY is missing in .env. Set it or enable Mock/Test Mode.")
            client = genai.Client(api_key=GEMINI_API_KEY)

        evaluated: List[Dict[str, Any]] = []
        shortlisted: List[Dict[str, Any]] = []
        total = len(jobs)

        for idx, job in enumerate(jobs, start=1):
            self.check_cancelled()
            await self.set_state(
                AgentStatus.RUNNING,
                f"Scoring {job['title']} @ {job['company']}",
                idx - 1,
                total,
            )

            if mock_mode:
                await asyncio.sleep(0.35)
                ev = _mock_evaluate(job, cv_text)
            else:
                prompt = (
                    f"CANDIDATE CV:\n{cv_text}\n\n"
                    f"JOB POSTING:\n"
                    f"Title: {job['title']}\n"
                    f"Company: {job['company']}\n"
                    f"Location: {job['location']}\n"
                    f"Work Type: {job.get('work_type', 'On-site')}\n"
                    f"Description:\n{job.get('description', '')[:4500]}\n\n"
                    "Evaluate the candidate's fit for this role."
                )
                try:
                    response = await asyncio.to_thread(
                        client.models.generate_content,
                        model=GEMINI_MODEL,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            system_instruction=system_prompt,
                            response_mime_type="application/json",
                            response_schema=RecruiterEvaluation,
                            temperature=0.2,
                        ),
                    )
                    ev = RecruiterEvaluation.model_validate(json.loads(response.text))
                except Exception as exc:
                    await self.log(
                        f"Gemini scoring failed for {job['title']} @ {job['company']}: {exc}",
                        level="ERROR",
                    )
                    continue

            is_shortlisted = ev.match_score >= min_score
            enriched = {
                **job,
                "match_score": round(float(ev.match_score), 1),
                "fit_reason": ev.fit_reason,
                "missing_skills": ev.missing_skills,
                "salary_or_type": ev.salary_or_type,
                "shortlisted": is_shortlisted,
            }
            evaluated.append(enriched)
            if is_shortlisted:
                shortlisted.append(enriched)
                await self.log(
                    f"SHORTLISTED [{ev.match_score:.1f}/10] {job['title']} @ {job['company']} — {ev.fit_reason}"
                )
            else:
                await self.log(
                    f"SKIPPED [{ev.match_score:.1f}/10 < {min_score}] {job['title']} @ {job['company']}"
                )

        await self.set_state(
            AgentStatus.COMPLETED,
            f"Shortlisted {len(shortlisted)}/{total} jobs (min {min_score}/10)",
            total,
            total,
        )
        return {"evaluated": evaluated, "shortlisted": shortlisted}
