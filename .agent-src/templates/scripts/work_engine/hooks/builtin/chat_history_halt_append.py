"""``ChatHistoryHaltAppendHook`` — capture halt surfaces in the log.

Fires on ``on_halt``. Records a ``--type decision`` entry with the
step name and any pending questions so a fresh chat can resume from
the persisted log alone.
"""
from __future__ import annotations

import json

from ..context import HookContext
from ..events import HookEvent
from ..exceptions import HookError
from ..registry import HookRegistry
from ._chat_history_base import EXIT_OK, _ChatHistoryHookBase


class ChatHistoryHaltAppendHook(_ChatHistoryHookBase):
    """Append a decision entry whenever a step halts."""

    def register(self, registry: HookRegistry) -> None:
        registry.register(HookEvent.ON_HALT, self._on_halt)

    def _on_halt(self, ctx: HookContext) -> None:
        msg = self._resolve_msg(ctx)
        questions: list[str] = []
        if ctx.result is not None:
            questions = list(getattr(ctx.result, "questions", []) or [])
        if not questions and ctx.delivery is not None:
            questions = list(getattr(ctx.delivery, "questions", []) or [])
        payload = {"step": ctx.step_name or "<unknown>", "questions": questions}
        proc = self._invoke(
            "append", "--first-user-msg", msg,
            "--type", "decision", "--json", json.dumps(payload),
        )
        if proc.returncode != EXIT_OK:
            raise HookError(
                f"chat-history halt-append failed (exit {proc.returncode})"
            )


__all__ = ["ChatHistoryHaltAppendHook"]
