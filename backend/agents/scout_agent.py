import asyncio
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Set

import httpx
from bs4 import BeautifulSoup

from agents.base import BaseAgent
from config import (
    ADZUNA_APP_ID,
    ADZUNA_APP_KEY,
    GOOGLE_SHEET_WEBHOOK_URL,
    JOOBLE_API_KEY,
    RAPIDAPI_KEY,
)
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


def _classify_job_category(job: Dict[str, Any], categories: List[Dict[str, Any]]) -> str:
    text = f"{job.get('title', '')} {job.get('description', '')[:500]}".lower()
    if any(k in text for k in ("bank", "fintech", "credit", "core banking", "payment")):
        return "Banking & FinTech IT Department"
    if any(k in text for k in ("lecturer", "professor", "faculty", "university", "lab engineer")):
        return "University CS Lecturer / Lab Engineer"
    if any(k in text for k in ("pitb", "nadra", "sbp", "assistant director", "govt", "government")):
        return "Government & Public Sector IT"
    if any(k in text for k in ("ios", "swift", "swiftui", "android", "flutter", "react native", "mobile")):
        return "Mobile & iOS Engineering"
    if any(k in text for k in ("ai ", "machine learning", "ml ", "llm", "genai", "data scientist")):
        return "AI / Machine Learning & LLM Agents"
    if any(k in text for k in ("devops", "cloud", "aws", "gcp", "kubernetes", "docker", "sre")):
        return "Cloud, DevOps & SRE"
    if any(k in text for k in ("cyber", "infosec", "security", "soc ")):
        return "Cybersecurity & Bank InfoSec"
    if any(k in text for k in ("qa ", "quality assurance", "selenium", "playwright", "automation test")):
        return "QA Automation & Software Testing"
    if any(k in text for k in ("unity", "ar ", "vr ", "arkit", "game")):
        return "AR/VR, Unity & Spatial Computing"
    if any(k in text for k in ("erp", "sap", "oracle", "database", "dba")):
        return "ERP, SAP, Oracle & Enterprise IT"
    if any(k in text for k in ("project manager", "product manager", "scrum")):
        return "Technical Project / Product Management"
    if job.get("work_type") == "Remote":
        return "Global Remote Software Engineering"
    if categories:
        return str(categories[0].get("category", "Software & Full-Stack Engineering"))
    return "Software & Full-Stack Engineering"


async def _fetch_remoteok(limit: int = 12) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
        resp = await client.get(
            "https://remoteok.com/api",
            headers={"User-Agent": "JobHunterLahore/1.0"},
        )
        resp.raise_for_status()
        data = resp.json()
        for item in data[1:]:
            if not isinstance(item, dict):
                continue
            url = str(item.get("url") or item.get("apply_url") or "").strip()
            title = str(item.get("position") or "").strip()
            if not url or not title:
                continue
            results.append(
                {
                    "title": title,
                    "company": str(item.get("company") or "Remote Company"),
                    "location": str(item.get("location") or "Global Remote"),
                    "work_type": "Remote",
                    "url": url,
                    "source": "remoteok",
                    "description": BeautifulSoup(str(item.get("description") or ""), "html.parser").get_text(" ", strip=True)[:6000],
                    "posted_at": str(item.get("date") or ""),
                }
            )
            if len(results) >= limit:
                break
    return results


async def _fetch_remotive(limit: int = 12) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
        resp = await client.get("https://remotive.com/api/remote-jobs?category=software-dev&limit=20")
        resp.raise_for_status()
        jobs = resp.json().get("jobs", [])
        for item in jobs:
            url = str(item.get("url") or "").strip()
            title = str(item.get("title") or "").strip()
            if not url or not title:
                continue
            results.append(
                {
                    "title": title,
                    "company": str(item.get("company_name") or "Remote Company"),
                    "location": str(item.get("candidate_required_location") or "Worldwide Remote"),
                    "work_type": "Remote",
                    "url": url,
                    "source": "remotive",
                    "description": BeautifulSoup(str(item.get("description") or ""), "html.parser").get_text(" ", strip=True)[:6000],
                    "posted_at": str(item.get("publication_date") or ""),
                }
            )
            if len(results) >= limit:
                break
    return results


