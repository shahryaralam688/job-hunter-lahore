from typing import Any, Dict, List

import httpx

from agents.base import BaseAgent
from config import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
from database import save_job
from models import AgentStatus


class DispatcherAgent(BaseAgent):
    name = "dispatcher"
    label = "Dispatcher Agent"

    async def run(
        self,
        run_id: int,
        all_evaluated: List[Dict[str, Any]],
        kits: List[Dict[str, Any]],
        settings: Dict[str, Any],
    ) -> Dict[str, Any]:
        self.start_timer()
        self.check_cancelled()

        kit_by_url = {k["url"]: k for k in kits}
        total = len(all_evaluated)

        await self.set_state(
            AgentStatus.RUNNING,
            f"Saving {total} evaluated records to SQLite",
            0,
            total,
        )

        saved_shortlisted = 0
        saved_total = 0

        for idx, job in enumerate(all_evaluated, start=1):
            self.check_cancelled()
            record = kit_by_url.get(job["url"], job)
            record["run_id"] = run_id
            inserted_id = save_job(record)
            if inserted_id:
                saved_total += 1
                if record.get("shortlisted"):
                    saved_shortlisted += 1
            await self.set_state(
                AgentStatus.RUNNING,
                f"Persisting {record['title']} @ {record['company']}",
                idx,
                total,
            )

        await self.log(
            f"Saved {saved_total} jobs to SQLite ({saved_shortlisted} shortlisted application kits)."
        )

        # Optional Telegram digest
        telegram_enabled = bool(settings.get("telegram_enabled", False))
        telegram_sent = False

        if telegram_enabled and kits:
            if TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID:
                await self.set_state(
                    AgentStatus.RUNNING,
                    "Sending Telegram digest",
                    total,
                    total,
                )
                top_matches = sorted(kits, key=lambda x: x["match_score"], reverse=True)[:5]
                lines = [f"<b>Job Hunter Lahore — {len(kits)} New Match(es)</b>\n"]
                for m in top_matches:
                    lines.append(
                        f"• <b>{m['title']}</b> @ {m['company']} "
                        f"({m['match_score']:.1f}/10 · {m.get('work_type', 'On-site')})\n"
                        f"  <i>{m.get('fit_reason', '')}</i>\n"
                        f"  <a href=\"{m['url']}\">Apply Link</a>"
                    )
                text = "\n\n".join(lines)
                try:
                    async with httpx.AsyncClient(timeout=15.0) as client:
                        resp = await client.post(
                            f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                            json={
                                "chat_id": TELEGRAM_CHAT_ID,
                                "text": text,
                                "parse_mode": "HTML",
                                "disable_web_page_preview": True,
                            },
                        )
                        if resp.status_code == 200:
                            telegram_sent = True
                            await self.log("Telegram digest sent successfully.")
                        else:
                            await self.log(
                                f"Telegram API returned {resp.status_code}: {resp.text[:200]}",
                                level="WARN",
                            )
                except Exception as exc:
                    await self.log(f"Telegram dispatch failed: {exc}", level="WARN")
            else:
                await self.log(
                    "Telegram toggle is ON, but TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID are not set in .env.",
                    level="WARN",
                )

        await self.set_state(
            AgentStatus.COMPLETED,
            f"Saved {saved_shortlisted} kits" + (" · Telegram sent" if telegram_sent else ""),
            total,
            total,
        )
        return {"saved_total": saved_total, "saved_shortlisted": saved_shortlisted, "telegram_sent": telegram_sent}
