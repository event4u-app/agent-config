"""``ui`` step — delegates to the UI track once the contract is locked.

Phase 4 Step 2 of ``agents/roadmaps/road-to-product-ui-track.md``: in the
``mixed`` directive set the ``implement`` slot is the UI handoff. It
gates on the upstream contract sentinel
(``state.contract.contract_confirmed is True``) and then delegates the
full audit → design → apply → review → polish sub-flow to the UI track
via an ``@agent-directive: ui-track`` halt. The locked contract is
treated as immutable input — the UI track reads ``state.contract`` for
entity shapes and endpoint signatures but never mutates them.

Routes on the UI sub-flow's terminal sentinel
(``state.ui_review.review_clean``):

- **Contract sentinel missing or False** — defense-in-depth halt. The
  ``plan`` slot (``mixed.contract``) is the canonical gate; this step
  refuses to start without the sentinel even if outcomes say
  otherwise, mirroring the roadmap risk: "Mixed flow's contract halt
  is bypassed".
- **UI sub-flow not started** (``state.ui_review`` empty / missing
  ``review_clean``) — emit ``@agent-directive: ui-track`` so the
  orchestrator runs audit → design → apply → review → polish with the
  contract as input. On rebound the dispatcher walks back here.
- **UI sub-flow finished, ``review_clean`` True** — return ``SUCCESS``;
  the dispatcher advances to the mixed ``stitch`` step.
- **UI sub-flow finished, ``review_clean`` False** — halt with three
  numbered options (re-run / hand off / abort). Polish-ceiling
  semantics live in the UI track's polish step; if the user reaches
  this halt the UI track has already given up.

Idempotent: a re-entry with a clean review round-trips through
``SUCCESS`` without re-emitting the delegation directive.
"""
from __future__ import annotations

from typing import Any

from ...delivery_state import (
    DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
)

UI_TRACK_DIRECTIVE = "ui-track"
"""Agent directive that triggers the full UI sub-flow.

The orchestrator runs the ``ui`` directive set's audit → design →
apply → review → polish sequence with ``state.contract`` as the
locked input. On rebound, ``state.ui_review.review_clean`` carries
the verdict the mixed step routes on.
"""

AMBIGUITIES: tuple[dict[str, str], ...] = (
    {
        "code": "upstream_contract_failed",
        "trigger": "`plan` (contract) outcome is not `success`",
        "resolution": "re-run the mixed flow from the start",
    },
    {
        "code": "contract_sentinel_missing",
        "trigger": "state.contract.contract_confirmed is missing or False — "
        "defense-in-depth check refuses to start the UI track",
        "resolution": "loop back to the contract step; user must confirm "
        "the data_model + api_surface lock before UI work begins",
    },
    {
        "code": "ui_track_not_started",
        "trigger": "state.ui_review is empty or missing `review_clean` — "
        "the UI sub-flow has not run yet",
        "resolution": "agent directive `ui-track` → orchestrator runs "
        "audit → design → apply → review → polish with the contract as "
        "immutable input",
    },
    {
        "code": "ui_track_review_unclean",
        "trigger": "UI sub-flow finished but `review_clean` is False — "
        "polish ceiling reached or findings remain",
        "resolution": "user picks re-run / hand off / abort; polish-ceiling "
        "semantics already fired inside the UI track",
    },
)
"""Declared ambiguity surfaces. Every BLOCKED return maps to one code."""


def run(state: DeliveryState) -> StepResult:
    """Delegate the UI sub-flow once the contract is locked."""
    if state.outcomes.get("plan") != Outcome.SUCCESS.value:
        return _blocked_on_precondition(state)

    if not _contract_confirmed(state):
        return _blocked_on_contract_sentinel(state)

    review = state.ui_review if isinstance(state.ui_review, dict) else None
    if review is None or "review_clean" not in review:
        return _delegate_to_ui_track(state)

    if review.get("review_clean") is True:
        return StepResult(outcome=Outcome.SUCCESS)

    return _halt_review_unclean(state, review)


