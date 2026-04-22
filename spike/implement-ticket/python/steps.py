"""Phase 0 spike — mock step handlers for the Python dispatcher.

Mirrors the Bash prototype exactly: `refine` blocks on empty acceptance
criteria, everything else returns `success`. Throwaway code.
"""
from __future__ import annotations

from delivery_state import DeliveryState, Outcome, StepResult


def refine(state: DeliveryState) -> StepResult:
    ac = state.ticket.get("acceptance_criteria") or []
    if not ac:
        return StepResult(
            outcome=Outcome.BLOCKED,
            questions=[
                "1. Define a measurable performance target (e.g. P95 < 2s).",
                "2. Define a maximum dataset size or row count.",
                "3. Skip the optimisation — the ticket is too vague to execute.",
            ],
        )
    return StepResult(outcome=Outcome.SUCCESS)


def _noop(_state: DeliveryState) -> StepResult:
    return StepResult(outcome=Outcome.SUCCESS)


# Named handlers — mirror the Bash steps/<name>.sh layout.
memory = _noop
analyze = _noop
plan = _noop
implement = _noop
test = _noop
verify = _noop
report = _noop


STEPS: dict[str, object] = {
    "refine": refine,
    "memory": memory,
    "analyze": analyze,
    "plan": plan,
    "implement": implement,
    "test": test,
    "verify": verify,
    "report": report,
}

ORDER: list[str] = [
    "refine", "memory", "analyze", "plan",
    "implement", "test", "verify", "report",
]
