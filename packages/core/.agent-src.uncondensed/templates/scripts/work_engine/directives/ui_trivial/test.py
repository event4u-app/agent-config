"""``test`` step — smoke-test delegate for the ``ui-trivial`` set.

Phase 2 Step 6 of ``agents/roadmaps/road-to-product-ui-track.md``:
the trivial path runs "apply + smoke-test only". Smoke scope means
the agent runs the narrowest test layer that proves the edit didn't
visibly break the touched surface — render-test for a Blade partial,
unit-test for the touched component, or a single-file pytest scope —
not the full project suite.

The handler is the smaller cousin of
:mod:`work_engine.directives.backend.test`: same verdict contract on
``state.tests``, narrower scope on the agent directive. ``failed`` /
``mixed`` verdicts halt with the verdict echoed back; ``success``
flows through.
"""
from __future__ import annotations

from typing import Any

from ...delivery_state import (
    DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
)

_ALLOWED_VERDICTS: tuple[str, ...] = ("success", "failed", "mixed")

AMBIGUITIES: tuple[dict[str, str], ...] = (
    {
        "code": "empty_tests_delegate",
        "trigger": "`state.tests` empty \u2014 smoke runner not invoked yet",
        "resolution": (
            "agent directive `run-tests scope=smoke` \u2192 "
            "`/tests-execute` (narrowest layer covering the touched file)"
        ),
    },
    {
        "code": "malformed_tests",
        "trigger": (
            "`state.tests` is not a dict or `verdict` is not one of "
            "success / failed / mixed"
        ),
        "resolution": "re-run smoke and record a clean verdict",
    },
    {
        "code": "bad_test_verdict",
        "trigger": "`state.tests['verdict']` is `failed` or `mixed`",
        "resolution": "fix the regression and re-run, or abort",
    },
)


def run(state: DeliveryState) -> StepResult:
    """Gate the smoke verdict; delegate when ``state.tests`` is empty."""
    tests = state.tests
    if not tests:
        return _delegate()

    if not isinstance(tests, dict):
        return _malformed(f"state.tests is {type(tests).__name__}, expected dict")

    verdict = tests.get("verdict")
    if verdict not in _ALLOWED_VERDICTS:
        return _malformed(
            f"state.tests['verdict']={verdict!r} not in {_ALLOWED_VERDICTS}",
        )

    if verdict == "success":
        return StepResult(outcome=Outcome.SUCCESS)

    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            f"> Smoke test verdict: **{verdict}** \u2014 trivial edit may "
            "have regressed the touched surface.",
            "> 1. Investigate \u2014 read failures, fix, re-run smoke",
            "> 2. Reclassify \u2014 promote to `ui-improve` if the regression "
            "indicates the edit was less trivial than assumed",
            "> 3. Abort \u2014 revert the edit",
        ],
        message=f"smoke verdict={verdict} on trivial edit",
    )


def _delegate() -> StepResult:
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            agent_directive("run-tests", scope="smoke"),
            "> Trivial edit applied; run the smoke test layer covering "
            "the touched file.",
            "> 1. Continue \u2014 invoke `/tests-execute` with smoke scope, "
            "then write the verdict back to `state.tests`",
            "> 2. Skip \u2014 record `state.tests = {\"verdict\": \"success\", "
            "\"scope\": \"none\"}` (logged as a deferred verification)",
            "> 3. Abort \u2014 drop this run",
        ],
        message="smoke run not yet invoked",
    )


def _malformed(detail: str) -> StepResult:
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            f"> Malformed test envelope: {detail}.",
            "> 1. Re-run smoke \u2014 produce a clean verdict",
            "> 2. Abort \u2014 drop this run",
        ],
        message=detail,
    )


__all__ = ["AMBIGUITIES", "run"]
