"""``analyze`` step — deterministic precondition gate.

The step runs no analysis of its own: the real impact analysis is
owned by the agent between the ``memory`` and ``plan`` steps. The
gate's job is to confirm the upstream slices are populated enough
for planning to be meaningful.

Checks, in order:

1. ``refine`` outcome must be ``success`` — the ticket is refined.
2. ``memory`` outcome must be ``success`` — priors were queried
   (an empty result set is still a successful query, per the
   ``memory`` step's own contract).
3. The ticket must still carry acceptance criteria — guards against
   a resuming caller overwriting ``state.ticket`` between runs.

On any missing precondition the step returns ``BLOCKED`` with the
reason spelled out and numbered options per the ``user-interaction``
rule. Otherwise it returns ``SUCCESS`` without mutating state.
"""
from __future__ import annotations

from ..delivery_state import DeliveryState, Outcome, StepResult

AMBIGUITIES: tuple[dict[str, str], ...] = (
    {
        "code": "upstream_refine_failed",
        "trigger": "`refine` outcome is not `success`",
        "resolution": "re-run `/implement-ticket` from the start",
    },
    {
        "code": "upstream_memory_failed",
        "trigger": "`memory` outcome is not `success`",
        "resolution": "re-run `/implement-ticket` from the start",
    },
    {
        "code": "lost_ac",
        "trigger": "ticket lost its `acceptance_criteria` between runs",
        "resolution": "restart with the full ticket payload",
    },
)
"""Declared ambiguity surfaces. Every BLOCKED return maps to one code."""


def run(state: DeliveryState) -> StepResult:
    """Return SUCCESS when upstream is coherent, BLOCKED otherwise."""
    missing = _diagnose(state)
    if not missing:
        return StepResult(outcome=Outcome.SUCCESS)

    ticket_id = (state.ticket or {}).get("id") or "(no id)"
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=_format_questions(ticket_id, missing),
        message=(
            f"Ticket {ticket_id} cannot enter the plan step: "
            + "; ".join(missing)
        ),
    )


def _diagnose(state: DeliveryState) -> list[str]:
    """List the precondition failures in the order a reader needs them."""
    issues: list[str] = []

    if state.outcomes.get("refine") != Outcome.SUCCESS.value:
        issues.append("refine step did not complete successfully")

    if state.outcomes.get("memory") != Outcome.SUCCESS.value:
        issues.append("memory step did not complete successfully")

    ac = (state.ticket or {}).get("acceptance_criteria")
    if not isinstance(ac, list) or not ac:
        issues.append("ticket lost its acceptance criteria")

    return issues


def _format_questions(ticket_id: str, missing: list[str]) -> list[str]:
    """Render the numbered options shown to the user when BLOCKED.

    Two options: retry from the first failing step, or abort. The
    headnote names the ticket and every failure so the user can
    decide without re-reading the earlier output.
    """
    headnote = (
        f"> Ticket {ticket_id} \u2014 analyze gate failed: "
        + "; ".join(missing)
        + "."
    )
    return [
        headnote,
        "> 1. Re-run `/implement-ticket` from the start \u2014 rebuild upstream state",
        "> 2. Abort \u2014 the flow cannot continue",
    ]


__all__ = ["AMBIGUITIES", "run"]
