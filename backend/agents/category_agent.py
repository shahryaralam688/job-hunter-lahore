import asyncio
import hashlib
import json
from typing import Any, Dict, List

import httpx

from agents.base import BaseAgent
from agents.llm_helper import generate_with_fallback
from config import GEMINI_API_KEY, GOOGLE_SHEET_WEBHOOK_URL
from models import AgentStatus


# In-memory cache keyed by CV + keywords + prompt hash to avoid redundant Gemini calls
_CATEGORY_CACHE: Dict[str, List[Dict[str, Any]]] = {}

DEFAULT_ENGINEER_CATEGORIES: List[Dict[str, Any]] = [
    {
        "category": "1. Software & Full-Stack Engineering",
        "why_fit": "Core Software Engineering, React, Next.js, TypeScript, Python, Node.js",
        "queries": ["Software Engineer", "Full Stack Developer"],
    },
    {
        "category": "2. Banking & FinTech IT Department",
        "why_fit": "Bank IT Officer, Digital Banking, Core Banking & Payment Systems",
        "queries": ["IT Officer Bank", "Banking Software Engineer"],
    },
    {
        "category": "3. University CS Lecturer & Lab Engineer",
        "why_fit": "BS/MS CS fits University Lecturer, Lab Engineer & Visiting Faculty",
        "queries": ["Computer Science Lecturer", "Lab Engineer CS"],
    },
    {
        "category": "4. Government & Public Sector IT",
        "why_fit": "Assistant Director IT, PITB, NADRA, SBP Software & Systems",
        "queries": ["Assistant Director IT", "PITB Software Engineer"],
    },
    {
        "category": "5. Mobile & iOS / Cross-Platform",
        "why_fit": "Swift, SwiftUI, UIKit, React Native, Flutter",
        "queries": ["iOS Developer", "Mobile App Developer"],
    },
    {
        "category": "6. AI / Machine Learning & LLM Agents",
        "why_fit": "Python, FastAPI, AI Agents, GenAI, Data Science",
        "queries": ["AI Engineer", "Python Developer"],
    },
    {
        "category": "7. Telecom & Digital Platforms",
        "why_fit": "Telecom IT, Backend APIs, Enterprise Portals & App Platforms",
        "queries": ["Backend Engineer", "Telecom Software Engineer"],
    },
    {
        "category": "8. E-Commerce & Frontend Engineering",
        "why_fit": "Web Platforms, TypeScript, React, Next.js UI Scale",
        "queries": ["Frontend Developer", "React Next.js Developer"],
    },
    {
        "category": "9. Cloud, DevOps & SRE",
        "why_fit": "Docker, CI/CD, GitHub Actions, AWS/GCP Infrastructure",
        "queries": ["DevOps Engineer", "Cloud Engineer"],
    },
    {
        "category": "10. Cybersecurity & Bank InfoSec",
        "why_fit": "Application Security, SOC Analyst, Bank IT Security",
        "queries": ["Cybersecurity Analyst", "Information Security"],
    },
    {
        "category": "11. ERP, SAP, Oracle & Database IT",
        "why_fit": "SQL, PostgreSQL, Enterprise Systems & Business Automation",
        "queries": ["ERP Developer", "Database Administrator"],
    },
    {
        "category": "12. QA Automation & Software Testing",
        "why_fit": "Automated Testing, CI/CD Quality, Playwright/Selenium",
        "queries": ["QA Automation Engineer", "SQA Engineer"],
    },
    {
        "category": "13. Technical Project / Product Management",
        "why_fit": "Leading squads, Agile delivery, Engineering + Product bridging",
        "queries": ["Technical Project Manager", "Product Manager Tech"],
    },
    {
        "category": "14. AR/VR, Unity & Spatial Computing",
        "why_fit": "Unity 3D, ARKit, ARFoundation, C# Interactive Apps",
        "queries": ["Unity Developer", "AR VR Developer"],
    },
    {
        "category": "15. Global Remote Software Engineering",
        "why_fit": "EMEA/US/Global Remote Full-Stack, iOS & AI roles from Pakistan",
        "queries": ["Remote Software Engineer", "Remote TypeScript Developer"],
    },
]

_NON_IT_TERMS = ("plumbing", "hvac", "draughtsman", "driver", "chef", "nurse", "civil", "mechanical")


