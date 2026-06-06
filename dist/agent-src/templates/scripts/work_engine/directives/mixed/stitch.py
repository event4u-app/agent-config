"""``stitch`` step — integration verification across the contract / UI seam.

Phase 4 Step 3 of ``agents/roadmaps/road-to-product-ui-track.md``: in the
``mixed`` directive set the ``test`` slot is the integration boundary.
The dispatcher does not run integration scenarios itself — the agent
invokes the ``integration-test`` skill which drives end-to-end smokes
(fill form → server validation → response → UI update) and writes the
verdict back to ``state.stitch``.

``state.stitch`` contract when populated:

- Must be a dict.
- Must carry a ``verdict`` key — one of ``success``, ``blocked``,
  ``partial`` (mirrors the ``Outcome`` vocabulary used in
  ``backend.verify``).
- Optional ``scenarios`` list documents the smoke cases run.
- Optional ``integration_confirmed`` boolean — when ``True``, the user
  has signed off on a partial / blocked verdict and the flow may
  advance regardless. Treated as an explicit override.

Routing:

- **Upstream ``implement`` (mixed.ui) outcome not success** — refuse;
  the contract / UI handoff did not complete.
- **``state.stitch`` empty** — emit ``@agent-directive: integration-test``
  so the orchestrator runs the smoke scenarios.
- **Stitch shape malformed** — halt for re-run; verdict cannot be
  trusted.
- **Verdict ``success``** — return ``SUCCESS``; dispatcher advances to
  ``verify``.
- **Verdict ``blocked`` / ``partial`` and not user-confirmed** — halt
  with three numbered options (fix / override / abort).
- **Verdict ``blocked`` / ``partial`` and ``integration_confirmed=True``**
  — return ``SUCCESS`` (explicit user override).
"""
from __future__ import annotations

from typing import Any

from ...delivery_state import (
    DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
)

INTEGRATION_TEST_DIRECTIVE = "integration-test"
"""Agent directive that drives end-to-end smoke scenarios.

The skill fills forms, hits the locked endpoints, and asserts the UI
reflects the response. It writes ``state.stitch`` with a verdict and
the list of scenarios it ran. The mixed flow routes on the verdict.
"""

_ALLOWED_VERDICTS = ("success", "blocked", "partial")

AMBIGUITIES: tuple[dict[str, str], ...] = (
    {
        "code": "upstream_ui_failed",
        "trigger": "`implement` (mixed.ui) outcome is not `success`",
        "resolution": "re-run the mixed flow; UI track must finish before stitch",
    },
    {
        "code": "empty_stitch_delegate",
        "trigger": "`state.stitch` empty — integration-test skill has not run yet",
        "resolution": "agent directive `integration-test` → end-to-end smokes",
    },
    {
        "code": "malformed_stitch",
        "trigger": (
            "`state.stitch` is not a dict or `verdict` is not one of "
            "success / blocked / partial"
        ),
        "resolution": "re-run `integration-test` and record a clean verdict",
    },
    {
        "code": "bad_stitch_verdict",
        "trigger": "`state.stitch['verdict']` is `blocked` or `partial` "
        "and `integration_confirmed` is not True",
        "resolution": (
            "address findings and re-run `integration-test`, or set "
            "`integration_confirmed=True` to override (rare)"
        ),
    },
)
"""Declared ambiguity surfaces. Every BLOCKED return maps to one code."""


def run(state: DeliveryState) -> StepResult:
    """Gate on ``implement``, then validate ``state.stitch``."""
    if state.outcomes.get("implement") != Outcome.SUCCESS.value:
        return _blocked_on_precondition(state)

    stitch = state.stitch
    if not stitch:
        return _delegate_to_integration_test(state)

    shape_issues = _diagnose_stitch(stitch)
    if shape_issues:
        return _blocked_on_shape(state, shape_issues)

    verdict = stitch.get("verdict")
    if verdict == "success":
        return StepResult(outcome=Outcome.SUCCESS)

    if stitch.get("integration_confirmed") is True:
        return StepResult(
            outcome=Outcome.SUCCESS,
            message=(
                f"stitch verdict `{verdict}` overridden by "
                "integration_confirmed=True."
            ),
        )

    return _blocked_on_bad_verdict(state, verdict, stitch)


