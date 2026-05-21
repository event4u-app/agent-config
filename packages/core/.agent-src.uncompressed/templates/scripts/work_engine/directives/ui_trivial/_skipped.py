"""Pass-through handler for slots the trivial path skips.

Phase 2 Step 6 of ``agents/roadmaps/road-to-product-ui-track.md``: the
``ui-trivial`` directive set short-circuits the audit / design / review
/ polish loop. Per the roadmap (Phase 1 Step 3, Phase 2 Step 6) the
trivial path "skips audit + design + review; runs apply + smoke-test
only; emits short delivery report".

The dispatcher's ``STEP_ORDER`` is fixed (eight slots, no branching),
so the trivial set fills the unused slots — ``memory``, ``analyze``,
``plan``, ``verify`` — with this no-op handler. It returns ``SUCCESS``
without touching state, mutates nothing, and declares zero
ambiguities. The audit gate is **not** weakened: trivial bypass is
gated upstream by ``apply``'s hard preconditions, which reclassify
to ``ui-improve`` (and the full audit gate) when violated.
"""
from __future__ import annotations

from ...delivery_state import DeliveryState, Outcome, StepResult

AMBIGUITIES: tuple[dict[str, str], ...] = ()
"""No ambiguities — the slot is unconditionally skipped on the trivial path."""


def run(state: DeliveryState) -> StepResult:
    """Return ``SUCCESS`` without touching ``state``.

    Used as a shared handler for the slots that the trivial path
    intentionally bypasses. Keeping the slot wired (rather than
    raising ``NotImplementedError``) preserves the dispatcher's
    completeness-check invariant: every slot in :data:`STEP_ORDER`
    has a callable handler, every directive set has a uniform shape.
    """
    return StepResult(outcome=Outcome.SUCCESS)


__all__ = ["AMBIGUITIES", "run"]
