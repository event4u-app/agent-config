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

from ...scoring.decision_trace import summarise_memory, summarise_verify
from ...scoring.memory_visibility import (
    DEFAULT_ASKED_TYPES,
    compute_affected,
    format_changed_decisions_block,
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
    memory_cadence:
        Cadence from ``memory.cadence`` in ``.agent-settings.yml``
        (``auto`` / ``always`` / ``never``). ``auto`` suppresses the
        line unless ``asks ≥ 3``; ``never`` suppresses it entirely;
        ``always`` (default) emits whenever ``asks ≥ 1`` per the
        contract's cadence table.
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
        memory_cadence: str = "always",
        visibility_off: bool = False,
        asked_types: Iterable[str] | None = None,
    ) -> None:
        self._memory_cadence = memory_cadence
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
            memory_cadence=self._memory_cadence,
            visibility_off=self._visibility_off,
        ):
            return
        affected = self._derive_affected(work, memory)
        line = format_line(summary, affected=affected)
        if not line:
            return
        block = format_changed_decisions_block(
            summary.get("ids") or [], affected,
        )
        existing = getattr(work, "report", "") or ""
        rendered = line if block is None else f"{line}\n\n{block}"
        if line in existing and (block is None or block in existing):
            return
        sep = "\n\n" if existing else ""
        try:
            work.report = f"{existing}{sep}{rendered}"
        except AttributeError as exc:
            raise HookError(
                "memory-visibility: state.report not writable",
            ) from exc

    def _derive_affected(self, work: Any, memory: Any) -> list[str] | None:
        """Compute the closed-list ``affected`` keys for this work step.

        Reuses the decision-trace summarisers so the counterfactual
        matches the trace hook's view of the same WorkState. Returns
        ``None`` when memory was not consulted (hits == 0); callers
        then omit the ``· affected: …`` segment per the contract.
        """
        memory_summary = summarise_memory(memory)
        verify_summary = summarise_verify(getattr(work, "verify", None))
        ambiguity = bool(getattr(work, "questions", None))
        return compute_affected(
            memory_hits=memory_summary["hits"],
            verify_claims=verify_summary["claims"],
            verify_first_try_passes=verify_summary["first_try_passes"],
            ambiguity_flag=ambiguity,
            changes=getattr(work, "changes", None),
            applied_rules=getattr(work, "applied_rules", None),
            test_plan=getattr(work, "test_plan", None),
        )


def derive_visibility(memory: Any) -> str | None:
    """Convenience helper: render the line directly from a memory list.

    Used by external callers (CLI ad-hoc smoke tests, the audit-as-
    memory consumer) that have a ``memory`` list but no ``HookContext``.
    Returns ``None`` when ``asks == 0``.
    """
    return format_line(summarise_visibility(memory))


__all__ = ["MemoryVisibilityHook", "derive_visibility"]
