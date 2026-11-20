import time
from typing import Awaitable, Callable, Optional
from models import AgentStatus


class PipelineCancelled(Exception):
    """Raised when the user requests to stop the pipeline mid-run."""


LogCallback = Callable[[str, str, str], Awaitable[None]]
StateCallback = Callable[[str, AgentStatus, str, int, int, int], Awaitable[None]]


class BaseAgent:
    name: str = "base"
    label: str = "Base Agent"

    def __init__(
        self,
        emit_log: LogCallback,
        emit_state: StateCallback,
        is_cancelled: Callable[[], bool],
    ) -> None:
        self._emit_log = emit_log
        self._emit_state = emit_state
        self._is_cancelled = is_cancelled
        self._start_ts: float = 0.0

    def start_timer(self) -> None:
        self._start_ts = time.perf_counter()

    def elapsed_ms(self) -> int:
        if not self._start_ts:
            return 0
        return int((time.perf_counter() - self._start_ts) * 1000)

    def check_cancelled(self) -> None:
        if self._is_cancelled():
            raise PipelineCancelled(f"{self.label} stopped by user.")

    async def log(self, message: str, level: str = "INFO") -> None:
        await self._emit_log(self.name, level, message)

    async def set_state(
        self,
        status: AgentStatus,
        current_task: str,
        items_processed: int = 0,
        items_total: int = 0,
    ) -> None:
        await self._emit_state(
            self.name,
            status,
            current_task,
            items_processed,
            items_total,
            self.elapsed_ms(),
        )