def _clean_queries(raw_queries: List[Any]) -> List[str]:
    cleaned: List[str] = []
    for q in raw_queries:
        text = " ".join(str(q).strip().split())
        if not text or any(bad in text.lower() for bad in _NON_IT_TERMS):
            continue
        # Keep queries concise (max 4 words) for higher job portal recall
        words = text.split()
        if len(words) > 4:
            text = " ".join(words[:4])
        if text not in cleaned:
            cleaned.append(text)
    return cleaned[:3]


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
            "Optimizing CV-tailored IT & Pakistan sector categories...",
            0,
            len(DEFAULT_ENGINEER_CATEGORIES),
        )

        cache_key = hashlib.sha256(
            f"{cv_text[:2500]}|{','.join(user_keywords)}|{prompt_override}".encode("utf-8")
        ).hexdigest()[:16]

        categories = list(DEFAULT_ENGINEER_CATEGORIES)

        if cache_key in _CATEGORY_CACHE:
            categories = _CATEGORY_CACHE[cache_key]
            await self.log(f"Loaded {len(categories)} cached CV-tailored IT categories (0 API calls).")
        elif not mock_mode and GEMINI_API_KEY and GEMINI_API_KEY != "your_gemini_api_key_here":
            await self.log("Analyzing your CV & keywords with resilient Gemini fallback to build high-hit queries...")
            try:
                sys_prompt = prompt_override or (
                    "You are a Deep-Search Career Category Planner for a Software Engineer / CS graduate in Pakistan. "
                    "Read the candidate's CV and generate 15 distinct IT/CS job categories across EVERY sector "
                    "they can enter (Tech Houses, Bank IT Departments, University CS Lecturer/Lab Engineer, "
                    "Government/PITB/NADRA IT, Telecom, E-Commerce, AI/ML, Cloud/DevOps, Cybersecurity, ERP, "
                    "QA Automation, Technical PM, AR/Unity, and Global Remote). "
                    "CRITICAL: Each search query MUST be short (2 to 3 words max, e.g. 'Software Engineer', "
                    "'IT Officer Bank', 'CS Lecturer') so job portals return maximum real jobs. Never include non-IT roles."
                )
                user_msg = (
                    f"CANDIDATE CV:\n{cv_text[:3000]}\n\n"
                    f"USER KEYWORDS: {', '.join(user_keywords)}\n\n"
                    "Return a JSON array of 15 objects with keys: "
                    "'category' (string), 'why_fit' (short string), and 'queries' (list of 2 concise 2-3 word job search strings)."
                )
                raw_text = await generate_with_fallback(
                    contents=user_msg,
                    system_instruction=sys_prompt,
                    temperature=0.2,
                    timeout_seconds=20.0,
                )
                if raw_text:
                    parsed = json.loads(raw_text)
                    if isinstance(parsed, list) and len(parsed) >= 10:
                        valid: List[Dict[str, Any]] = []
                        for c in parsed:
                            if isinstance(c, dict) and c.get("category") and isinstance(c.get("queries"), list):
                                cq = _clean_queries(c["queries"])
                                if cq:
                                    valid.append(
                                        {
                                            "category": str(c["category"]).strip(),
                                            "why_fit": str(c.get("why_fit", "")).strip(),
                                            "queries": cq,
                                        }
                                    )
                        if len(valid) >= 10:
                            categories = valid[:20]
                            _CATEGORY_CACHE[cache_key] = categories
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                await self.log(f"Gemini category planning fallback used ({exc})", level="WARN")
        else:
            await asyncio.sleep(0.25)

        all_queries: List[str] = []
        seen_q = set()
        for idx, item in enumerate(categories, start=1):
            self.check_cancelled()
            cat_name = item["category"]
            why_fit = item.get("why_fit", "")
            queries = _clean_queries(item.get("queries", []))
            for q in queries:
                if q.lower() not in seen_q:
                    seen_q.add(q.lower())
                    all_queries.append(q)
            await self.log(f"[{idx}/{len(categories)}] {cat_name} ({why_fit}) -> Queries: {', '.join(queries)}")
            await self.set_state(
                AgentStatus.RUNNING,
                f"Prepared category {idx}/{len(categories)}: {cat_name}",
                idx,
                len(categories),
            )

        # Ensure user's own top keywords are always included as concise queries
        for kw in user_keywords[:4]:
            kw_clean = kw.strip()
            if kw_clean and kw_clean.lower() not in seen_q:
                seen_q.add(kw_clean.lower())
                all_queries.append(kw_clean)

        if GOOGLE_SHEET_WEBHOOK_URL and not mock_mode:
            try:
                async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                    await client.post(
                        GOOGLE_SHEET_WEBHOOK_URL,
                        json={"type": "categories", "categories": categories},
                    )
                await self.log("Synced optimized categories to Google Sheet webhook.")
            except Exception as exc:
                await self.log(f"Google Sheet category webhook sync skipped ({exc})", level="WARN")

        await self.set_state(
            AgentStatus.COMPLETED,
            f"Prepared {len(categories)} IT categories ({len(all_queries)} high-hit queries)",
            len(categories),
            len(categories),
        )
        return {"categories": categories, "queries": all_queries}