async def _fetch_weworkremotely(limit: int = 10) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
        resp = await client.get("https://weworkremotely.com/categories/remote-programming-jobs.rss")
        resp.raise_for_status()
        root = ET.fromstring(resp.text)
        for item in root.findall("./channel/item"):
            title = (item.findtext("title") or "").strip()
            url = (item.findtext("link") or "").strip()
            desc = BeautifulSoup(item.findtext("description") or "", "html.parser").get_text(" ", strip=True)
            if not url or not title:
                continue
            company = title.split(":", 1)[0].strip() if ":" in title else "WeWorkRemotely"
            clean_title = title.split(":", 1)[1].strip() if ":" in title else title
            results.append(
                {
                    "title": clean_title,
                    "company": company,
                    "location": "Remote",
                    "work_type": "Remote",
                    "url": url,
                    "source": "weworkremotely",
                    "description": desc[:6000],
                    "posted_at": (item.findtext("pubDate") or "").strip(),
                }
            )
            if len(results) >= limit:
                break
    return results


async def _fetch_arbeitnow(limit: int = 15) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
        resp = await client.get("https://www.arbeitnow.com/api/job-board-api")
        resp.raise_for_status()
        for item in resp.json().get("data", []):
            url = str(item.get("url") or "").strip()
            title = str(item.get("title") or "").strip()
            if not url or not title:
                continue
            is_remote = bool(item.get("remote", False))
            loc = str(item.get("location") or ("Remote" if is_remote else "Global"))
            desc = BeautifulSoup(str(item.get("description") or ""), "html.parser").get_text(" ", strip=True)
            results.append(
                {
                    "title": title,
                    "company": str(item.get("company_name") or "Tech Company"),
                    "location": loc,
                    "work_type": "Remote" if is_remote else _infer_work_type(title, loc, desc, False),
                    "url": url,
                    "source": "arbeitnow",
                    "description": desc[:6000],
                    "posted_at": str(item.get("created_at") or ""),
                }
            )
            if len(results) >= limit:
                break
    return results


async def _fetch_himalayas(limit: int = 15) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
        resp = await client.get("https://himalayas.app/jobs/api?limit=25")
        resp.raise_for_status()
        for item in resp.json().get("jobs", []):
            url = str(item.get("applicationLink") or item.get("guid") or "").strip()
            title = str(item.get("title") or "").strip()
            if not url or not title:
                continue
            desc = BeautifulSoup(str(item.get("description") or item.get("excerpt") or ""), "html.parser").get_text(" ", strip=True)
            results.append(
                {
                    "title": title,
                    "company": str(item.get("companyName") or "Remote Company"),
                    "location": ", ".join(item.get("locationRestrictions") or []) or "Worldwide Remote",
                    "work_type": "Remote",
                    "url": url,
                    "source": "himalayas",
                    "description": desc[:6000],
                    "posted_at": str(item.get("pubDate") or ""),
                }
            )
            if len(results) >= limit:
                break
    return results


async def _fetch_jooble(limit: int = 25) -> List[Dict[str, Any]]:
    if not JOOBLE_API_KEY:
        return []
    results: List[Dict[str, Any]] = []
    queries = [
        {"keywords": "Software Engineer", "location": "Pakistan"},
        {"keywords": "IT Officer Developer", "location": "Pakistan"},
        {"keywords": "Remote Software Developer", "location": ""},
    ]
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        for q in queries:
            try:
                resp = await client.post(
                    f"https://jooble.org/api/{JOOBLE_API_KEY}",
                    json=q,
                    headers={"Content-Type": "application/json"},
                )
                if resp.status_code != 200:
                    continue
                for item in resp.json().get("jobs", []):
                    url = str(item.get("link") or "").strip()
                    title = str(item.get("title") or "").strip()
                    if not url or not title:
                        continue
                    loc = str(item.get("location") or q["location"] or "Remote")
                    snippet = BeautifulSoup(str(item.get("snippet") or ""), "html.parser").get_text(" ", strip=True)
                    results.append(
                        {
                            "title": title,
                            "company": str(item.get("company") or "Jooble Employer"),
                            "location": loc,
                            "work_type": _infer_work_type(title, loc, snippet, "remote" in loc.lower()),
                            "url": url,
                            "source": "jooble",
                            "description": snippet[:6000],
                            "posted_at": str(item.get("updated") or ""),
                        }
                    )
                    if len(results) >= limit:
                        return results
            except Exception:
                continue
    return results


