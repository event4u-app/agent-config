"""``HookRegistry`` — insertion-ordered map from event to callbacks.

Phase 1 ships insertion-ordered registration only. If a real ordering
need surfaces later (e.g. trace must fire before mutation hooks), add
a priority field as a follow-up — do not pre-build it (per Notes
section of the roadmap).

The registry is a plain container. It does not invoke callbacks, does
not catch exceptions, and does not know about the error contract;
that responsibility lives in :class:`HookRunner`.
"""
from __future__ import annotations

from collections.abc import Callable
from typing import Iterable

from .context import HookContext
from .events import HookEvent

HookCallback = Callable[[HookContext], None]
"""A hook callback. Returns ``None`` on success, raises ``HookError``
or ``HookHalt`` to signal control flow per ``exceptions.py``."""


class HookRegistry:
    """Insertion-ordered registry of hook callbacks per event.

    Single instance per CLI invocation. Built once in ``cli.main()``
    and shared with ``dispatch()`` so dispatcher events and CLI events
    are routed through the same callback set.
    """

    def __init__(self) -> None:
        self._hooks: dict[HookEvent, list[HookCallback]] = {}

    def register(self, event: HookEvent, callback: HookCallback) -> None:
        """Register ``callback`` for ``event``.

        Multiple callbacks for the same event are allowed; they fire
        in registration order.
        """
        self._hooks.setdefault(event, []).append(callback)

    def for_event(self, event: HookEvent) -> tuple[HookCallback, ...]:
        """Return callbacks registered for ``event`` in insertion order.

        Returns an empty tuple when no callbacks are registered — the
        runner uses this to short-circuit a no-op fast path.
        """
        return tuple(self._hooks.get(event, ()))

    def events(self) -> Iterable[HookEvent]:
        """Iterate over events that have at least one callback.

        Diagnostics-only; not used on the hot path.
        """
        return self._hooks.keys()


__all__ = ["HookCallback", "HookRegistry"]
