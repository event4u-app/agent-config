"""Linear step dispatcher for ``/implement-ticket``.

The dispatcher holds no business logic. It walks the fixed eight-step
order declared in ``agents/contexts/implement-ticket-flow.md``, hands
each step a live ``DeliveryState``, and honours the three terminal
outcomes:

- ``SUCCESS`` — record and advance.
- ``BLOCKED`` — record, copy questions onto the state, halt.
- ``PARTIAL`` — record, copy questions onto the state, halt.

Step handlers are injected by the caller rather than discovered at
import time. Phase 1 uses mock handlers in tests; Phase 2 wires the
real skill-backed handlers defined under
``.agent-src.uncompressed/skills/implement-ticket/``. Keeping
injection explicit means the dispatcher is trivially testable and
never depends on handler import order.
"""
from __future__ import annotations

from collections.abc import Mapping

from .delivery_state import DeliveryState, Outcome, Step, StepResult

STEP_ORDER: tuple[str, ...] = (
    "refine",
    "memory",
    "analyze",
    "plan",
    "implement",
    "test",
    "verify",
    "report",
)
"""Canonical execution order. Eight steps, fixed, no branching.

Changing this order is a roadmap-level decision — not a PR rider — per
the surface-growth guardrails in
``agents/roadmaps/road-to-implement-ticket.md``.
"""


def dispatch(
    state: DeliveryState,
    steps: Mapping[str, Step],
) -> tuple[Outcome, str | None]:
    """Run the eight steps linearly against ``state``.

    Returns a ``(final_outcome, halting_step)`` tuple. ``halting_step``
    is ``None`` when every step succeeded; otherwise it carries the
    name of the step whose result halted the flow.

    Parameters
    ----------
    state:
        Live ``DeliveryState``. Mutated in place: each step's outcome
        is recorded in ``state.outcomes`` under the step name, and
        any surfaced questions land on ``state.questions``.
    steps:
        Mapping from step name to handler. Every entry in
        :data:`STEP_ORDER` must be present; missing entries raise
        ``KeyError`` at dispatch time rather than silently skipping,
        so incomplete wiring surfaces as a hard failure.

    Raises
    ------
    KeyError
        If ``steps`` does not cover every entry in
        :data:`STEP_ORDER`.
    """
    _assert_all_steps_present(steps)

    for name in STEP_ORDER:
        handler = steps[name]
        result = handler(state)
        _validate_step_result(name, result)

        state.outcomes[name] = result.outcome.value

        if result.outcome is Outcome.BLOCKED:
            state.questions = list(result.questions)
            return Outcome.BLOCKED, name

        if result.outcome is Outcome.PARTIAL:
            state.questions = list(result.questions)
            return Outcome.PARTIAL, name

    return Outcome.SUCCESS, None


def _assert_all_steps_present(steps: Mapping[str, Step]) -> None:
    """Reject an incomplete step mapping up front.

    We deliberately fail loudly here: a missing step would otherwise
    raise deep inside the dispatch loop after partial state mutation,
    which makes debugging the wiring harder than it needs to be.
    """
    missing = [name for name in STEP_ORDER if name not in steps]
    if missing:
        raise KeyError(
            "Step mapping is missing handlers for: " + ", ".join(missing),
        )


def _validate_step_result(name: str, result: StepResult) -> None:
    """Enforce the blocked/partial invariant: questions must be set.

    A step that blocks without surfacing a question is a bug — there
    is nothing for the user to answer. We raise ``ValueError`` instead
    of silently recording the outcome so the defect is visible at the
    earliest possible point.
    """
    if result.outcome in (Outcome.BLOCKED, Outcome.PARTIAL) and not result.questions:
        raise ValueError(
            f"Step {name!r} returned {result.outcome.value} with no questions; "
            "blocked and partial outcomes must surface at least one numbered option.",
        )
