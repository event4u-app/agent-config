"""``ChatHistoryHeartbeatHook`` — visibility marker before save.

Fires on ``before_save``. Runs ``chat_history.py heartbeat`` and,
if the script emits a marker line, threads it onto ``state.report``
so the agent's reply naturally carries the heartbeat without manual
copy/paste.

Why ``before_save`` and not ``after_dispatch``: the marker must land
in the report that gets persisted. ``cli._sync_back`` runs between
``after_dispatch`` and ``before_save`` and reassigns
``work.report = delivery.report`` — a marker written on
``after_dispatch`` would be overwritten before ``_save``. Firing on
``before_save`` runs after the sync, so the marker survives.
"""
from __future__ import annotations

from ..context import HookContext
from ..events import HookEvent
from ..exceptions import HookError
from ..registry import HookRegistry
from ._chat_history_base import EXIT_OK, _ChatHistoryHookBase


class ChatHistoryHeartbeatHook(_ChatHistoryHookBase):
    """Run heartbeat before save; thread marker into ``state.report``."""

    def register(self, registry: HookRegistry) -> None:
        registry.register(HookEvent.BEFORE_SAVE, self._on_before_save)

    def _on_before_save(self, ctx: HookContext) -> None:
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
