"""``TraceHook`` — emit one stderr line per hook event.

Useful for debugging dispatch flow and Phase 5 chat-history wiring.
Registers on every :class:`HookEvent`; output goes to a configurable
stream (default ``sys.stderr``) so tests can capture it.

Pure observability — never mutates context, never halts. A misbehaving
sink (e.g. closed stream) raises :class:`HookError`, which the runner
swallows with a warning per the three-tier contract.
"""
from __future__ import annotations

import sys
from typing import IO

from ..context import HookContext
from ..events import HookEvent
from ..exceptions import HookError
from ..registry import HookRegistry


class TraceHook:
    """Stderr-trace hook for every lifecycle event.

    Parameters
    ----------
    stream:
        Output stream. Defaults to ``sys.stderr``. Tests pass an
        ``io.StringIO`` to capture the trace without touching stderr.
    prefix:
        Line prefix. Defaults to ``"[hook]"`` for visual separation
        from regular CLI output.
    """

    def __init__(
        self,
        stream: IO[str] | None = None,
        prefix: str = "[hook]",
    ) -> None:
        self._stream = stream if stream is not None else sys.stderr
        self._prefix = prefix

    def register(self, registry: HookRegistry) -> None:
        """Register the trace callback for every :class:`HookEvent`."""
        for event in HookEvent:
            registry.register(event, self._make_callback(event))

    def _make_callback(self, event: HookEvent):
        def _cb(ctx: HookContext) -> None:
            try:
                line = self._format(event, ctx)
                self._stream.write(line + "\n")
                self._stream.flush()
            except (OSError, ValueError) as exc:
                raise HookError(f"trace stream unavailable: {exc}") from exc

        return _cb

    def _format(self, event: HookEvent, ctx: HookContext) -> str:
        """Build a one-line trace record.

        Format: ``[hook] event=<name> step=<step> set=<set> outcome=<o>``.
        Missing fields are skipped so the line stays short on events that
        only carry a subset of the context.
        """
        parts: list[str] = [self._prefix, f"event={event.value}"]
        if ctx.step_name:
            parts.append(f"step={ctx.step_name}")
        if ctx.set_name:
            parts.append(f"set={ctx.set_name}")
        if ctx.result is not None:
            outcome = getattr(ctx.result, "outcome", None)
            if outcome is not None:
                parts.append(f"outcome={getattr(outcome, 'value', outcome)}")
        if ctx.final is not None:
            parts.append(f"final={getattr(ctx.final, 'value', ctx.final)}")
        if ctx.halting:
            parts.append(f"halting={ctx.halting}")
        if ctx.exception is not None:
            parts.append(f"exception={type(ctx.exception).__name__}")
        return " ".join(parts)


__all__ = ["TraceHook"]
