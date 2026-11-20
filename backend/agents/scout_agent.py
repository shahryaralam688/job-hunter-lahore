import asyncio
from typing import Any, Dict, List, Set

from agents.base import BaseAgent
from database import url_exists
from mock_data import get_mock_jobs
from models import AgentStatus


def _infer_work_type(title: str, location: str, description: str, is_remote: bool = False) -> str:
    combined = f"{title} {location} {description}".lower()
    if is_remote or "remote" in combined:
        if "hybrid" in combined:
            return "Hybrid"
        return "Remote"
    if "hybrid" in combined:
        return "Hybrid"
    return "On-site"


class ScoutAgent(BaseAgent):
    name = "scout"
    label = "Scout Agent"

    async def run(
        self,
        settings: Dict[str, Any],
        mock_mode: bool,
        category_queries: List[str] | None = None,
    ) -> Dict[str, Any]:
        self.start_timer()
        self.check_cancelled()

        keywords: List[str] = settings.get("keywords", [])
        location: str = settings.get("location", "Lahore, Pakistan")
        hours_old: int = int(settings.get("hours_old", 72))

        await self.set_state(
            AgentStatus.RUNNING,
            f"Scanning {'mock feed' if mock_mode else 'LinkedIn, Indeed & Google Jobs'} across Pakistan",
            0,
            len(category_queries or keywords),
        )

        raw_jobs: List[Dict[str, Any]] = []

        if mock_mode:
            await self.log("Mock/Test Mode active — loading simulated Pakistan & Remote job feed.")
            await asyncio.sleep(0.6)
            self.check_cancelled()
            raw_jobs = get_mock_jobs()
            await self.set_state(
                AgentStatus.RUNNING,
                f"Deduplicating {len(raw_jobs)} fetched postings",
                len(raw_jobs),
                len(raw_jobs),
            )
        else:
            from jobspy import scrape_jobs

            if category_queries:
                query_groups = category_queries[:20]
                search_targets = [
                    {"location": "Pakistan", "is_remote": False, "label": "Pakistan"},
                    {"location": "Pakistan", "is_remote": True, "label": "Remote"},
                ]
            else:
                query_groups = [
                    " OR ".join(keywords[:3]) if keywords else "Software Engineer",
                    " OR ".join(keywords[3:]) if len(keywords) > 3 else "TypeScript React",
                ]
                search_targets = [
                    {"location": location, "is_remote": False, "label": location},
                    {"location": "Pakistan", "is_remote": True, "label": "Remote"},
                ]

            total_steps = len(query_groups) * len(search_targets)
            step = 0

            for target in search_targets:
                for term in query_groups:
                    self.check_cancelled()
                    step += 1
                    await self.set_state(
                        AgentStatus.RUNNING,
                        f"Deep scraping '{term}' ({target['label']})",
                        step,
                        total_steps,
                    )
                    await self.log(f"Deep scraping LinkedIn, Indeed & Google: '{term}' in {target['label']} (last {hours_old}h)")
                    try:
                        df = await asyncio.to_thread(
                            scrape_jobs,
                            site_name=["linkedin", "indeed", "google"],
                            search_term=term,
                            location=target["location"],
                            results_wanted=10,
                            hours_old=hours_old,
                            country_indeed="Pakistan",
                            is_remote=target["is_remote"],
                            linkedin_fetch_description=True,
                        )
                        if df is not None and not df.empty:
                            for _, row in df.iterrows():
                                job_url = str(row.get("job_url") or "").strip()
                                if not job_url or job_url == "nan":
                                    continue
                                title = str(row.get("title") or "Untitled Role")
                                company = str(row.get("company") or "Unknown Company")
                                loc = str(row.get("location") or target["label"])
                                desc = str(row.get("description") or "")
                                if desc == "nan":
                                    desc = ""
                                raw_jobs.append(
                                    {
                                        "title": title,
                                        "company": company,
                                        "location": loc,
                                        "work_type": _infer_work_type(title, loc, desc, target["is_remote"]),
                                        "url": job_url,
                                        "source": str(row.get("site") or "linkedin").lower(),
                                        "description": desc[:6000],
                                        "posted_at": str(row.get("date_posted") or ""),
                                    }
                                )
                            await self.log(f"Found {len(df)} postings for '{term}' ({target['label']}).")
                        else:
                            await self.log(f"No postings returned for '{term}' ({target['label']}).")
                    except Exception as exc:
                        await self.log(
                            f"Scraper warning for '{term}' ({target['label']}): {exc}",
                            level="WARN",
                        )

        # Deduplicate within current batch and against SQLite
        seen_urls: Set[str] = set()
        new_jobs: List[Dict[str, Any]] = []
        duplicates = 0

        for job in raw_jobs:
            self.check_cancelled()
            url = job["url"]
            if url in seen_urls or url_exists(url):
                duplicates += 1
                continue
            seen_urls.add(url)
            new_jobs.append(job)

        await self.log(
            f"Scout complete: {len(raw_jobs)} scraped, {duplicates} duplicates skipped, {len(new_jobs)} new jobs queued."
        )
        await self.set_state(
            AgentStatus.COMPLETED,
            f"Queued {len(new_jobs)} new jobs ({duplicates} duplicates skipped)",
            len(new_jobs),
            len(raw_jobs),
        )

        return {
            "total_scraped": len(raw_jobs),
            "duplicates_skipped": duplicates,
            "jobs": new_jobs,
        }
