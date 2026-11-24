import asyncio
import hashlib
import re
from typing import Any, Dict, List, Tuple

from agents.base import BaseAgent
from agents.llm_helper import generate_with_fallback
from config import DEFAULT_SYSTEM_PROMPTS, GEMINI_API_KEY
from models import AgentStatus, CVAnalysisResult

# Cache keyed by CV text + keywords + prompt hash to avoid duplicate LLM calls
_CV_ANALYSIS_CACHE: Dict[str, Dict[str, Any]] = {}

# Skill / domain tracks: (trigger_terms, domain_label, canonical_skills, possibilities)
# Each possibility: (role_title, fit_strength, rationale, search_keywords)
_CAREER_TRACKS: List[
    Tuple[
        Tuple[str, ...],
        str,
        List[str],
        List[Tuple[str, str, str, List[str]]],
    ]
] = [
    (
        ("swift", "swiftui", "uikit", "ios", "xcode", "combine", "coredata"),
        "iOS & Apple Mobile Engineering",
        ["Swift", "SwiftUI", "UIKit", "iOS", "Combine", "CoreData", "Xcode"],
        [
            (
                "Senior iOS Engineer",
                "Primary",
                "Direct match with native Swift, SwiftUI, UIKit, and production iOS app architecture.",
                ["iOS Developer", "Swift Engineer", "SwiftUI Developer"],
            ),
            (
                "Mobile App Lead (iOS / Cross-Platform)",
                "Secondary",
                "Leadership and mobile product delivery experience transfers to multi-platform mobile teams.",
                ["Mobile App Developer", "Mobile Lead"],
            ),
        ],
    ),
    (
        ("react", "next.js", "nextjs", "typescript", "javascript", "tailwind", "frontend", "zustand", "graphql"),
        "Modern Web & Frontend Engineering",
        ["React", "Next.js", "TypeScript", "JavaScript", "Tailwind CSS", "GraphQL"],
        [
            (
                "Full-Stack Next.js / TypeScript Engineer",
                "Primary",
                "Strong overlap across Next.js App Router, React, TypeScript, and modern SaaS portals.",
                ["Next.js Developer", "Full Stack Developer", "TypeScript Developer"],
            ),
            (
                "Senior Frontend Engineer (React)",
                "Primary",
                "Component architecture, bundle optimization, and UI engineering fit frontend-focused teams.",
                ["React Developer", "Frontend Engineer"],
            ),
        ],
    ),
    (
        ("unity", "arkit", "arfoundation", "ar ", "vr ", "spatial", "c#", "3d"),
        "AR/VR & Spatial Computing",
        ["Unity 3D", "ARKit", "ARFoundation", "C#", "Spatial Computing"],
        [
            (
                "Unity AR / Spatial Computing Engineer",
                "Primary",
                "Hands-on Unity 3D, ARKit, and interactive mobile AR integration experience.",
                ["Unity Developer", "AR VR Developer"],
            ),
        ],
    ),
    (
        ("python", "fastapi", "django", "flask", "node.js", "nodejs", "postgresql", "rest api", "backend"),
        "Backend & API Engineering",
        ["Python", "FastAPI", "Node.js", "PostgreSQL", "REST APIs"],
        [
            (
                "Backend / Python FastAPI Engineer",
                "Secondary",
                "API design, database modeling, and backend service experience fits server-side teams.",
                ["Python Developer", "Backend Engineer", "FastAPI Developer"],
            ),
        ],
    ),
    (
        ("ai", "llm", "genai", "machine learning", "pytorch", "tensorflow", "langchain", "agent", "rag"),
        "AI / ML & LLM Agents",
        ["GenAI", "LLMs", "Python", "AI Agents", "Machine Learning"],
        [
            (
                "AI / LLM Application Engineer",
                "Primary",
                "Experience with AI workflows, Python APIs, and intelligent product integration.",
                ["AI Engineer", "LLM Engineer", "Machine Learning Engineer"],
            ),
        ],
    ),
    (
        ("flutter", "dart", "react native", "android", "kotlin"),
        "Cross-Platform & Android Mobile",
        ["Flutter", "Dart", "React Native", "Android", "Kotlin"],
        [
            (
                "Cross-Platform Mobile Developer",
                "Primary",
                "Mobile app development skills align with Flutter/React Native/Android roles.",
                ["Flutter Developer", "React Native Developer", "Android Developer"],
            ),
        ],
    ),
    (
        ("docker", "kubernetes", "aws", "gcp", "azure", "terraform", "ci/cd", "github actions", "devops"),
        "Cloud, DevOps & Automation",
        ["Docker", "GitHub Actions", "CI/CD", "Cloud"],
        [
            (
                "DevOps / Platform Engineer",
                "Adjacent",
                "CI/CD automation, Docker containerization, and release pipeline experience.",
                ["DevOps Engineer", "Cloud Engineer"],
            ),
        ],
    ),
    (
        ("data", "sql", "power bi", "tableau", "pandas", "etl", "analytics", "spark"),
        "Data Engineering & Analytics",
        ["SQL", "Data Analytics", "Python", "ETL"],
        [
            (
                "Data Analyst / Analytics Engineer",
                "Primary",
                "Data modeling, SQL querying, and reporting experience.",
                ["Data Analyst", "Data Engineer"],
            ),
        ],
    ),
    (
        ("qa", "testing", "selenium", "playwright", "cypress", "appium", "sqa"),
        "QA & Test Automation",
        ["QA Automation", "Playwright", "Selenium", "Testing"],
        [
            (
                "QA Automation / SDET Engineer",
                "Secondary",
                "Engineering background and CI/CD discipline translate to automated testing roles.",
                ["QA Automation Engineer", "SQA Engineer"],
            ),
        ],
    ),
    (
        ("cyber", "security", "soc", "siem", "pentest", "infosec"),
        "Cybersecurity & InfoSec",
        ["Information Security", "Application Security", "SOC"],
        [
            (
                "Security / InfoSec Analyst",
                "Primary",
                "Security and risk analysis experience fits InfoSec and banking security teams.",
                ["Cybersecurity Analyst", "Information Security"],
            ),
        ],
    ),
    (
        ("lead", "leading", "squad", "scrum", "agile", "product", "architect", "manager"),
        "Technical Leadership & Product",
        ["Team Leadership", "Agile Delivery", "System Architecture"],
        [
            (
                "Technical Lead / Engineering Manager",
                "Adjacent",
                "Experience leading squads and shipping consumer/SaaS products end-to-end.",
                ["Technical Lead", "Engineering Manager", "Technical Product Manager"],
            ),
        ],
    ),
    (
        ("bs computer science", "ms computer science", "msc", "phd", "lecturer", "teaching", "fast-nuces", "nust", "lums"),
        "Academia, Banking IT & Public Sector (Pakistan)",
        ["CS Degree", "Software Systems", "Enterprise IT"],
        [
            (
                "CS Lecturer / Lab Engineer (Universities)",
                "Adjacent",
                "Strong CS degree and practical industry stack fit Pakistani university CS departments.",
                ["Computer Science Lecturer", "Lab Engineer CS"],
            ),
            (
                "Banking / GovTech Software Officer",
                "Adjacent",
                "Fintech/enterprise engineering background fits Bank IT and PITB/NADRA roles.",
                ["IT Officer Bank", "PITB Software Engineer"],
            ),
        ],
    ),
]