def _diagnose_stitch(stitch: Any) -> list[str]:
    """Return shape errors; empty list when ``stitch`` is well-formed."""
    if not isinstance(stitch, dict):
        return [f"state.stitch must be a dict, got {type(stitch).__name__}"]
    verdict = stitch.get("verdict")
    if verdict not in _ALLOWED_VERDICTS:
        return [
            f"state.stitch['verdict'] must be one of "
            f"{', '.join(_ALLOWED_VERDICTS)}; got {verdict!r}",
        ]
    return []


def _preview_input(state: DeliveryState) -> str:
    """One-line preview of the original input for halt bodies."""
    data = state.ticket or {}
    raw = data.get("raw")
    if isinstance(raw, str) and raw.strip():
        text = " ".join(raw.split())
    else:
        title = data.get("title")
        text = title if isinstance(title, str) else (data.get("id") or "(no title)")
    if len(text) <= 80:
        return text
    return text[:79].rstrip() + "\u2026"


def _blocked_on_precondition(state: DeliveryState) -> StepResult:
    """BLOCKED halt — upstream UI step did not succeed."""
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            "> Mixed `stitch` step gated on the UI step; "
            "the implement outcome is not success.",
            "> 1. Re-run \u2014 restart the mixed flow from the start",
            "> 2. Abort \u2014 drop this request",
        ],
        message="stitch step gated on implement; upstream UI outcome is not success.",
    )


def _delegate_to_integration_test(state: DeliveryState) -> StepResult:
    """Halt with an agent directive so the orchestrator runs smokes."""
    preview = _preview_input(state)
    contract = state.contract if isinstance(state.contract, dict) else {}
    api_surface = contract.get("api_surface") or []
    endpoint_count = len(api_surface) if isinstance(api_surface, list) else 0

    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            agent_directive(INTEGRATION_TEST_DIRECTIVE),
            f"> Input: {preview}",
            "> UI track finished; the contract / UI seam needs end-to-end "
            "verification before the delivery report:",
            f"> - Endpoints / actions to smoke: {endpoint_count}",
            "> Scenarios cover the full round-trip \u2014 fill form \u2192 "
            "server validation \u2192 response \u2192 UI update. Unit-level "
            "passes from the UI review do **not** substitute for this gate.",
            "> 1. Continue \u2014 run `integration-test` now",
            "> 2. Abort \u2014 skip integration verification (NOT recommended)",
        ],
        message="Mixed UI complete; delegating to integration-test for stitch.",
    )


def _blocked_on_shape(state: DeliveryState, issues: list[str]) -> StepResult:
    """BLOCKED halt — recorded stitch verdict is malformed."""
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            "> Recorded stitch output is malformed: "
            + "; ".join(issues)
            + ".",
            "> 1. Re-run `integration-test` and resume",
            "> 2. Abort \u2014 stitch verdict cannot be trusted",
        ],
        message=f"Mixed stitch shape invalid: {'; '.join(issues)}.",
    )


def _blocked_on_bad_verdict(
    state: DeliveryState,
    verdict: Any,
    stitch: dict[str, Any],
) -> StepResult:
    """BLOCKED halt — verdict is blocked / partial and not user-confirmed."""
    scenarios = stitch.get("scenarios") or []
    scenario_count = len(scenarios) if isinstance(scenarios, list) else 0
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            f"> `integration-test` reported `{verdict}` after running "
            f"{scenario_count} scenario(s). The delivery report cannot "
            "claim completion on a non-success integration verdict.",
            "> 1. Address the findings and re-run `integration-test`",
            "> 2. Override \u2014 set `state.stitch.integration_confirmed=true` "
            "and resume (rare; document why)",
            "> 3. Abort",
        ],
        message=(
            f"Mixed stitch verdict was `{verdict}`, not success; "
            "user override required to continue."
        ),
    )


__all__ = [
    "AMBIGUITIES",
    "INTEGRATION_TEST_DIRECTIVE",
    "run",
]