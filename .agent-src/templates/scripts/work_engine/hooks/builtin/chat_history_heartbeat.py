"""``ChatHistoryHeartbeatHook`` — visibility marker after dispatch.

Fires on ``after_dispatch``. Runs ``chat_history.py heartbeat`` and,
if the script emits a marker line, threads it onto ``state.report``
so the agent's reply naturally carries the heartbeat without manual
copy/paste.
"""
from __future__ import annotations

from ..context import HookContext
from ..events import HookEvent
from ..exceptions import HookError
from ..registry import HookRegistry
from ._chat_history_base import EXIT_OK, _ChatHistoryHookBase


class ChatHistoryHeartbeatHook(_ChatHistoryHookBase):
    """Run heartbeat after dispatch; thread marker into ``state.report``."""

    def register(self, registry: HookRegistry) -> None:
        registry.register(HookEvent.AFTER_DISPATCH, self._on_after_dispatch)

    def _on_after_dispatch(self, ctx: HookContext) -> None:
        msg = self._resolve_msg(ctx)
        proc = self._invoke("heartbeat", "--first-user-msg", msg)
        if proc.returncode != EXIT_OK:
            raise HookError(
                f"chat-history heartbeat failed (exit {proc.returncode})"
            )
        marker = (proc.stdout or "").strip()
        if not marker or ctx.work is None:
            return
        existing = getattr(ctx.work, "report", "") or ""
        if marker in existing:
            return
        sep = "\n\n" if existing else ""
        try:
            ctx.work.report = f"{existing}{sep}{marker}"
        except AttributeError:
            raise HookError("chat-history heartbeat: state.report not writable")


__all__ = ["ChatHistoryHeartbeatHook"]
