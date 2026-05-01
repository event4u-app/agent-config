"""``test`` step — gate + Option-A delegation for running the test suite.

The dispatcher never spawns subprocesses. Test execution is handed
to the agent via ``@agent-directive: run-tests scope=targeted``; the
agent drives the project's test runner (pytest, Pest, phpunit, …),
captures the verdict onto ``state.tests``, marks
``outcomes['test'] = 'success'``, and re-invokes the dispatcher.

Contract for ``state.tests`` when populated:

- Must be a dict.
- Must carry a ``verdict`` key \u2014 one of ``success``, ``failed``,
  or ``mixed`` (targeted vs full-suite split). Anything else blocks.
- ``failed`` or ``mixed`` verdicts halt with the verdict as part of
  the surfaced message so the user decides whether to continue or
  stop. This follows the ``verify-before-complete`` rule: a bad test
  outcome must never be silently skipped.
- Optional keys (``targeted``, ``full``, ``duration_ms``,
  ``followups``) feed the delivery report.
"""
from __future__ import annotations

from typing import Any

from ...delivery_state import (
    DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
)
from ...persona_policy import resolve_policy

_ALLOWED_VERDICTS = ("success", "failed", "mixed")

AMBIGUITIES: tuple[dict[str, str], ...] = (
    {
        "code": "upstream_implement_failed",
        "trigger": "`implement` outcome is not `success`",
        "resolution": "re-run `/implement-ticket` from the start",
    },
    {
        "code": "empty_tests_delegate",
        "trigger": "`state.tests` empty — test runner not invoked yet",
        "resolution": (
            "agent directive `run-tests scope=targeted|full` → "
            "`/tests-execute` (qa persona widens to full suite)"
        ),
    },
    {
        "code": "malformed_tests",
        "trigger": (
            "`state.tests` is not a dict or `verdict` is not one of "
            "success / failed / mixed"
        ),
        "resolution": "re-run tests and record a clean verdict",
    },
    {
        "code": "bad_test_verdict",
        "trigger": "`state.tests['verdict']` is `failed` or `mixed`",
        "resolution": "fix failures and re-run, or abort",
    },
)
"""Declared ambiguity surfaces. Advisory personas skip this step entirely."""


def run(state: DeliveryState) -> StepResult:
    """Gate on ``implement``, then either delegate or validate ``state.tests``."""
    policy = resolve_policy(state.persona)
    if not policy.allows_test:
        return StepResult(
            outcome=Outcome.SUCCESS,
            message=f"test skipped: persona `{policy.name}` is plan-only.",
        )

    if state.outcomes.get("implement") != Outcome.SUCCESS.value:
        return _blocked_on_precondition(state)

    tests = state.tests
    if not tests:
        return _delegate_to_run_tests(state, policy.widen_tests)

    shape_issues = _diagnose_tests(tests)
    if shape_issues:
        return _blocked_on_shape(state, shape_issues)

    # At this point ``tests`` is a dict with a recognised verdict.
    verdict = tests.get("verdict")
    if verdict != "success":
        return _blocked_on_bad_verdict(state, verdict)

    return StepResult(outcome=Outcome.SUCCESS)


def _diagnose_tests(tests: Any) -> list[str]:
    if not isinstance(tests, dict):
        return [f"state.tests must be a dict, got {type(tests).__name__}"]
    verdict = tests.get("verdict")
    if verdict not in _ALLOWED_VERDICTS:
        return [
            f"state.tests['verdict'] must be one of "
            f"{', '.join(_ALLOWED_VERDICTS)}; got {verdict!r}",
        ]
    return []


def _delegate_to_run_tests(state: DeliveryState, widen: bool) -> StepResult:
    """Emit the ``run-tests`` directive.

    ``widen`` comes from the persona policy (``qa`` widens to the full
    suite). The directive scope becomes the first thing an orchestrator
    reads, so the widened case is visible without parsing the options.
    """
    ticket_id = (state.ticket or {}).get("id") or "(no id)"
    scope = "full" if widen else "targeted"
    description = (
        "full suite (qa persona widens to catch regressions outside "
        "the changed paths)"
        if widen
        else "targeted first (`--filter` on the changed paths), full "
        "suite only if targeted passes"
    )
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            agent_directive("run-tests", ticket=ticket_id, scope=scope),
            f"> Ticket {ticket_id} \u2014 running tests: {description}.",
            f"> 1. Continue \u2014 run {scope} tests now",
            "> 2. Abort \u2014 skip testing (NOT recommended)",
        ],
        message=f"Ticket {ticket_id} needs its tests run before verification.",
    )


def _blocked_on_precondition(state: DeliveryState) -> StepResult:
    ticket_id = (state.ticket or {}).get("id") or "(no id)"
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            f"> Ticket {ticket_id} \u2014 test gate refused: "
            "`implement` step did not complete successfully.",
            "> 1. Re-run `/implement-ticket` from the start",
            "> 2. Abort",
        ],
        message=(
            f"Ticket {ticket_id} cannot test: implement gate did not pass."
        ),
    )


def _blocked_on_shape(state: DeliveryState, issues: list[str]) -> StepResult:
    ticket_id = (state.ticket or {}).get("id") or "(no id)"
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            f"> Ticket {ticket_id} \u2014 recorded test output is malformed: "
            + "; ".join(issues)
            + ".",
            "> 1. Re-run tests and resume",
            "> 2. Abort \u2014 test verdict cannot be trusted",
        ],
        message=f"Ticket {ticket_id} tests shape invalid: {'; '.join(issues)}.",
    )


def _blocked_on_bad_verdict(state: DeliveryState, verdict: Any) -> StepResult:
    ticket_id = (state.ticket or {}).get("id") or "(no id)"
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            f"> Ticket {ticket_id} \u2014 tests reported `{verdict}`. "
            "Verification cannot proceed on a non-success verdict.",
            "> 1. Fix the failing tests and re-run `run-tests`",
            "> 2. Continue anyway \u2014 override (NOT recommended)",
            "> 3. Abort",
        ],
        message=f"Ticket {ticket_id} test verdict was `{verdict}`, not success.",
    )


__all__ = ["AMBIGUITIES", "run"]