def _extract_years_seniority(cv_lower: str) -> str:
    matches = re.findall(r"(\d{1,2})\s*\+?\s*(?:years?|yrs?)", cv_lower)
    years = max((int(m) for m in matches), default=0)
    if years >= 7 or "principal" in cv_lower or "staff" in cv_lower:
        return f"Staff / Principal ({years}+ years)" if years else "Staff / Lead"
    if years >= 4 or "senior" in cv_lower or "lead" in cv_lower:
        return f"Senior ({years}+ years)" if years else "Senior"
    if years >= 2:
        return f"Mid-Level ({years}+ years)"
    if "intern" in cv_lower or "fresh" in cv_lower or years == 1:
        return "Junior / Entry-Level"
    return "Mid-to-Senior"


def _dedupe_preserve_order(items: List[str], max_items: int | None = None) -> List[str]:
    seen = set()
    out: List[str] = []
    for item in items:
        clean = " ".join(str(item).strip().split())
        if not clean:
            continue
        key = clean.lower()
        if key not in seen:
            seen.add(key)
            out.append(clean)
            if max_items and len(out) >= max_items:
                break
    return out


def analyze_cv_locally(cv_text: str, user_keywords: List[str]) -> Dict[str, Any]:
    cv_lower = cv_text.lower()
    seniority = _extract_years_seniority(cv_lower)

    matched_domains: List[str] = []
    extracted_skills: List[str] = []
    possibilities: List[Dict[str, Any]] = []
    generated_keywords: List[str] = []

    for triggers, domain, canonical_skills, track_possibilities in _CAREER_TRACKS:
        hits = [t for t in triggers if t in cv_lower]
        if not hits:
            continue
        matched_domains.append(domain)
        for skill in canonical_skills:
            if skill.lower() in cv_lower or any(h in skill.lower() for h in hits):
                extracted_skills.append(skill)
        for role_title, strength, rationale, kws in track_possibilities:
            possibilities.append(
                {
                    "role_title": role_title,
                    "fit_strength": strength,
                    "rationale": rationale,
                    "search_keywords": kws[:3],
                }
            )
            generated_keywords.extend(kws)

    # Always include Pakistan / Global Remote eligibility possibility
    if any(loc in cv_lower for loc in ("lahore", "pakistan", "karachi", "islamabad", "remote")):
        possibilities.append(
            {
                "role_title": "Global Remote Software Engineer (Pakistan Eligible)",
                "fit_strength": "Primary",
                "rationale": "Distributed remote team collaboration experience fits EMEA/US/Global remote postings open to Pakistan.",
                "search_keywords": ["Remote Software Engineer", "Remote Full Stack"],
            }
        )
        generated_keywords.extend(["Remote Software Engineer", "Remote Full Stack"])

    # Fallback if CV is from an unconventional / non-listed domain
    if not possibilities:
        possibilities.append(
            {
                "role_title": "Software & Technology Specialist",
                "fit_strength": "Primary",
                "rationale": "General technical profile derived from your CV and configured keywords.",
                "search_keywords": user_keywords[:3] or ["Software Engineer", "Tech Specialist"],
            }
        )

    # Merge user keywords cleanly
    all_keywords = _dedupe_preserve_order(generated_keywords + list(user_keywords), max_items=18)
    extracted_skills = _dedupe_preserve_order(extracted_skills + list(user_keywords), max_items=18)
    matched_domains = _dedupe_preserve_order(matched_domains, max_items=8)

    # Compute avoid_roles only for stacks clearly absent from CV
    avoid_candidates = [
        ("java", "Java / Spring Boot"),
        ("sap", "SAP / ABAP ERP"),
        ("php", "PHP / WordPress"),
        ("civil", "Civil / Mechanical Engineering"),
        (".net", ".NET / ASP.NET"),
    ]
    avoid_roles = [label for token, label in avoid_candidates if token not in cv_lower]

    top_roles = ", ".join(p["role_title"] for p in possibilities[:4])
    top_skills = ", ".join(extracted_skills[:8])
    candidate_summary = (
        f"{seniority} candidate covering {', '.join(matched_domains[:3]) or 'Technology'}. "
        f"Core strengths: {top_skills or 'General Software'}."
    )
    search_context_brief = (
        f"Candidate Level: {seniority}. Core Skills: {top_skills}. "
        f"Best Job Possibilities: {top_roles}. "
        f"Target Markets: Lahore (On-site/Hybrid), Pakistan, and Pakistan-eligible Global Remote. "
        f"Avoid unrelated stacks: {', '.join(avoid_roles[:4]) or 'None'}."
    )

    return {
        "candidate_summary": candidate_summary,
        "seniority_level": seniority,
        "core_skills": extracted_skills,
        "domains": matched_domains,
        "job_possibilities": possibilities[:8],
        "search_keywords": all_keywords,
        "avoid_roles": avoid_roles,
        "search_context_brief": search_context_brief,
    }


