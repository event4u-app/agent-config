"""``implement`` step — gate + Option-A delegation for applying the plan.

The step never edits files. Editing is delegated to the agent via
``@agent-directive: apply-plan``; the agent runs the `minimal-safe-
diff` and `scope-control` rules while it applies the plan, then
writes the resulting file-level changes onto ``state.changes`` and
marks ``outcomes['implement'] = 'success'`` before re-invoking the
dispatcher.

Flow:

- ``plan`` outcome is not ``success`` → BLOCKED on precondition.
- ``state.changes`` empty → BLOCKED with ``@agent-directive:
  apply-plan`` so the agent applies the plan.
- ``state.changes`` populated but malformed (entries missing
  ``path``, or non-dict entries) → BLOCKED with shape complaint.
- Otherwise → SUCCESS.

``changes`` entries use the loose shape described in
``agents/contexts/implement-ticket-flow.md#deliverystate-the-only-shared-object``
\u2014 each entry is a dict with at least a ``path``; optional
``lines`` / ``purpose`` feed the delivery report.
"""
from __future__ import annotations

from typing import Any

from ..delivery_state import (
    DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
)
from ..persona_policy import resolve_policy


def run(state: DeliveryState) -> StepResult:
    """Gate on ``plan``, then either delegate or validate ``state.changes``."""
    policy = resolve_policy(state.persona)
    if not policy.allows_implement:
        # Advisory personas produce a plan only; ``state.changes`` stays
        # empty and the delivery report renders a "no file changes
        # recorded" placeholder. See ``persona_policy`` for contract.
        return StepResult(
            outcome=Outcome.SUCCESS,
            message=f"implement skipped: persona `{policy.name}` is plan-only.",
        )

    if state.outcomes.get("plan") != Outcome.SUCCESS.value:
        return _blocked_on_precondition(state)

    if not state.changes:
        return _delegate_to_apply_plan(state)

    shape_issues = _diagnose_changes(state.changes)
    if shape_issues:
        return _blocked_on_shape(state, shape_issues)

    return StepResult(outcome=Outcome.SUCCESS)


def _diagnose_changes(changes: list[Any]) -> list[str]:
    """Every entry must be a dict carrying at least a non-empty ``path``."""
    issues: list[str] = []
    for idx, change in enumerate(changes, start=1):
        if not isinstance(change, dict):
            issues.append(f"change #{idx} is not a dict")
            continue
        path = change.get("path") or change.get("file")
        if not isinstance(path, str) or not path.strip():
            issues.append(f"change #{idx} has no path")
    return issues


def _delegate_to_apply_plan(state: DeliveryState) -> StepResult:
    ticket_id = (state.ticket or {}).get("id") or "(no id)"
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            agent_directive("apply-plan", ticket=ticket_id),
            f"> Ticket {ticket_id} \u2014 applying the recorded plan under "
            "`minimal-safe-diff` + `scope-control`.",
            "> 1. Continue \u2014 apply the plan as recorded",
            "> 2. Abort \u2014 stop before any edits are made",
        ],
        message=f"Ticket {ticket_id} needs its plan applied before testing.",
    )


def _blocked_on_precondition(state: DeliveryState) -> StepResult:
    ticket_id = (state.ticket or {}).get("id") or "(no id)"
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            f"> Ticket {ticket_id} \u2014 implement gate refused: "
            "`plan` step did not complete successfully.",
            "> 1. Re-run `/implement-ticket` from the start",
            "> 2. Abort",
        ],
        message=(
            f"Ticket {ticket_id} cannot implement: plan gate did not pass."
        ),
    )


def _blocked_on_shape(state: DeliveryState, issues: list[str]) -> StepResult:
    ticket_id = (state.ticket or {}).get("id") or "(no id)"
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            f"> Ticket {ticket_id} \u2014 recorded changes are malformed: "
            + "; ".join(issues)
            + ".",
            "> 1. Re-run `apply-plan` and resume",
            "> 2. Abort \u2014 changes cannot be trusted",
        ],
        message=(
            f"Ticket {ticket_id} changes shape invalid: {'; '.join(issues)}."
        ),
    )


__all__ = ["run"]
