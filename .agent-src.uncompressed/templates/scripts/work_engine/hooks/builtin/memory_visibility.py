"""``MemoryVisibilityHook`` — emit the visibility line on save.

Implements the producer side of
``docs/contracts/memory-visibility-v1.md``: derive ``asks/hits/ids``
from ``state.memory`` and thread the rendered line into
``state.report`` so the agent's reply naturally carries the memory
visibility marker.

Fires on ``before_save``: ``cli._sync_back`` runs between
``after_dispatch`` and ``before_save`` and reassigns
``work.report = delivery.report``. A line written on
``after_dispatch`` would be overwritten before ``_save``; firing on
``before_save`` lands after the sync.

Default-off; opt-in via ``.agent-settings.yml``
``hooks.memory_visibility.enabled: true`` (or implicitly when
``memory.visibility`` is not ``off`` and the master switch is on).
The hook is purely observational: failures surface as
:class:`HookError` (non-fatal per the three-tier contract); the
engine never crashes on a visibility-line write.
"""
from __future__ import annotations

from typing import Any, Iterable

from ...scoring.memory_visibility import (
    DEFAULT_ASKED_TYPES,
    format_line,
    should_emit,
    summarise_visibility,
)
from ..context import HookContext
from ..events import HookEvent
from ..exceptions import HookError
from ..registry import HookRegistry


class MemoryVisibilityHook:
    """Thread the ``🧠 Memory: <hits>/<asks> · ids=[…]`` line into the report.

    Parameters
    ----------
    cost_profile:
        Cadence profile from ``.agent-settings.yml`` (``lean`` /
        ``standard`` / ``verbose``). ``lean`` suppresses the line
        unless ``asks ≥ 3`` per the contract's cadence table.
    visibility_off:
        When ``True``, the hook stays silent — used to mirror
        ``memory.visibility: off`` in the consumer settings.
    asked_types:
        Optional override for the list of memory types treated as
        ``asks`` in the visibility line. Defaults to the four types
        the engine's memory step retrieves over.
    """

    def __init__(
        self,
        *,
        cost_profile: str = "standard",
        visibility_off: bool = False,
        asked_types: Iterable[str] | None = None,
    ) -> None:
        self._cost_profile = cost_profile
        self._visibility_off = visibility_off
        self._asked_types = (
            tuple(asked_types) if asked_types is not None else DEFAULT_ASKED_TYPES
        )

    def register(self, registry: HookRegistry) -> None:
        """Register the visibility-line emitter on ``before_save``."""
        registry.register(HookEvent.BEFORE_SAVE, self._on_before_save)

    def _on_before_save(self, ctx: HookContext) -> None:
        work = ctx.work
        if work is None:
            return
        memory = getattr(work, "memory", None)
        summary = summarise_visibility(memory, asked_types=self._asked_types)
        if not should_emit(
            summary,
            cost_profile=self._cost_profile,
            visibility_off=self._visibility_off,
        ):
            return
        line = format_line(summary)
        if not line:
            return
        existing = getattr(work, "report", "") or ""
        if line in existing:
            return
        sep = "\n\n" if existing else ""
        try:
            work.report = f"{existing}{sep}{line}"
        except AttributeError as exc:
            raise HookError(
                "memory-visibility: state.report not writable",
            ) from exc


def derive_visibility(memory: Any) -> str | None:
    """Convenience helper: render the line directly from a memory list.

    Used by external callers (CLI ad-hoc smoke tests, the audit-as-
    memory consumer) that have a ``memory`` list but no ``HookContext``.
    Returns ``None`` when ``asks == 0``.
    """
    return format_line(summarise_visibility(memory))


__all__ = ["MemoryVisibilityHook", "derive_visibility"]
