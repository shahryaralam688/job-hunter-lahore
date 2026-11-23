import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from config import (
    DATABASE_PATH,
    DEFAULT_CV_TEXT,
    DEFAULT_HOURS_OLD,
    DEFAULT_KEYWORDS,
    DEFAULT_LOCATION,
    DEFAULT_MIN_MATCH_SCORE,
    DEFAULT_SYSTEM_PROMPTS,
)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def get_conn():
    conn = sqlite3.connect(DATABASE_PATH, check_same_thread=False, timeout=30.0)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA foreign_keys=ON;")
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                company TEXT NOT NULL,
                location TEXT NOT NULL,
                work_type TEXT NOT NULL DEFAULT 'On-site',
                url TEXT NOT NULL UNIQUE,
                source TEXT NOT NULL DEFAULT 'linkedin',
                description TEXT NOT NULL DEFAULT '',
                posted_at TEXT,
                match_score REAL NOT NULL DEFAULT 0,
                fit_reason TEXT NOT NULL DEFAULT '',
                missing_skills TEXT NOT NULL DEFAULT '[]',
                salary_or_type TEXT NOT NULL DEFAULT '',
                cv_bullets TEXT NOT NULL DEFAULT '[]',
                cold_pitch TEXT NOT NULL DEFAULT '',
                interview_questions TEXT NOT NULL DEFAULT '[]',
                shortlisted INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'New',
                run_id INTEGER,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                started_at TEXT NOT NULL,
                finished_at TEXT,
                status TEXT NOT NULL,
                mode TEXT NOT NULL DEFAULT 'MOCK',
                total_scraped INTEGER NOT NULL DEFAULT 0,
                total_new INTEGER NOT NULL DEFAULT 0,
                total_shortlisted INTEGER NOT NULL DEFAULT 0,
                duration_ms INTEGER NOT NULL DEFAULT 0,
                error_message TEXT
            );

            CREATE TABLE IF NOT EXISTS agent_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER,
                agent TEXT NOT NULL,
                level TEXT NOT NULL DEFAULT 'INFO',
                message TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            """
        )

        defaults = {
            "cv_text": DEFAULT_CV_TEXT,
            "keywords": DEFAULT_KEYWORDS,
            "location": DEFAULT_LOCATION,
            "hours_old": DEFAULT_HOURS_OLD,
            "min_match_score": DEFAULT_MIN_MATCH_SCORE,
            "telegram_enabled": False,
            "auto_schedule_enabled": False,
            "mock_mode": True,
            "prompts": DEFAULT_SYSTEM_PROMPTS,
        }
        for key, val in defaults.items():
            conn.execute(
                "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
                (key, json.dumps(val)),
            )


def get_settings() -> Dict[str, Any]:
    with get_conn() as conn:
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
    result: Dict[str, Any] = {}
    for row in rows:
        result[row["key"]] = json.loads(row["value"])
    return result


def update_settings(data: Dict[str, Any]) -> Dict[str, Any]:
    with get_conn() as conn:
        for key, val in data.items():
            conn.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (key, json.dumps(val)),
            )
    return get_settings()


def url_exists(url: str) -> bool:
    with get_conn() as conn:
        row = conn.execute("SELECT 1 FROM jobs WHERE url = ? LIMIT 1", (url,)).fetchone()
    return row is not None


def title_company_exists(title: str, company: str) -> bool:
    t = " ".join(title.lower().split())
    c = " ".join(company.lower().split())
    if not t or not c or c in ("unknown company", "employer", "pakistan employer (jobz.pk)"):
        return False
    with get_conn() as conn:
        row = conn.execute(
            "SELECT 1 FROM jobs WHERE lower(trim(title)) = ? AND lower(trim(company)) = ? LIMIT 1",
            (t, c),
        ).fetchone()
    return row is not None


def save_job(job: Dict[str, Any]) -> Optional[int]:
    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT OR IGNORE INTO jobs (
                title, company, location, work_type, url, source, description, posted_at,
                match_score, fit_reason, missing_skills, salary_or_type,
                cv_bullets, cold_pitch, interview_questions,
                shortlisted, status, run_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                job["title"],
                job["company"],
                job["location"],
                job.get("work_type", "On-site"),
                job["url"],
                job.get("source", "linkedin"),
                job.get("description", ""),
                job.get("posted_at"),
                float(job.get("match_score", 0.0)),
                job.get("fit_reason", ""),
                json.dumps(job.get("missing_skills", [])),
                job.get("salary_or_type", ""),
                json.dumps(job.get("cv_bullets", [])),
                job.get("cold_pitch", ""),
                json.dumps(job.get("interview_questions", [])),
                1 if job.get("shortlisted") else 0,
                job.get("status", "New"),
                job.get("run_id"),
                job.get("created_at") or utc_now_iso(),
            ),
        )
        return cur.lastrowid if cur.rowcount > 0 else None


def _row_to_job(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "company": row["company"],
        "location": row["location"],
        "work_type": row["work_type"],
        "url": row["url"],
        "source": row["source"],
        "description": row["description"],
        "posted_at": row["posted_at"],
        "match_score": row["match_score"],
        "fit_reason": row["fit_reason"],
        "missing_skills": json.loads(row["missing_skills"] or "[]"),
        "salary_or_type": row["salary_or_type"],
        "cv_bullets": json.loads(row["cv_bullets"] or "[]"),
        "cold_pitch": row["cold_pitch"],
        "interview_questions": json.loads(row["interview_questions"] or "[]"),
        "shortlisted": bool(row["shortlisted"]),
        "status": row["status"],
        "run_id": row["run_id"],
        "created_at": row["created_at"],
    }


def list_jobs(shortlisted_only: bool = True) -> List[Dict[str, Any]]:
    query = "SELECT * FROM jobs"
    if shortlisted_only:
        query += " WHERE shortlisted = 1"
    query += " ORDER BY match_score DESC, id DESC"
    with get_conn() as conn:
        rows = conn.execute(query).fetchall()
    return [_row_to_job(r) for r in rows]


def update_job_status(job_id: int, status: str) -> Optional[Dict[str, Any]]:
    with get_conn() as conn:
        cur = conn.execute("UPDATE jobs SET status = ? WHERE id = ?", (status, job_id))
        if cur.rowcount == 0:
            return None
        row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    return _row_to_job(row) if row else None


def clear_mock_jobs() -> int:
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM jobs WHERE source = 'mock'")
        return cur.rowcount


def create_run(mode: str) -> int:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO runs (started_at, status, mode) VALUES (?, 'RUNNING', ?)",
            (utc_now_iso(), mode),
        )
        return cur.lastrowid


def finish_run(
    run_id: int,
    status: str,
    total_scraped: int,
    total_new: int,
    total_shortlisted: int,
    duration_ms: int,
    error_message: Optional[str] = None,
) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            UPDATE runs
            SET finished_at = ?, status = ?, total_scraped = ?, total_new = ?,
                total_shortlisted = ?, duration_ms = ?, error_message = ?
            WHERE id = ?
            """,
            (
                utc_now_iso(),
                status,
                total_scraped,
                total_new,
                total_shortlisted,
                duration_ms,
                error_message,
                run_id,
            ),
        )


def list_runs(limit: int = 50) -> List[Dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM runs ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
    return [dict(r) for r in rows]


def add_agent_log(run_id: Optional[int], agent: str, level: str, message: str) -> Dict[str, Any]:
    created_at = utc_now_iso()
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO agent_logs (run_id, agent, level, message, created_at) VALUES (?, ?, ?, ?, ?)",
            (run_id, agent, level, message, created_at),
        )
        log_id = cur.lastrowid
    return {
        "id": log_id,
        "run_id": run_id,
        "agent": agent,
        "level": level,
        "message": message,
        "created_at": created_at,
    }


def list_recent_logs(limit: int = 120) -> List[Dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM agent_logs ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
    return [dict(r) for r in reversed(rows)]