async def analyze_cv_standalone(
    cv_text: str,
    user_keywords: List[str],
    prompt_override: str = "",
    mock_mode: bool = True,
) -> Dict[str, Any]:
    cache_key = hashlib.sha256(
        f"{cv_text[:4000]}|{','.join(user_keywords)}|{prompt_override}".encode("utf-8")
    ).hexdigest()[:16]

    if cache_key in _CV_ANALYSIS_CACHE:
        return _CV_ANALYSIS_CACHE[cache_key]

    if not mock_mode and GEMINI_API_KEY and GEMINI_API_KEY != "your_gemini_api_key_here":
        sys_prompt = prompt_override or DEFAULT_SYSTEM_PROMPTS["cv_analyzer"]
        user_msg = (
            f"CANDIDATE CV:\n{cv_text[:4500]}\n\n"
            f"CURRENT USER KEYWORDS: {', '.join(user_keywords)}\n\n"
            "Analyze this CV thoroughly. Identify every realistic job-hunting possibility "
            "(Primary, Secondary, Adjacent roles across Lahore/Pakistan & Global Remote), "
            "concise 2-3 word job portal search keywords, unrelated roles to avoid, and a full search context brief."
        )
        raw_text = await generate_with_fallback(
            contents=user_msg,
            system_instruction=sys_prompt,
            response_schema=CVAnalysisResult,
            temperature=0.2,
            timeout_seconds=20.0,
        )
        if raw_text:
            parsed = CVAnalysisResult.model_validate_json(raw_text)
            result = parsed.model_dump()
            result["search_keywords"] = _dedupe_preserve_order(
                list(result.get("search_keywords", [])) + list(user_keywords),
                max_items=18,
            )
            _CV_ANALYSIS_CACHE[cache_key] = result
            return result

    result = analyze_cv_locally(cv_text, user_keywords)
    _CV_ANALYSIS_CACHE[cache_key] = result
    return result


