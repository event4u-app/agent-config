"""``verify`` step — gate + Option-A delegation to ``review-changes``.

The dispatcher does not run the review-changes judges itself; the
agent invokes the composite review (bug-hunter + security +
test-coverage + code-quality) and captures the consolidated
verdict onto ``state.verify``.

``state.verify`` contract when populated:

- Must be a dict.
- Must carry a ``verdict`` key — one of ``success``, ``blocked``,
  ``partial``. Matches the ``Outcome`` vocabulary used everywhere
  else in the flow.
- A ``success`` verdict advances the flow to ``report``.
- A ``blocked`` or ``partial`` verdict halts with numbered options
  so the user decides whether to address the findings, override
  (rarely appropriate), or abort.
- Optional keys (``confidence``, ``findings``, ``followups``) feed
  the delivery report.
"""
from __future__ import annotations

from typing import Any

from ..delivery_state import (
    DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
)

_ALLOWED_VERDICTS = ("success", "blocked", "partial")


def run(state: DeliveryState) -> StepResult:
    """Gate on ``test``, then either delegate or validate ``state.verify``."""
    if state.outcomes.get("test") != Outcome.SUCCESS.value:
        return _blocked_on_precondition(state)

    verify = state.verify
    if not verify:
        return _delegate_to_review_changes(state)

    shape_issues = _diagnose_verify(verify)
    if shape_issues:
        return _blocked_on_shape(state, shape_issues)

    verdict = verify.get("verdict")
    if verdict != "success":
        return _blocked_on_bad_verdict(state, verdict)

    return StepResult(outcome=Outcome.SUCCESS)


def _diagnose_verify(verify: Any) -> list[str]:
    if not isinstance(verify, dict):
        return [f"state.verify must be a dict, got {type(verify).__name__}"]
    verdict = verify.get("verdict")
    if verdict not in _ALLOWED_VERDICTS:
        return [
            f"state.verify['verdict'] must be one of "
            f"{', '.join(_ALLOWED_VERDICTS)}; got {verdict!r}",
        ]
    return []


def _delegate_to_review_changes(state: DeliveryState) -> StepResult:
    ticket_id = (state.ticket or {}).get("id") or "(no id)"
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            agent_directive("review-changes", ticket=ticket_id),
            f"> Ticket {ticket_id} \u2014 running the four-judge review "
            "(bugs, security, tests, code quality) before the delivery "
            "report is written.",
            "> 1. Continue \u2014 run `review-changes` now",
            "> 2. Abort \u2014 skip review (NOT recommended)",
        ],
        message=(
            f"Ticket {ticket_id} needs `review-changes` before the report."
        ),
    )


def _blocked_on_precondition(state: DeliveryState) -> StepResult:
    ticket_id = (state.ticket or {}).get("id") or "(no id)"
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            f"> Ticket {ticket_id} \u2014 verify gate refused: "
            "`test` step did not complete successfully.",
            "> 1. Re-run `/implement-ticket` from the start",
            "> 2. Abort",
        ],
        message=f"Ticket {ticket_id} cannot verify: test gate did not pass.",
    )


def _blocked_on_shape(state: DeliveryState, issues: list[str]) -> StepResult:
    ticket_id = (state.ticket or {}).get("id") or "(no id)"
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            f"> Ticket {ticket_id} \u2014 recorded verify output is malformed: "
            + "; ".join(issues)
            + ".",
            "> 1. Re-run `review-changes` and resume",
            "> 2. Abort \u2014 verify verdict cannot be trusted",
        ],
        message=f"Ticket {ticket_id} verify shape invalid: {'; '.join(issues)}.",
    )


def _blocked_on_bad_verdict(state: DeliveryState, verdict: Any) -> StepResult:
    ticket_id = (state.ticket or {}).get("id") or "(no id)"
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            f"> Ticket {ticket_id} \u2014 `review-changes` reported "
            f"`{verdict}`. The delivery report cannot claim completion on a "
            "non-success verdict (see `verify-before-complete`).",
            "> 1. Address the findings and re-run `review-changes`",
            "> 2. Continue anyway \u2014 override (NOT recommended)",
            "> 3. Abort",
        ],
        message=(
            f"Ticket {ticket_id} verify verdict was `{verdict}`, not success."
        ),
    )


__all__ = ["run"]
