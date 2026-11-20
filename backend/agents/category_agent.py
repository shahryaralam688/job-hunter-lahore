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
        "category": "1. Software & Full-Stack Engineering (Tech Houses)",
        "why_fit": "Core Software Engineering, React, Next.js, TypeScript, Python, Node.js",
        "queries": ["Software Engineer Pakistan", "Full Stack Developer React Next.js Pakistan"],
    },
    {
        "category": "2. Banking & FinTech IT Department",
        "why_fit": "Bank IT Officer, Digital Banking, Core Banking & Payment Systems",
        "queries": ["IT Officer Bank Pakistan", "Software Engineer Digital Banking Pakistan"],
    },
    {
        "category": "3. University CS Lecturer / Lab Engineer / Faculty",
        "why_fit": "BS/MS CS fits University Lecturer, Lab Instructor & Visiting Faculty",
        "queries": ["Computer Science Lecturer University Pakistan", "Lab Engineer Software Engineering Pakistan"],
    },
    {
        "category": "4. Government & Public Sector IT (PITB / NADRA / SBP)",
        "why_fit": "Assistant Director IT, Software Developer & Systems Officer in Govt",
        "queries": ["Assistant Director IT Pakistan", "Software Engineer PITB NADRA Pakistan"],
    },
    {
        "category": "5. Mobile & iOS / Cross-Platform Engineering",
        "why_fit": "Swift, SwiftUI, UIKit, React Native, Flutter",
        "queries": ["iOS Developer Swift Pakistan", "Mobile App Developer Pakistan"],
    },
    {
        "category": "6. AI / Machine Learning & LLM Agents",
        "why_fit": "Python, FastAPI, AI Agents, GenAI, Data Science",
        "queries": ["AI Engineer Python Pakistan", "Machine Learning Engineer Pakistan"],
    },
    {
        "category": "7. Telecom & Digital Platforms (Jazz / Zong / PTCL)",
        "why_fit": "Telecom IT, Backend APIs, Enterprise Portals & App Platforms",
        "queries": ["Software Engineer Telecom Pakistan", "Digital Platforms Engineer Pakistan"],
    },
    {
        "category": "8. E-Commerce & Marketplace Tech",
        "why_fit": "Web Platforms, Checkout APIs, Frontend & Full-Stack Scale",
        "queries": ["E-Commerce Software Developer Pakistan", "Frontend Engineer TypeScript Pakistan"],
    },
    {
        "category": "9. Cloud, DevOps & Site Reliability (SRE)",
        "why_fit": "Docker, CI/CD, GitHub Actions, AWS/GCP Cloud Infrastructure",
        "queries": ["DevOps Engineer Pakistan", "Cloud Engineer AWS GCP Pakistan"],
    },
    {
        "category": "10. Cybersecurity & Bank InfoSec",
        "why_fit": "Application Security, SOC Analyst, Bank IT Security & Compliance",
        "queries": ["Cybersecurity Analyst IT Bank Pakistan", "Information Security Engineer Pakistan"],
    },
    {
        "category": "11. ERP, SAP, Oracle & Enterprise IT",
        "why_fit": "SQL, PostgreSQL, Enterprise Systems & Business Automation",
        "queries": ["ERP Developer Software Engineer Pakistan", "Database Administrator SQL Pakistan"],
    },
    {
        "category": "12. QA Automation & Software Testing",
        "why_fit": "Automated Testing, CI/CD Quality, Playwright/Selenium/API Testing",
        "queries": ["QA Automation Engineer Pakistan", "Software Quality Assurance Engineer Pakistan"],
    },
    {
        "category": "13. Technical Project / Product Management",
        "why_fit": "Leading squads, Agile delivery, Engineering + Product bridging",
        "queries": ["Technical Project Manager Software Pakistan", "Associate Product Manager Tech Pakistan"],
    },
    {
        "category": "14. AR/VR, Unity & Game / Spatial Computing",
        "why_fit": "Unity 3D, ARKit, ARFoundation, C# Interactive Apps",
        "queries": ["Unity 3D Developer Pakistan", "AR VR Developer Pakistan"],
    },
    {
        "category": "15. Global Remote Software Engineering",
        "why_fit": "EMEA/US/Global Remote Full-Stack, iOS & AI roles from Pakistan",
        "queries": ["Remote Software Engineer Pakistan", "Remote Full Stack TypeScript Developer"],
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
            "Planning 15 deep-search categories for Software Engineer across all Pakistan sectors...",
            0,
            len(DEFAULT_ENGINEER_CATEGORIES),
        )
        await self.log("Analyzing your CV & skills to build 12–18 deep-search categories across all sectors...")

        categories = list(DEFAULT_ENGINEER_CATEGORIES)

        if not mock_mode and GEMINI_API_KEY and GEMINI_API_KEY != "your_gemini_api_key_here":
            try:
                client = genai.Client(api_key=GEMINI_API_KEY)
                sys_prompt = prompt_override or (
                    "You are a Deep-Search Career Category Planner for a Software Engineer / CS graduate in Pakistan. "
                    "Read the candidate's CV and generate 12 to 18 distinct job categories across EVERY sector "
                    "they can enter (Tech Houses, Bank IT Departments, University CS Lecturer/Lab Engineer, "
                    "Government/PITB/NADRA IT, Telecom, E-Commerce, AI/ML, Cloud/DevOps, Cybersecurity, ERP, "
                    "QA Automation, Technical PM, AR/Unity, and Global Remote). "
                    "For each category, provide 2 deep search queries."
                )
                user_msg = (
                    f"CANDIDATE CV:\n{cv_text[:3000]}\n\n"
                    f"USER KEYWORDS: {', '.join(user_keywords)}\n\n"
                    "Return a JSON array of 15 objects with keys: "
                    "'category' (string), 'why_fit' (short string), and 'queries' (list of 2 search strings ending with 'Pakistan' or 'Remote')."
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
                if isinstance(parsed, list) and len(parsed) >= 10:
                    valid = [
                        c for c in parsed
                        if isinstance(c, dict) and c.get("category") and isinstance(c.get("queries"), list)
                    ]
                    if len(valid) >= 10:
                        categories = valid[:20]
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
            await self.log(f"[{idx}/{len(categories)}] {cat_name} ({why_fit}) -> Queries: {', '.join(queries)}")
            await self.set_state(
                AgentStatus.RUNNING,
                f"Prepared category {idx}/{len(categories)}: {cat_name}",
                idx,
                len(categories),
            )

        if user_keywords:
            custom_q = f"{' '.join(user_keywords[:3])} Pakistan"
            if custom_q not in all_queries:
                all_queries.append(custom_q)

        if GOOGLE_SHEET_WEBHOOK_URL:
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    await client.post(
                        GOOGLE_SHEET_WEBHOOK_URL,
                        json={"type": "categories", "categories": categories},
                    )
                await self.log("Synced 15 deep-search categories to Google Sheet webhook.")
            except Exception as exc:
                await self.log(f"Google Sheet category webhook sync skipped ({exc})", level="WARN")

        await self.set_state(
            AgentStatus.COMPLETED,
            f"Prepared {len(categories)} engineer categories ({len(all_queries)} deep queries)",
            len(categories),
            len(categories),
        )
        return {"categories": categories, "queries": all_queries}
