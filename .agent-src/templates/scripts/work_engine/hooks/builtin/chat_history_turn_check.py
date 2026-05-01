"""``ChatHistoryTurnCheckHook`` — guards engine-driven turns.

Fires on ``before_dispatch``; classifies the chat-history file via
``scripts/chat_history.py turn-check``:

- exit 0 (``ok``)        → continue
- exit 10 (``missing``)  → continue (auto-init handled by chat_history.py)
- exit 11 (``foreign``)  → raise :class:`HookHalt` so CLI exits 2
- exit 12 (``returning``)→ raise :class:`HookHalt` so CLI exits 2
- any other exit         → raise :class:`HookError` (warn, continue)
"""
from __future__ import annotations

from ..context import HookContext
from ..events import HookEvent
from ..exceptions import HookError, HookHalt
from ..registry import HookRegistry
from ._chat_history_base import (
    EXIT_FOREIGN,
    EXIT_MISSING,
    EXIT_OK,
    EXIT_RETURNING,
    _ChatHistoryHookBase,
)


class ChatHistoryTurnCheckHook(_ChatHistoryHookBase):
    """Run ``turn-check`` at the start of dispatch; halt on drift."""

    def register(self, registry: HookRegistry) -> None:
        registry.register(HookEvent.BEFORE_DISPATCH, self._on_before_dispatch)

    def _on_before_dispatch(self, ctx: HookContext) -> None:
        msg = self._resolve_msg(ctx)
        result = self._invoke("turn-check", "--first-user-msg", msg)
        code = result.returncode
        if code in (EXIT_OK, EXIT_MISSING):
            return
        if code in (EXIT_FOREIGN, EXIT_RETURNING):
            text = (result.stderr or result.stdout or "").strip()
            reason = "foreign" if code == EXIT_FOREIGN else "returning"
            surface = [line for line in text.splitlines() if line] or [
                f"chat-history turn-check: {reason}",
            ]
            raise HookHalt(f"chat_history_turn_check_{reason}", surface=surface)
        raise HookError(f"chat-history turn-check failed (exit {code})")


__all__ = ["ChatHistoryTurnCheckHook"]
