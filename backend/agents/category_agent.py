import asyncio
import json
from typing import Any, Dict, List

from google import genai
from google.genai import types

from agents.base import BaseAgent
from config import GEMINI_API_KEY, GEMINI_MODEL
from models import AgentStatus


DEFAULT_PAKISTAN_CATEGORIES: List[Dict[str, Any]] = [
    {
        "category": "Banking & Finance",
        "queries": ["Bank Officer Pakistan", "Relationship Manager Bank Pakistan", "Credit Analyst Pakistan"],
    },
    {
        "category": "University & Professor / Academia",
        "queries": ["University Professor Pakistan", "Assistant Professor Lecturer Pakistan", "Faculty HEC University Pakistan"],
    },
    {
        "category": "Government & Public Sector",
        "queries": ["Assistant Director Pakistan", "State Bank of Pakistan Jobs", "Public Sector Officer Pakistan"],
    },
    {
        "category": "Tech & Software Engineering",
        "queries": ["Software Engineer Pakistan", "AI Data Scientist Pakistan", "Full Stack Developer Pakistan"],
    },
    {
        "category": "Corporate & Management",
        "queries": ["Project Manager Pakistan", "Operations Manager Pakistan", "HR Finance Manager Pakistan"],
    },
]


class CategoryAgent(BaseAgent):
    name = "category_planner"
    label = "Category Planner Agent"

    async def run(self, settings: Dict[str, Any], mock_mode: bool) -> Dict[str, Any]:
        self.start_timer()
        self.check_cancelled()

        user_keywords: List[str] = settings.get("keywords", [])
        prompt_override: str = settings.get("prompts", {}).get("category_planner", "")

        await self.set_state(
            AgentStatus.RUNNING,
            "Generating top Pakistan job categories (Banking, University, Tech, Govt)...",
            0,
            len(DEFAULT_PAKISTAN_CATEGORIES),
        )
        await self.log("Planning top Pakistan job categories before searching the internet...")

        categories = list(DEFAULT_PAKISTAN_CATEGORIES)

        if not mock_mode and GEMINI_API_KEY and GEMINI_API_KEY != "your_gemini_api_key_here":
            try:
                client = genai.Client(api_key=GEMINI_API_KEY)
                sys_prompt = prompt_override or (
                    "You are a Pakistan Career Category Planner. Before scraping jobs, return 5 top, "
                    "high-prestige job categories across Pakistan (including Banking & Finance, "
                    "University Professor / Academia, Government/Public Sector, Tech & Engineering, "
                    "and Corporate Management), plus 2-3 clean job search queries per category."
                )
                user_msg = (
                    f"User's current keywords: {', '.join(user_keywords) if user_keywords else 'General top jobs'}.\n"
                    "Return JSON array of objects with keys: 'category' (string) and 'queries' (list of 2-3 search strings ending with 'Pakistan')."
                )
                resp = await asyncio.to_thread(
                    client.models.generate_content,
                    model=GEMINI_MODEL,
                    contents=user_msg,
                    config=types.GenerateContentConfig(
                        system_instruction=sys_prompt,
                        response_mime_type="application/json",
                        temperature=0.3,
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
            queries = [str(q).strip() for q in item.get("queries", []) if str(q).strip()]
            all_queries.extend(queries)
            await self.log(f"[{idx}] Category: {cat_name} -> Queries: {', '.join(queries)}")
            await self.set_state(
                AgentStatus.RUNNING,
                f"Prepared category: {cat_name}",
                idx,
                len(categories),
            )

        # Merge user's own keywords if not already covered
        if user_keywords:
            custom_q = f"{' '.join(user_keywords[:3])} Pakistan"
            if custom_q not in all_queries:
                all_queries.append(custom_q)

        await self.set_state(
            AgentStatus.COMPLETED,
            f"Prepared {len(categories)} Pakistan job categories ({len(all_queries)} search queries)",
            len(categories),
            len(categories),
        )
        return {"categories": categories, "queries": all_queries}
