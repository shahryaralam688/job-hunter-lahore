import asyncio
import json
from typing import Any, Dict, List

import httpx
from google import genai
from google.genai import types

from agents.base import BaseAgent
from config import GEMINI_API_KEY, GEMINI_MODEL, GOOGLE_SHEET_WEBHOOK_URL
from models import AgentStatus


DEFAULT_ENGINEER_CATEGORIES: List[Dict[str, Any]] = [
    {
        "category": "Software & Full-Stack Engineering (Top Tech Houses)",
        "why_fit": "Core Software Engineering, React/Next.js, TypeScript, Python/Node.js",
        "queries": [
            "Software Engineer Pakistan",
            "Full Stack Developer React Next.js Pakistan",
            "Senior Frontend TypeScript Engineer Pakistan",
        ],
    },
    {
        "category": "Mobile & iOS Engineering",
        "why_fit": "Swift, SwiftUI, UIKit, Mobile App Architecture",
        "queries": [
            "iOS Developer Swift Pakistan",
            "Mobile App Engineer SwiftUI Pakistan",
            "Senior Mobile Engineer Remote Pakistan",
        ],
    },
    {
        "category": "FinTech & Banking IT / Digital Banking",
        "why_fit": "High-paying Bank Software Engineer, Digital Banking, Core Systems roles",
        "queries": [
            "Software Engineer Bank Pakistan",
            "IT Officer Software Developer Bank Pakistan",
            "FinTech Backend Engineer Pakistan",
        ],
    },
    {
        "category": "University CS Lecturer / Software Engineering Faculty",
        "why_fit": "BS/MS CS background fits University Lecturer, Lab Engineer & Visiting Faculty",
        "queries": [
            "Computer Science Lecturer University Pakistan",
            "Software Engineering Faculty Lab Engineer Pakistan",
            "Visiting Faculty Computer Science Lahore",
        ],
    },
    {
        "category": "AI / ML & AR / Spatial Engineering",
        "why_fit": "AI Agents, Python, FastAPI, Unity ARKit",
        "queries": [
            "AI Engineer Python FastAPI Pakistan",
            "Unity AR Developer Pakistan",
            "Remote AI Software Engineer Pakistan",
        ],
    },
]


class CategoryAgent(BaseAgent):
    name = "category_planner"
    label = "Category Planner Agent"

    async def run(self, settings: Dict[str, Any], mock_mode: bool) -> Dict[str, Any]:
        self.start_timer()
        self.check_cancelled()

        cv_text: str = settings.get("cv_text", "")
        user_keywords: List[str] = settings.get("keywords", [])
        prompt_override: str = settings.get("prompts", {}).get("category_planner", "")

        await self.set_state(
            AgentStatus.RUNNING,
            "Analyzing CV & planning deep-search categories for Software Engineer...",
            0,
            len(DEFAULT_ENGINEER_CATEGORIES),
        )
        await self.log("Analyzing your CV & skills to build tailored deep-search categories...")

        categories = list(DEFAULT_ENGINEER_CATEGORIES)

        if not mock_mode and GEMINI_API_KEY and GEMINI_API_KEY != "your_gemini_api_key_here":
            try:
                client = genai.Client(api_key=GEMINI_API_KEY)
                sys_prompt = prompt_override or (
                    "You are a Deep-Search Career Category Planner for a Software Engineer in Pakistan. "
                    "Read the candidate's CV carefully and ONLY propose job categories they are genuinely "
                    "qualified for (including Top Tech Houses, FinTech/Banking Software/IT roles, "
                    "University CS Lecturer/Faculty roles if degree fits, AI/Backend/Frontend, and Remote roles). "
                    "For each category, generate 3 deep, specific job search queries."
                )
                user_msg = (
                    f"CANDIDATE CV:\n{cv_text[:3000]}\n\n"
                    f"USER KEYWORDS: {', '.join(user_keywords)}\n\n"
                    "Return a JSON array of 5 objects with keys: "
                    "'category' (string), 'why_fit' (short string), and 'queries' (list of 3 deep search strings ending with 'Pakistan')."
                )
                resp = await asyncio.to_thread(
                    client.models.generate_content,
                    model=GEMINI_MODEL,
                    contents=user_msg,
                    config=types.GenerateContentConfig(
                        system_instruction=sys_prompt,
                        response_mime_type="application/json",
                        temperature=0.2,
                    ),
                )
                parsed = json.loads(resp.text or "[]")
                if isinstance(parsed, list) and parsed:
                    valid = [
                        c for c in parsed
                        if isinstance(c, dict) and c.get("category") and isinstance(c.get("queries"), list)
                    ]
                    if valid:
                        categories = valid
            except Exception as exc:
                await self.log(f"Gemini category planning fallback used ({exc})", level="WARN")
        else:
            await asyncio.sleep(0.3)

        all_queries: List[str] = []
        for idx, item in enumerate(categories, start=1):
            self.check_cancelled()
            cat_name = item["category"]
            why_fit = item.get("why_fit", "")
            queries = [str(q).strip() for q in item.get("queries", []) if str(q).strip()]
            all_queries.extend(queries)
            await self.log(f"[{idx}] {cat_name} ({why_fit}) -> Queries: {', '.join(queries)}")
            await self.set_state(
                AgentStatus.RUNNING,
                f"Prepared category: {cat_name}",
                idx,
                len(categories),
            )

        if user_keywords:
            custom_q = f"{' '.join(user_keywords[:3])} Pakistan"
            if custom_q not in all_queries:
                all_queries.append(custom_q)

        # Optional webhook sync to Google Drive / Sheet
        if GOOGLE_SHEET_WEBHOOK_URL:
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    await client.post(
                        GOOGLE_SHEET_WEBHOOK_URL,
                        json={"type": "categories", "categories": categories},
                    )
                await self.log("Synced deep-search categories to Google Sheet webhook.")
            except Exception as exc:
                await self.log(f"Google Sheet category webhook sync skipped ({exc})", level="WARN")

        await self.set_state(
            AgentStatus.COMPLETED,
            f"Prepared {len(categories)} tailored engineer categories ({len(all_queries)} deep queries)",
            len(categories),
            len(categories),
        )
        return {"categories": categories, "queries": all_queries}
