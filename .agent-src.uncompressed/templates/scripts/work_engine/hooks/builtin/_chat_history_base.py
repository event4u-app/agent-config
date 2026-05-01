"""Shared plumbing for chat-history hooks.

Subprocess-driven so the work-engine package stays decoupled from
``scripts/chat_history.py``'s internals. The ``runner`` injection
point is the test seam — production passes ``subprocess.run``,
tests pass a fake.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from typing import Callable, Sequence

from ..context import HookContext
from ..exceptions import HookError

ProcessRunner = Callable[[Sequence[str]], "subprocess.CompletedProcess[str]"]
"""Callable that runs a subprocess. Production default: ``_default_runner``."""

EXIT_OK = 0
EXIT_MISSING = 10
EXIT_FOREIGN = 11
EXIT_RETURNING = 12


def _default_runner(cmd: Sequence[str]) -> "subprocess.CompletedProcess[str]":
    return subprocess.run(list(cmd), capture_output=True, text=True, check=False)


def _derive_first_user_msg(ctx: HookContext) -> str | None:
    """Pull a stable first-user-msg out of the available context.

    CLI-layer events carry ``ctx.work`` (the v1 envelope); dispatcher-layer
    events (``before_step`` / ``after_step`` / ``on_halt``) carry only
    ``ctx.delivery`` (the legacy :class:`DeliveryState`). Both shapes feed
    the same ``id: title`` / ``raw`` derivation so chat-history entries
    stay stable across the lifecycle. Returns ``None`` when the shape is
    unknown — callers raise ``HookError`` so the runner converts it to
    a warning.
    """
    work = ctx.work
    if work is not None and getattr(work, "input", None) is not None:
        inp = work.input
        data = getattr(inp, "data", None) or {}
        kind = getattr(inp, "kind", None)
        if kind == "prompt":
            raw = data.get("raw")
            if raw:
                return str(raw)
        elif kind == "ticket":
            joined = _ticket_msg(data)
            if joined:
                return joined

    delivery = ctx.delivery
    if delivery is not None:
        ticket = getattr(delivery, "ticket", None) or {}
        joined = _ticket_msg(ticket)
        if joined:
            return joined
    return None


def _ticket_msg(ticket: dict) -> str:
    ticket_id = ticket.get("id") or ""
    title = ticket.get("title") or ""
    return f"{ticket_id}: {title}".strip(": ").strip()


class _ChatHistoryHookBase:
    """Shared plumbing — script path, runner, and first-msg derivation."""

    def __init__(
        self,
        script_path: Path,
        *,
        runner: ProcessRunner | None = None,
        first_user_msg: str | None = None,
    ) -> None:
        self.script_path = Path(script_path)
        self._runner = runner or _default_runner
        self._fixed_msg = first_user_msg

    def _resolve_msg(self, ctx: HookContext) -> str:
        msg = self._fixed_msg or _derive_first_user_msg(ctx)
        if not msg:
            raise HookError("chat-history hook: cannot derive first-user-msg")
        return msg

    def _invoke(self, *args: str) -> "subprocess.CompletedProcess[str]":
        cmd = [sys.executable, str(self.script_path), *args]
        return self._runner(cmd)


__all__ = [
    "EXIT_FOREIGN",
    "EXIT_MISSING",
    "EXIT_OK",
    "EXIT_RETURNING",
    "ProcessRunner",
    "_ChatHistoryHookBase",
]
