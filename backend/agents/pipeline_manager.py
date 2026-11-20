import asyncio
import time
from typing import Any, Dict, List, Optional, Set
from fastapi import WebSocket

from agents.base import PipelineCancelled
from agents.dispatcher_agent import DispatcherAgent
from agents.recruiter_agent import RecruiterAgent
from agents.scout_agent import ScoutAgent
from agents.writer_agent import WriterAgent
from database import add_agent_log, create_run, finish_run, get_settings
from models import AgentStateSnapshot, AgentStatus


class PipelineManager:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._task: Optional[asyncio.Task] = None
        self._cancel_requested: bool = False
        self._is_running: bool = False
        self._current_run_id: Optional[int] = None
        self._subscribers: Set[WebSocket] = set()

        self.agents: Dict[str, AgentStateSnapshot] = self._fresh_agent_states()

    @staticmethod
    def _fresh_agent_states() -> Dict[str, AgentStateSnapshot]:
        return {
            "scout": AgentStateSnapshot(name="scout", label="Scout Agent"),
            "recruiter": AgentStateSnapshot(name="recruiter", label="Recruiter Agent"),
            "writer": AgentStateSnapshot(name="writer", label="Writer Agent"),
            "dispatcher": AgentStateSnapshot(name="dispatcher", label="Dispatcher Agent"),
        }

    def get_snapshot(self) -> Dict[str, Any]:
        return {
            "is_running": self._is_running,
            "current_run_id": self._current_run_id,
            "agents": [a.model_dump() for a in self.agents.values()],
        }

    async def subscribe(self, ws: WebSocket) -> None:
        await ws.accept()
        self._subscribers.add(ws)
        await ws.send_json({"type": "snapshot", "data": self.get_snapshot()})

    def unsubscribe(self, ws: WebSocket) -> None:
        self._subscribers.discard(ws)

    async def _broadcast(self, payload: Dict[str, Any]) -> None:
        dead: List[WebSocket] = []
        for ws in list(self._subscribers):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._subscribers.discard(ws)

    async def emit_log(self, agent: str, level: str, message: str) -> None:
        log_row = add_agent_log(self._current_run_id, agent, level, message)
        await self._broadcast({"type": "log", "data": log_row})

    async def emit_state(
        self,
        agent: str,
        status: AgentStatus,
        current_task: str,
        items_processed: int,
        items_total: int,
        execution_time_ms: int,
    ) -> None:
        snap = self.agents[agent]
        snap.status = status
        snap.current_task = current_task
        snap.items_processed = items_processed
        snap.items_total = items_total
        snap.execution_time_ms = execution_time_ms
        await self._broadcast({"type": "snapshot", "data": self.get_snapshot()})

    async def start_pipeline(self, mock_mode_override: Optional[bool] = None) -> Dict[str, Any]:
        async with self._lock:
            if self._is_running:
                return {"started": False, "reason": "Pipeline is already running.", "run_id": self._current_run_id}

            self._cancel_requested = False
            self._is_running = True
            self.agents = self._fresh_agent_states()

            settings = get_settings()
            mock_mode = settings.get("mock_mode", True) if mock_mode_override is None else mock_mode_override
            mode_label = "MOCK" if mock_mode else "LIVE"
            self._current_run_id = create_run(mode_label)

            self._task = asyncio.create_task(self._execute(self._current_run_id, settings, mock_mode))
            return {"started": True, "run_id": self._current_run_id, "mode": mode_label}

    async def stop_pipeline(self) -> Dict[str, Any]:
        if not self._is_running:
            return {"stopped": False, "reason": "Pipeline is not running."}
        self._cancel_requested = True
        await self.emit_log("pipeline", "WARN", "Stop requested — halting agents at next checkpoint...")
        return {"stopped": True, "run_id": self._current_run_id}

    async def _execute(self, run_id: int, settings: Dict[str, Any], mock_mode: bool) -> None:
        t0 = time.perf_counter()
        total_scraped = 0
        total_new = 0
        total_shortlisted = 0
        final_status = "COMPLETED"
        error_message: Optional[str] = None

        await self._broadcast({"type": "snapshot", "data": self.get_snapshot()})
        await self.emit_log(
            "pipeline",
            "INFO",
            f"Pipeline Run #{run_id} started in {'MOCK/TEST' if mock_mode else 'LIVE'} mode.",
        )

        is_cancelled = lambda: self._cancel_requested

        try:
            scout = ScoutAgent(self.emit_log, self.emit_state, is_cancelled)
            recruiter = RecruiterAgent(self.emit_log, self.emit_state, is_cancelled)
            writer = WriterAgent(self.emit_log, self.emit_state, is_cancelled)
            dispatcher = DispatcherAgent(self.emit_log, self.emit_state, is_cancelled)

            # 1. Scout
            scout_res = await scout.run(settings, mock_mode)
            total_scraped = scout_res["total_scraped"]
            new_jobs = scout_res["jobs"]
            total_new = len(new_jobs)

            # 2. Recruiter
            recruiter_res = await recruiter.run(new_jobs, settings, mock_mode)
            all_evaluated = recruiter_res["evaluated"]
            shortlisted = recruiter_res["shortlisted"]
            total_shortlisted = len(shortlisted)

            # 3. Writer
            kits = await writer.run(shortlisted, settings, mock_mode)

            # 4. Dispatcher
            await dispatcher.run(run_id, all_evaluated, kits, settings)

            await self.emit_log(
                "pipeline",
                "INFO",
                f"Pipeline Run #{run_id} completed: {total_scraped} scraped, {total_new} new, {total_shortlisted} shortlisted.",
            )

        except PipelineCancelled as exc:
            final_status = "STOPPED"
            error_message = str(exc)
            await self.emit_log("pipeline", "WARN", f"Pipeline Run #{run_id} stopped: {exc}")
            for snap in self.agents.values():
                if snap.status == AgentStatus.RUNNING:
                    snap.status = AgentStatus.IDLE
                    snap.current_task = "Stopped by user"

        except Exception as exc:
            final_status = "ERROR"
            error_message = str(exc)
            await self.emit_log("pipeline", "ERROR", f"Pipeline Run #{run_id} failed: {exc}")
            for snap in self.agents.values():
                if snap.status == AgentStatus.RUNNING:
                    snap.status = AgentStatus.ERROR
                    snap.current_task = str(exc)[:120]

        finally:
            duration_ms = int((time.perf_counter() - t0) * 1000)
            finish_run(
                run_id=run_id,
                status=final_status,
                total_scraped=total_scraped,
                total_new=total_new,
                total_shortlisted=total_shortlisted,
                duration_ms=duration_ms,
                error_message=error_message,
            )
            self._is_running = False
            self._cancel_requested = False
            await self._broadcast({"type": "snapshot", "data": self.get_snapshot()})
            await self._broadcast(
                {
                    "type": "run_finished",
                    "data": {
                        "run_id": run_id,
                        "status": final_status,
                        "total_scraped": total_scraped,
                        "total_new": total_new,
                        "total_shortlisted": total_shortlisted,
                        "duration_ms": duration_ms,
                    },
                }
            )


pipeline_manager = PipelineManager()