def _contract_confirmed(state: DeliveryState) -> bool:
    """True when the contract sentinel is explicitly ``True``.

    Mirrors the gate in :func:`work_engine.directives.mixed.contract.run`
    so a hand-rolled state file (or a partial rebound) cannot race the
    UI track ahead of the user's contract sign-off.
    """
    contract = state.contract
    if not isinstance(contract, dict):
        return False
    return contract.get("contract_confirmed") is True


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
    """BLOCKED halt — upstream contract step did not succeed."""
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            "> Mixed `ui` step gated on the contract step; the contract "
            "outcome is not success.",
            "> 1. Re-run \u2014 restart the mixed flow from the start",
            "> 2. Abort \u2014 drop this request",
        ],
        message="ui step gated on plan; upstream contract outcome is not success.",
    )


def _blocked_on_contract_sentinel(state: DeliveryState) -> StepResult:
    """BLOCKED halt — contract sentinel missing despite plan success.

    Defense-in-depth: the dispatcher should not advance here without
    ``contract_confirmed=True``, but a partial state-file edit could
    skip the sentinel. Refuse loudly so the bypass is visible.
    """
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            "> Contract sentinel missing \u2014 `state.contract.contract_confirmed` "
            "is not `True`. The UI track will not start until the data "
            "model and API surface are locked and confirmed.",
            "> 1. Loop back \u2014 re-enter the contract step and confirm",
            "> 2. Abort \u2014 drop this mixed request",
        ],
        message=(
            "ui step refused; contract_confirmed sentinel missing despite plan success."
        ),
    )


def _delegate_to_ui_track(state: DeliveryState) -> StepResult:
    """Halt with an agent directive so the orchestrator runs the UI track."""
    preview = _preview_input(state)
    contract = state.contract if isinstance(state.contract, dict) else {}
    data_model = contract.get("data_model") or []
    api_surface = contract.get("api_surface") or []
    entity_count = len(data_model) if isinstance(data_model, list) else 0
    endpoint_count = len(api_surface) if isinstance(api_surface, list) else 0

    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            agent_directive(UI_TRACK_DIRECTIVE),
            f"> Input: {preview}",
            "> Contract is locked. Handing off to the UI track:",
            f"> - Entities: {entity_count}",
            f"> - Endpoints / actions: {endpoint_count}",
            "> The UI track runs audit \u2192 design \u2192 apply \u2192 "
            "review \u2192 polish with the contract as immutable input. "
            "No new entities or endpoints \u2014 the contract drives the UI shape.",
            "> 1. Continue \u2014 run the UI track",
            "> 2. Abort \u2014 drop this mixed request",
        ],
        message="Mixed contract locked; delegating UI sub-flow to ui-track.",
    )


def _halt_review_unclean(
    state: DeliveryState,
    review: dict[str, Any],
) -> StepResult:
    """BLOCKED halt — UI sub-flow finished but review is not clean.

    Polish-ceiling semantics fire inside the UI track itself (Phase 3
    Step 5). This halt is the mixed-flow's escalation when the UI
    track gave up: the user picks re-run / hand off / abort instead
    of the engine looping forever.
    """
    findings = review.get("findings") or []
    finding_count = len(findings) if isinstance(findings, list) else 0
    lines = [
        f"> UI track finished but review is not clean. Findings remaining: {finding_count}.",
        "> Polish ceiling already fired inside the UI track \u2014 the "
        "engine cannot resolve the remaining findings without a user "
        "decision.",
        "> 1. Re-run UI track \u2014 hand back to `ui-track` for another "
        "audit \u2192 design pass (rare; usually means the contract changed)",
        "> 2. Hand off \u2014 ship as-is and let a human resolve the "
        "remaining findings outside the engine",
        "> 3. Abort \u2014 drop this mixed request",
    ]
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=lines,
        message=(
            f"Mixed ui step halted; UI track review unclean ({finding_count} findings)."
        ),
    )


__all__ = [
    "AMBIGUITIES",
    "UI_TRACK_DIRECTIVE",
    "run",
]