class CVAnalyzerAgent(BaseAgent):
    name = "cv_analyzer"
    label = "CV Analyzer Agent"

    async def run(self, settings: Dict[str, Any], mock_mode: bool) -> Dict[str, Any]:
        self.start_timer()
        self.check_cancelled()

        cv_text: str = settings.get("cv_text", "")
        user_keywords: List[str] = settings.get("keywords", [])
        prompt_override: str = settings.get("prompts", {}).get("cv_analyzer", "")

        await self.set_state(
            AgentStatus.RUNNING,
            "Deeply analyzing CV, skills & job-hunting possibilities...",
            0,
            4,
        )
        await self.log("Scanning CV to extract skills, seniority, career possibilities & search context...")

        try:
            if not mock_mode and GEMINI_API_KEY and GEMINI_API_KEY != "your_gemini_api_key_here":
                analysis = await analyze_cv_standalone(
                    cv_text=cv_text,
                    user_keywords=user_keywords,
                    prompt_override=prompt_override,
                    mock_mode=False,
                )
            else:
                await asyncio.sleep(0.25)
                analysis = analyze_cv_locally(cv_text, user_keywords)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            await self.log(f"Gemini CV analysis fallback used ({exc})", level="WARN")
            analysis = analyze_cv_locally(cv_text, user_keywords)

        self.check_cancelled()
        await self.log(f"Profile Summary: {analysis['candidate_summary']}")
        await self.set_state(
            AgentStatus.RUNNING,
            f"Extracted {len(analysis['core_skills'])} core skills ({analysis['seniority_level']})",
            1,
            4,
        )

        possibilities = analysis.get("job_possibilities", [])
        for idx, pos in enumerate(possibilities, start=1):
            self.check_cancelled()
            kws = ", ".join(pos.get("search_keywords", []))
            await self.log(
                f"Possibility {idx}/{len(possibilities)} [{pos.get('fit_strength', 'Primary')}]: "
                f"{pos['role_title']} -> Queries: {kws}"
            )

        await self.set_state(
            AgentStatus.RUNNING,
            f"Mapped {len(possibilities)} job search possibilities",
            2,
            4,
        )

        search_keywords = analysis.get("search_keywords", [])
        await self.log(f"Generated {len(search_keywords)} search keywords: {', '.join(search_keywords[:12])}")
        if analysis.get("avoid_roles"):
            await self.log(f"Out-of-scope roles to deprioritize: {', '.join(analysis['avoid_roles'])}")

        await self.set_state(
            AgentStatus.RUNNING,
            "Sharing full CV search context with Category, Scout & Recruiter agents...",
            3,
            4,
        )

        await self.set_state(
            AgentStatus.COMPLETED,
            f"{len(possibilities)} possibilities · {len(search_keywords)} keywords ready",
            len(possibilities),
            len(possibilities),
        )
        return analysis
