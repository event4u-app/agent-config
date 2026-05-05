"""``ChatHistoryAppendHook`` — phase-boundary persistence.

Fires on ``after_step``. Appends a ``--type phase`` entry whenever a
step closed with ``Outcome.SUCCESS``. Failures bubble up as
:class:`HookError` so the runner converts them to warnings — append
errors must not break the main flow.
"""
from __future__ import annotations

import json
from typing import Any

from ..context import HookContext
from ..events import HookEvent
from ..exceptions import HookError
from ..registry import HookRegistry
from ._chat_history_base import EXIT_OK, _ChatHistoryHookBase


class ChatHistoryAppendHook(_ChatHistoryHookBase):
    """Append a phase-boundary entry after every successful step."""

    def register(self, registry: HookRegistry) -> None:
        registry.register(HookEvent.AFTER_STEP, self._on_after_step)

    def _on_after_step(self, ctx: HookContext) -> None:
        from ...delivery_state import Outcome  # local: avoid import cycle.

        result = ctx.result
        if result is None or getattr(result, "outcome", None) != Outcome.SUCCESS:
            return
        payload: dict[str, Any] = {"step": ctx.step_name or "<unknown>"}
        proc = self._invoke(
            "append",
            "--type", "phase", "--json", json.dumps(payload),
        )
        if proc.returncode != EXIT_OK:
            raise HookError(
                f"chat-history append failed (exit {proc.returncode})"
            )


__all__ = ["ChatHistoryAppendHook"]
