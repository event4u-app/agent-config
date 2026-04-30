"""Pass-through handler for UI directive slots that have no work.

Phase 6 of ``agents/roadmaps/road-to-product-ui-track.md`` retired the
Phase 3 deferral stub once design / apply / review / polish landed. Two
slots remain semantically empty for the UI track:

- ``memory`` — the UI track does not consult the four memory types the
  backend retrieves over (``domain-invariants``, ``architecture-decisions``,
  ``incident-learnings``, ``historical-patterns``). UI work pivots on the
  audit findings in ``state.ui_audit`` instead, which the audit gate has
  already populated by the time this handler runs.
- ``plan`` — :mod:`.design` produces the locked design brief that
  :mod:`.apply` follows verbatim. The brief IS the plan; a separate plan
  step would duplicate state with no user-visible payoff.

Both slots therefore return :data:`Outcome.SUCCESS` without writing to
state. The dispatcher advances to the next slot and the locked transcripts
record the no-op cycle as a clean rebound.

This module is ``directives/ui``-internal — the underscore prefix marks
it as a private slot filler, not a published handler. The backend track
keeps its own real ``memory`` and ``plan`` modules.
"""
from __future__ import annotations

from ...delivery_state import DeliveryState, Outcome, StepResult

AMBIGUITIES: tuple[dict[str, str], ...] = ()
"""Pass-through never blocks — empty surface, declared intent."""


def run(state: DeliveryState) -> StepResult:
    """Return ``SUCCESS`` without mutating state.

    The handler is intentionally pure and side-effect-free: it neither
    reads nor writes ``state``. The dispatcher records the step as
    successful in ``state.outcomes`` (its own bookkeeping) and advances
    to the next slot.
    """
    del state  # explicitly unused — the slot is a no-op by design
    return StepResult(outcome=Outcome.SUCCESS)


__all__ = ["AMBIGUITIES", "run"]
