"""``plan`` step — gate + delegation to ``feature-plan``.

The dispatcher cannot synthesise a plan from pure Python: the real
work needs code reading and judgement that only the agent has. The
step therefore follows the Option-A delegation pattern described in
``docs/contracts/implement-ticket-flow.md#agent-directives``:

- ``state.plan`` empty → halt with ``BLOCKED`` and emit
  ``@agent-directive: create-plan``. The orchestrator runs the
  ``feature-plan`` skill, writes its output onto ``state.plan``,
  marks ``outcomes['plan'] = 'success'``, and re-invokes the
  dispatcher.

- ``state.plan`` populated with a minimally valid shape → ``SUCCESS``
  with no mutation. Shape validation catches accidental scaffolding
  (e.g. an empty list, a placeholder string) that would produce a
  broken plan downstream.

- ``state.plan`` populated but malformed → ``BLOCKED`` with numbered
  options so the user decides whether to re-plan, continue with the
  malformed plan, or abort.

``analyze`` is a precondition: the step refuses to plan when the
upstream gate did not succeed, rather than silently re-running a
derailed flow.
"""
from __future__ import annotations

from typing import Any

from ...delivery_state import (
    DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
)

AMBIGUITIES: tuple[dict[str, str], ...] = (
    {
        "code": "upstream_analyze_failed",
        "trigger": "`analyze` outcome is not `success`",
        "resolution": "re-run `/implement-ticket` from the start",
    },
    {
        "code": "empty_plan_delegate",
        "trigger": "`state.plan` empty — no plan recorded yet",
        "resolution": "agent directive `create-plan` → `/feature-plan`",
    },
    {
        "code": "malformed_plan",
        "trigger": (
            "plan is not a non-empty string, list of strings/dicts, "
            "or dict with a non-empty `steps` list"
        ),
        "resolution": "re-run `/feature-plan` or correct the recorded plan",
    },
)
"""Declared ambiguity surfaces. Every BLOCKED return maps to one code."""


def run(state: DeliveryState) -> StepResult:
    """Gate on ``analyze``, then either delegate or validate the plan."""
    if state.outcomes.get("analyze") != Outcome.SUCCESS.value:
        return _blocked_on_precondition(state)

    if _is_plan_empty(state.plan):
        return _delegate_to_feature_plan(state)

    shape_issues = _diagnose_shape(state.plan)
    if shape_issues:
        return _blocked_on_shape(state, shape_issues)

    return StepResult(outcome=Outcome.SUCCESS)


def _is_plan_empty(plan: Any) -> bool:
    """True when ``state.plan`` has nothing a downstream step could use.

    Whitespace-only strings count as empty \u2014 the user experience of
    "nothing planned" is identical to "blank placeholder", and both
    should delegate to ``feature-plan`` rather than fall through to
    the shape-validator.
    """
    if plan is None:
        return True
    if isinstance(plan, str):
        return not plan.strip()
    if isinstance(plan, (list, dict, tuple, set)):
        return len(plan) == 0
    return False


def _diagnose_shape(plan: Any) -> list[str]:
    """Return the list of shape complaints against ``state.plan``.

    Accepted shapes (matches ``report._format_plan``):
    a non-empty string, a list of strings or ``{title, detail}`` dicts,
    or a dict with a non-empty ``steps`` list. Everything else is
    rejected so the report renderer never has to guess.
    """
    issues: list[str] = []

    if isinstance(plan, str):
        if not plan.strip():
            issues.append("plan is a blank string")
        return issues

    if isinstance(plan, list):
        if not plan:
            issues.append("plan list is empty")
            return issues
        for idx, item in enumerate(plan, start=1):
            if isinstance(item, dict):
                if not (item.get("title") or item.get("step")):
                    issues.append(f"plan step #{idx} has no title")
            elif not isinstance(item, str) or not item.strip():
                issues.append(f"plan step #{idx} is not a usable string")
        return issues

    if isinstance(plan, dict):
        steps = plan.get("steps")
        if not isinstance(steps, list) or not steps:
            issues.append("plan dict must carry a non-empty 'steps' list")
        return issues

    issues.append(f"plan has unsupported type: {type(plan).__name__}")
    return issues


def _delegate_to_feature_plan(state: DeliveryState) -> StepResult:
    """Halt with an agent directive so the orchestrator runs ``feature-plan``."""
    ticket_id = (state.ticket or {}).get("id") or "(no id)"
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            agent_directive("create-plan", ticket=ticket_id),
            f"> Ticket {ticket_id} \u2014 no plan recorded yet; running "
            "`feature-plan` and resuming.",
            "> 1. Continue \u2014 use the plan produced by `feature-plan`",
            "> 2. Abort \u2014 stop before any edits are proposed",
        ],
        message=f"Ticket {ticket_id} needs a plan before implementation.",
    )


def _blocked_on_precondition(state: DeliveryState) -> StepResult:
    ticket_id = (state.ticket or {}).get("id") or "(no id)"
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            f"> Ticket {ticket_id} \u2014 plan gate refused: "
            "`analyze` step did not complete successfully.",
            "> 1. Re-run `/implement-ticket` from the start",
            "> 2. Abort",
        ],
        message=f"Ticket {ticket_id} cannot plan: analyze gate did not pass.",
    )


def _blocked_on_shape(state: DeliveryState, issues: list[str]) -> StepResult:
    ticket_id = (state.ticket or {}).get("id") or "(no id)"
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            f"> Ticket {ticket_id} \u2014 recorded plan is malformed: "
            + "; ".join(issues)
            + ".",
            "> 1. Re-run `feature-plan` and resume",
            "> 2. Abort \u2014 the plan cannot be trusted",
        ],
        message=f"Ticket {ticket_id} plan shape invalid: {'; '.join(issues)}.",
    )


__all__ = ["AMBIGUITIES", "run"]
