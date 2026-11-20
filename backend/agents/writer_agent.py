import asyncio
import json
from typing import Any, Dict, List

from google import genai
from google.genai import types

from agents.base import BaseAgent
from config import DEFAULT_SYSTEM_PROMPTS, GEMINI_API_KEY
from models import AgentStatus, WriterKit


def _mock_write_kit(job: Dict[str, Any]) -> WriterKit:
    title = job["title"]
    company = job["company"]
    lower = title.lower()

    if "ios" in lower or "swift" in lower:
        bullets = [
            f"Architected modular SwiftUI & UIKit features for consumer iOS apps serving 80k+ MAU with 99.6% crash-free sessions, directly aligned with {company}'s mobile roadmap.",
            "Implemented reactive state management using Combine and REST/GraphQL caching layers, cutting cold-start latency by 32%.",
            "Automated TestFlight & App Store release pipelines via GitHub Actions and Fastlane, reducing QA turnaround by 40%.",
        ]
        questions = [
            "How do you prevent retain cycles and manage memory pressure when bridging Combine publishers with SwiftUI views?",
            "Walk through your strategy for migrating a legacy UIKit screen into SwiftUI while maintaining 60fps scroll performance.",
        ]
    elif "unity" in lower or "ar" in lower:
        bullets = [
            f"Engineered interactive Unity 3D & ARKit spatial preview modules integrated into production iOS apps, lifting user engagement by 34%.",
            "Profiled C# scripts and mobile shaders using Xcode Metal Frame Capture to sustain 60fps on mid-tier iOS/Android devices.",
            "Designed clean native-to-Unity bridging interfaces for real-time asset loading and telemetry tracking.",
        ]
        questions = [
            "How do you optimize draw calls, memory footprint, and thermal throttling in ARFoundation/ARKit mobile scenes?",
            "Explain how you structure native iOS Swift <-> Unity C# communication without blocking the main UI thread.",
        ]
    else:
        bullets = [
            f"Delivered production Next.js (App Router) and TypeScript web applications with Tailwind CSS, improving Core Web Vitals and reducing bundle size by 28%.",
            "Built reusable, accessible component libraries and strongly-typed API clients consumed across multiple product squads.",
            "Collaborated across async product/design teams to ship merchant dashboards and analytics workflows ahead of schedule.",
        ]
        questions = [
            "When do you choose React Server Components vs. Client Components in Next.js App Router, and how do you avoid hydration mismatches?",
            "How do you structure TypeScript API contracts and optimistic UI updates for complex dashboard mutations?",
        ]

    cold_pitch = (
        f"Hi Hiring Team at {company} — I noticed your opening for {title} ({job.get('work_type', 'On-site')}).\n"
        f"I'm a Lahore-based engineer with 4+ years shipping production Swift/iOS, Next.js/TypeScript, and Unity AR apps.\n"
        f"Would love to share how I've scaled 80k+ MAU mobile/web products—open to a quick 15-min chat this week?"
    )

    return WriterKit(
        cv_bullets=bullets,
        cold_pitch=cold_pitch,
        interview_questions=questions,
    )


class WriterAgent(BaseAgent):
    name = "writer"
    label = "Writer Agent"

    async def run(
        self,
        shortlisted_jobs: List[Dict[str, Any]],
        settings: Dict[str, Any],
        mock_mode: bool,
    ) -> List[Dict[str, Any]]:
        self.start_timer()
        self.check_cancelled()

        if not shortlisted_jobs:
            await self.log("No shortlisted jobs to craft application kits for.")
            await self.set_state(AgentStatus.COMPLETED, "No shortlisted jobs", 0, 0)
            return []

        cv_text = settings.get("cv_text", "")
        system_prompt = settings.get("prompts", {}).get("writer") or DEFAULT_SYSTEM_PROMPTS["writer"]

        client = None
        if not mock_mode:
            if not GEMINI_API_KEY or GEMINI_API_KEY == "your_gemini_api_key_here":
                raise RuntimeError("GEMINI_API_KEY is missing in .env. Set it or enable Mock/Test Mode.")
            client = genai.Client(api_key=GEMINI_API_KEY)

        enriched_kits: List[Dict[str, Any]] = []
        total = len(shortlisted_jobs)

        for idx, job in enumerate(shortlisted_jobs, start=1):
            self.check_cancelled()
            await self.set_state(
                AgentStatus.RUNNING,
                f"Crafting kit for {job['title']} @ {job['company']}",
                idx - 1,
                total,
            )

            if mock_mode:
                await asyncio.sleep(0.35)
                kit = _mock_write_kit(job)
            else:
                prompt = (
                    f"CANDIDATE CV:\n{cv_text}\n\n"
                    f"TARGET JOB:\n"
                    f"Title: {job['title']}\n"
                    f"Company: {job['company']}\n"
                    f"Work Type: {job.get('work_type', 'On-site')}\n"
                    f"Fit Reason: {job.get('fit_reason', '')}\n"
                    f"Description:\n{job.get('description', '')[:4000]}\n\n"
                    "Generate:\n"
                    "1. Exactly 3 tailored, ATS-friendly CV bullet points.\n"
                    "2. A 3-line direct cold pitch for the hiring manager (LinkedIn DM / email).\n"
                    "3. Exactly 2 likely technical interview questions."
                )
                try:
                    response = await asyncio.to_thread(
                        client.models.generate_content,
                        model="gemini-2.5-flash",
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            system_instruction=system_prompt,
                            response_mime_type="application/json",
                            response_schema=WriterKit,
                            temperature=0.4,
                        ),
                    )
                    kit = WriterKit.model_validate(json.loads(response.text))
                except Exception as exc:
                    await self.log(
                        f"Writer failed for {job['title']} @ {job['company']}: {exc}",
                        level="ERROR",
                    )
                    continue

            enriched = {
                **job,
                "cv_bullets": kit.cv_bullets,
                "cold_pitch": kit.cold_pitch,
                "interview_questions": kit.interview_questions,
            }
            enriched_kits.append(enriched)
            await self.log(f"Kit ready for {job['title']} @ {job['company']} (3 bullets, pitch, 2 Qs).")

        await self.set_state(
            AgentStatus.COMPLETED,
            f"Generated {len(enriched_kits)} application kits",
            len(enriched_kits),
            total,
        )
        return enriched_kits
