import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from monorepo root or backend directory
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")
load_dotenv(Path(__file__).resolve().parent / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip()
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "").strip()
DATABASE_PATH = os.getenv("DATABASE_PATH", str(Path(__file__).resolve().parent / "job_hunter.db"))
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if origin.strip()
]

DEFAULT_CV_TEXT = """MUHAMMAD ALI RAZA
Lahore, Pakistan | Senior Software Engineer (iOS, React/Next.js & AR)

SUMMARY
Full-stack mobile and web engineer with 4+ years of experience building production iOS apps (Swift, SwiftUI, UIKit), modern web platforms (React, Next.js, TypeScript, Tailwind CSS), and interactive AR experiences (Unity, ARKit). Experienced in leading small squads, shipping consumer and SaaS products, and collaborating with distributed remote teams.

CORE SKILLS
- Mobile & AR: Swift, SwiftUI, UIKit, Combine, CoreData, Unity 3D, ARKit, ARFoundation, C#
- Web & Frontend: React, Next.js (App Router), TypeScript, JavaScript (ES6+), Tailwind CSS, Zustand
- Backend & Data: Node.js, Python, FastAPI, PostgreSQL, Firebase, REST APIs, GraphQL
- Tooling: Git, Xcode, GitHub Actions, Docker, Figma

EXPERIENCE
Senior iOS & Frontend Engineer —Lahore Tech Studio (2023 – Present)
- Architected and shipped a flagship SwiftUI fintech app with 80k+ MAU and 99.6% crash-free sessions.
- Built internal analytics dashboards and merchant portals using Next.js 14, TypeScript, and Tailwind CSS.
- Integrated Unity ARKit product-preview modules, increasing user engagement by 34%.

Software Engineer — Remote SaaS Squad (2021 – 2023)
- Developed reusable TypeScript/React component libraries and reduced bundle size by 28%.
- Built REST/GraphQL integrations and automated CI/CD pipelines via GitHub Actions.

EDUCATION
BS Computer Science — FAST-NUCES, Lahore
"""

DEFAULT_KEYWORDS = ["Swift", "iOS", "React", "Next.js", "TypeScript", "Unity AR"]
DEFAULT_LOCATION = "Lahore, Pakistan"
DEFAULT_HOURS_OLD = 72
DEFAULT_MIN_MATCH_SCORE = 7.0

DEFAULT_SYSTEM_PROMPTS = {
    "scout": (
        "You are the Scout Agent. Target fresh tech roles posted within the configured window "
        "across Lahore (On-site/Hybrid) and Remote. Prioritize clean metadata, accurate work-mode "
        "classification, and strict URL deduplication."
    ),
    "recruiter": (
        "You are a strict, pragmatic technical recruiter evaluating job postings for a software engineer "
        "based in Lahore, Pakistan. Compare the job requirements carefully against the candidate's CV. "
        "Reward strong stack overlap (Swift/iOS, React/Next.js, TypeScript, Unity AR) and realistic "
        "Lahore On-site/Hybrid or Pakistan-friendly Remote eligibility. Penalize roles requiring "
        "unrelated stacks or US/EU-only work authorization."
    ),
    "writer": (
        "You are an expert technical career coach and copywriter. Write concise, high-impact, "
        "ATS-friendly CV bullet points using strong action verbs and measurable outcomes aligned with "
        "the candidate's real background. Keep the cold pitch direct, respectful, and specific (3 lines max). "
        "Formulate sharp, realistic technical interview questions tailored to the role."
    ),
    "dispatcher": (
        "You are the Dispatcher Agent. Persist all evaluated job kits cleanly to SQLite and format "
        "concise, scannable Telegram digests highlighting top matches, scores, work types, and direct apply links."
    ),
}