async def _fetch_adzuna(limit: int = 15) -> List[Dict[str, Any]]:
    if not (ADZUNA_APP_ID and ADZUNA_APP_KEY):
        return []
    results: List[Dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
        resp = await client.get(
            "https://api.adzuna.com/v1/api/jobs/gb/search/1",
            params={
                "app_id": ADZUNA_APP_ID,
                "app_key": ADZUNA_APP_KEY,
                "what": "remote software engineer",
                "results_per_page": limit,
            },
        )
        resp.raise_for_status()
        for item in resp.json().get("results", []):
            url = str(item.get("redirect_url") or "").strip()
            title = str(item.get("title") or "").strip()
            if not url or not title:
                continue
            results.append(
                {
                    "title": title,
                    "company": str((item.get("company") or {}).get("display_name") or "Adzuna Employer"),
                    "location": str((item.get("location") or {}).get("display_name") or "Remote"),
                    "work_type": "Remote",
                    "url": url,
                    "source": "adzuna",
                    "description": str(item.get("description") or "")[:6000],
                    "posted_at": str(item.get("created") or ""),
                }
            )
    return results


async def _fetch_jsearch(limit: int = 15) -> List[Dict[str, Any]]:
    if not RAPIDAPI_KEY:
        return []
    results: List[Dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        resp = await client.get(
            "https://jsearch.p.rapidapi.com/search",
            params={"query": "Software Engineer in Pakistan", "num_pages": "1"},
            headers={
                "X-RapidAPI-Key": RAPIDAPI_KEY,
                "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
            },
        )
        resp.raise_for_status()
        for item in resp.json().get("data", [])[:limit]:
            url = str(item.get("job_apply_link") or item.get("job_google_link") or "").strip()
            title = str(item.get("job_title") or "").strip()
            if not url or not title:
                continue
            loc = ", ".join(filter(None, [item.get("job_city"), item.get("job_country")])) or "Pakistan"
            results.append(
                {
                    "title": title,
                    "company": str(item.get("employer_name") or "Employer"),
                    "location": loc,
                    "work_type": "Remote" if item.get("job_is_remote") else "On-site",
                    "url": url,
                    "source": "jsearch",
                    "description": str(item.get("job_description") or "")[:6000],
                    "posted_at": str(item.get("job_posted_at_datetime_utc") or ""),
                }
            )
    return results


async def _fetch_jobz_pk(limit: int = 12) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    urls = [
        "https://www.jobz.pk/it-software-jobs/",
        "https://www.jobz.pk/jobs-in-lahore/",
    ]
    async with httpx.AsyncClient(
        timeout=12.0,
        follow_redirects=True,
        headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"},
    ) as client:
        for page_url in urls:
            try:
                resp = await client.get(page_url)
                if resp.status_code != 200:
                    continue
                soup = BeautifulSoup(resp.text, "html.parser")
                for a in soup.select("a[href]"):
                    href = str(a.get("href") or "").strip()
                    text = a.get_text(" ", strip=True)
                    if (
                        "jobz.pk" in href
                        and href.endswith(".html")
                        and len(text) > 12
                        and not any(r["url"] == href for r in results)
                    ):
                        results.append(
                            {
                                "title": text[:160],
                                "company": "Pakistan Employer (Jobz.pk)",
                                "location": "Pakistan",
                                "work_type": "On-site",
                                "url": href,
                                "source": "jobz.pk",
                                "description": f"{text} — Listed on Jobz.pk Pakistan.",
                                "posted_at": "",
                            }
                        )
                    if len(results) >= limit:
                        break
            except Exception:
                continue
    return results


class ScoutAgent(BaseAgent):
    name = "scout"
    label = "Scout Agent"

    async def run(
        self,
        settings: Dict[str, Any],
        mock_mode: bool,
        category_queries: List[str] | None = None,
        categories: List[Dict[str, Any]] | None = None,
    ) -> Dict[str, Any]:
        self.start_timer()
        self.check_cancelled()

        keywords: List[str] = settings.get("keywords", [])
        location: str = settings.get("location", "Lahore, Pakistan")
        hours_old: int = int(settings.get("hours_old", 72))

        await self.set_state(
            AgentStatus.RUNNING,
            f"Harvesting {'mock feed' if mock_mode else 'all IT portals & free APIs'}",
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

            feed_fetchers = [
                ("Jooble API", _fetch_jooble),
                ("Arbeitnow API", _fetch_arbeitnow),
                ("Himalayas API", _fetch_himalayas),
                ("RemoteOK API", _fetch_remoteok),
                ("Remotive API", _fetch_remotive),
                ("WeWorkRemotely RSS", _fetch_weworkremotely),
                ("Jobz.pk Pakistan", _fetch_jobz_pk),
            ]
            if ADZUNA_APP_ID and ADZUNA_APP_KEY:
                feed_fetchers.append(("Adzuna API", _fetch_adzuna))
            if RAPIDAPI_KEY:
                feed_fetchers.append(("JSearch RapidAPI", _fetch_jsearch))

            total_steps = len(query_groups) * len(search_targets) + len(feed_fetchers)
            step = 0

            # Layer 1: Free APIs & Pakistan Local Feed (Fastest first)
            for feed_name, fetcher in feed_fetchers:
                self.check_cancelled()
                step += 1
                await self.set_state(
                    AgentStatus.RUNNING,
                    f"Fetching {feed_name}...",
                    step,
                    total_steps,
                )
                try:
                    fetched = await fetcher()
                    raw_jobs.extend(fetched)
                    if fetched:
                        await self.log(f"Fetched {len(fetched)} postings from {feed_name}.")
                except Exception as exc:
                    await self.log(f"{feed_name} fetch warning: {exc}", level="WARN")

            # Layer 2: jobspy (LinkedIn, Indeed, Google Jobs, Glassdoor)
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
                    await self.log(
                        f"Deep scraping LinkedIn, Indeed, Google & Glassdoor: '{term}' in {target['label']} (last {hours_old}h)"
                    )
                    try:
                        df = await asyncio.to_thread(
                            scrape_jobs,
                            site_name=["linkedin", "indeed", "google", "glassdoor"],
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

        # Deduplicate against current batch and SQLite
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
            job["category"] = _classify_job_category(job, categories or [])
            new_jobs.append(job)

        # Sync ALL newly discovered jobs to Google Sheet webhook if configured
        if GOOGLE_SHEET_WEBHOOK_URL and new_jobs and not mock_mode:
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    await client.post(
                        GOOGLE_SHEET_WEBHOOK_URL,
                        json={"type": "raw_jobs", "jobs": new_jobs},
                    )
                await self.log(f"Listed {len(new_jobs)} new IT jobs in Google Sheet master list.")
            except Exception as exc:
                await self.log(f"Google Sheet raw-jobs sync skipped ({exc})", level="WARN")

        # Pass first 30 new jobs forward to Recruiter/Writer pipeline
        batch_for_pipeline = new_jobs[:30]

        await self.log(
            f"Scout complete: {len(raw_jobs)} scraped, {duplicates} duplicates skipped, "
            f"{len(new_jobs)} new jobs found -> passing first {len(batch_for_pipeline)} to next agents."
        )
        await self.set_state(
            AgentStatus.COMPLETED,
            f"{len(new_jobs)} new jobs ({len(batch_for_pipeline)} queued for details, {duplicates} skipped)",
            len(batch_for_pipeline),
            len(raw_jobs),
        )

        return {
            "total_scraped": len(raw_jobs),
            "duplicates_skipped": duplicates,
            "total_new_found": len(new_jobs),
            "jobs": batch_for_pipeline,
        }
