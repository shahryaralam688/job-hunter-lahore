from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List


def get_mock_jobs() -> List[Dict[str, Any]]:
    now = datetime.now(timezone.utc)
    return [
        {
            "title": "Senior iOS Engineer (Swift / SwiftUI)",
            "company": "Arbisoft",
            "location": "Lahore, Pakistan",
            "work_type": "Hybrid",
            "url": "https://www.linkedin.com/jobs/view/mock-arbisoft-ios-lahore-101",
            "source": "mock",
            "posted_at": (now - timedelta(hours=6)).isoformat(),
            "description": (
                "Arbisoft is looking for a Senior iOS Engineer in Lahore (Hybrid) to lead consumer mobile "
                "experiences. Requirements: 3+ years with Swift, SwiftUI, UIKit, Combine, REST APIs, and "
                "App Store release pipelines. Nice to have: CoreData, modular architecture, CI/CD with GitHub Actions. "
                "Compensation: PKR 320,000 - 450,000/month + medical & annual bonus."
            ),
        },
        {
            "title": "Full-Stack Next.js & TypeScript Developer",
            "company": "Devsinc",
            "location": "Lahore, Pakistan",
            "work_type": "On-site",
            "url": "https://www.linkedin.com/jobs/view/mock-devsinc-nextjs-lahore-102",
            "source": "mock",
            "posted_at": (now - timedelta(hours=14)).isoformat(),
            "description": (
                "Join Devsinc's Lahore engineering hub to build high-traffic SaaS products using Next.js (App Router), "
                "React 18+, TypeScript, Tailwind CSS, and PostgreSQL. Strong understanding of SSR, API design, "
                "and performance optimization required. Competitive PKR package + provident fund."
            ),
        },
        {
            "title": "Unity AR / Spatial Computing Engineer",
            "company": "Tintash",
            "location": "Lahore, Pakistan",
            "work_type": "Hybrid",
            "url": "https://pk.indeed.com/viewjob?jk=mock-tintash-unity-ar-103",
            "source": "mock",
            "posted_at": (now - timedelta(hours=22)).isoformat(),
            "description": (
                "Tintash is hiring a Unity AR Developer in Lahore (Hybrid) for interactive iOS/Android ARKit & "
                "ARFoundation experiences. Must know Unity 3D, C#, ARKit, shader optimization, and mobile profiling. "
                "Swift bridging experience is a strong plus."
            ),
        },
        {
            "title": "Frontend Engineer (React / TypeScript) — EMEA/PK Remote",
            "company": "RemoteFlow Labs",
            "location": "Remote (Pakistan Eligible)",
            "work_type": "Remote",
            "url": "https://www.linkedin.com/jobs/view/mock-remoteflow-react-104",
            "source": "mock",
            "posted_at": (now - timedelta(hours=9)).isoformat(),
            "description": (
                "100% Remote role open to engineers in Pakistan. Build sleek analytics dashboards in React, "
                "TypeScript, Next.js, and Tailwind CSS. Async-first culture, overlap with UK/EU mornings. "
                "Compensation: $2,400 - $3,200 USD/month."
            ),
        },
        {
            "title": "iOS & React Native Mobile Lead",
            "company": "Systems Limited",
            "location": "Lahore, Pakistan",
            "work_type": "On-site",
            "url": "https://www.linkedin.com/jobs/view/mock-systems-ios-lead-105",
            "source": "mock",
            "posted_at": (now - timedelta(hours=30)).isoformat(),
            "description": (
                "Systems Limited (DHA Lahore) seeks a Mobile Lead skilled in Swift, UIKit/SwiftUI, and React/TypeScript "
                "cross-platform architecture for enterprise banking apps. 4+ years experience required."
            ),
        },
        {
            "title": "Senior Java Spring Boot Microservices Engineer",
            "company": "Tkxel",
            "location": "Lahore, Pakistan",
            "work_type": "On-site",
            "url": "https://pk.indeed.com/viewjob?jk=mock-tkxel-java-106",
            "source": "mock",
            "posted_at": (now - timedelta(hours=18)).isoformat(),
            "description": (
                "Looking for a Senior Java Developer with 5+ years in Spring Boot, Kafka, Kubernetes, Oracle DB, "
                "and enterprise banking integrations. On-site in Gulberg, Lahore."
            ),
        },
    ]
