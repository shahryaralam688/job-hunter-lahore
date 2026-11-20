# Job Hunter Lahore — Multi-Agent AI Job Discovery & Application Kit System

A 100% free-tier, local-first Multi-Agent Job Hunter built with **FastAPI**, **SQLite**, **google-genai (`gemini-2.5-flash`)**, **python-jobspy**, and a live **Next.js (App Router) + Tailwind CSS** dashboard for finding tech jobs in **Lahore, Pakistan** (On-site, Hybrid, and Remote).

---

## Architecture

Four modular agents in `backend/agents/` orchestrated by `PipelineManager` with real-time WebSocket updates:

1. **Scout Agent (`scout_agent.py`)**: Scrapes LinkedIn & Indeed via `python-jobspy` for Lahore & Remote roles posted in the last 24–72h, deduplicating against SQLite by URL.
2. **Recruiter Agent (`recruiter_agent.py`)**: Evaluates each new job against your saved CV using Gemini `gemini-2.5-flash` structured JSON output (`match_score`, `fit_reason`, `missing_skills`, `salary_or_type`), filtering by your minimum score threshold.
3. **Writer Agent (`writer_agent.py`)**: Generates 3 tailored ATS-friendly CV bullets, a 3-line cold pitch, and 2 likely technical interview questions for every shortlisted job.
4. **Dispatcher Agent (`dispatcher_agent.py`)**: Persists all results to SQLite (`job_hunter.db`) and optionally sends a formatted digest via Telegram Bot API.

---

## Prerequisites

- **Python 3.11+**
- **Node.js 20+** (24 LTS recommended)
- **Gemini API Key** (Free Tier from [Google AI Studio](https://aistudio.google.com/apikey)) — *optional if using Mock/Test Mode*

---

## Setup & Running Locally

### 1. Environment Variables

Copy `.env.example` to `.env` in the repository root:

```bash
cp .env.example .env
```

Edit `.env` and add your `GEMINI_API_KEY` (and optional `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`).

### 2. Start the Backend (FastAPI + SQLite)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000` (health check: `http://localhost:8000/api/health`).

### 3. Start the Frontend (Next.js Dashboard)

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Open **`http://localhost:3000`** in your browser.

---

## Mock / Test Mode

Toggle **Mock Mode** in the dashboard header (enabled by default on first launch) to test the entire 4-agent pipeline, live WebSocket status cards, terminal activity log, and Application Kit drawer immediately without hitting LinkedIn/Indeed rate limits or consuming Gemini API quota. Use **Reset Mock Data** in the Jobs tab to clear simulated jobs and re-run tests.

---

## Dashboard Views

1. **Live Agent Monitor**: 4-card pipeline (`Scout → Recruiter → Writer → Dispatcher`), Run/Stop controls, Auto-Schedule toggle (9:00 AM PKT daily via APScheduler), and live streaming Activity Log.
2. **Shortlisted Jobs & Application Kits**: Filterable table of matched jobs sorted by score, with a slide-over drawer containing Job Description, Missing Skills, 1-click Copy CV Bullets, 1-click Copy Cold Pitch, Interview Questions, Direct Apply Link, and Status Tracker (`New`, `Applied`, `Interview`, `Rejected`).
3. **Agent Control & Config**: Edit your CV/Profile, Search Keywords, Location, Hours Old, Min Match Score, each agent's System Prompt (with Reset to Default), and Telegram toggle.
4. **Run History & Stats**: Historical pipeline runs with timestamps, mode, scraped/shortlisted counts, duration, and errors.
