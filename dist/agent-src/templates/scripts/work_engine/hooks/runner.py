"""``HookRunner`` — single emit point for hook callbacks.

Implements the three-tier error contract documented in
``exceptions.py``:

- ``HookError`` from a callback → caught, ``warnings.warn`` is emitted,
  the runner continues with the next callback for the same event.
  Returns ``None`` once the event is fully drained.
- ``HookHalt`` from a callback → caught, **returned** to the caller
  with no further callbacks invoked for this event. The caller
  decides how to surface the halt (engine halt, CLI exit 2). Never
  re-raised through the dispatch loop.
- any other ``Exception`` → propagates unchanged. Treated as a hook
  bug; dispatch unwinds.

The runner is intentionally tiny. Behavior changes belong here so
``dispatcher.py`` and ``cli.py`` stay free of hook bookkeeping.
"""
from __future__ import annotations

import warnings

from .context import HookContext
from .events import HookEvent
from .exceptions import HookError, HookHalt
from .registry import HookRegistry


class HookRunner:
    """Emit hook events through a :class:`HookRegistry`.

    Construct once per CLI invocation, share between the CLI and the
    dispatcher. ``emit`` is the only public method on the hot path.
    """

    def __init__(self, registry: HookRegistry | None = None) -> None:
        self._registry = registry if registry is not None else HookRegistry()

    @property
    def registry(self) -> HookRegistry:
        """Return the underlying registry.

        Exposed so callers can register additional hooks after
        construction (e.g. in tests). Not used on the hot path.
        """
        return self._registry

    def emit(self, event: HookEvent, ctx: HookContext) -> HookHalt | None:
        """Fire all callbacks registered for ``event``.

        Returns ``None`` when every callback completed (with or without
        a swallowed :class:`HookError`). Returns the first
        :class:`HookHalt` raised, after which no further callbacks are
        invoked for this event. Any other exception propagates.
        """
        callbacks = self._registry.for_event(event)
        if not callbacks:
            return None
        for callback in callbacks:
            try:
                callback(ctx)
            except HookHalt as halt:
                return halt
            except HookError as err:
                warnings.warn(
                    f"hook {event.value} raised HookError: {err}",
                    stacklevel=2,
                )
                continue
        return None


__all__ = ["HookRunner"]
