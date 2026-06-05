"""``contract`` step — locks data_model + api_surface before any UI work.

Phase 4 Step 1 of ``agents/roadmaps/road-to-product-ui-track.md``: in the
``mixed`` directive set the ``plan`` slot is the contract step. It
resolves the **backend contract** the UI will consume — entity shape,
endpoint signatures, validation surface — *before* the UI track runs.
The mixed ``ui`` step gates on ``state.contract.contract_confirmed is
True``; without that sentinel the UI directive refuses to start (per
roadmap risk: "Mixed flow's contract halt is bypassed").

Routes on ``state.contract`` shape:

- **Empty / None** — first pass. Emit ``@agent-directive: contract-plan``
  delegating to ``feature-plan`` with a contract-only scope; on the
  rebound the contract lands in ``state.contract``.
- **Populated, missing required keys** — halt listing the gaps
  (``data_model``, ``api_surface``) so the next pass writes the slots
  the UI will read.
- **Populated, well-formed, ``contract_confirmed`` missing or False** —
  halt with a numbered-options summary so the user signs off on the
  contract before any UI work begins.
- **Populated, well-formed, ``contract_confirmed`` True** — return
  ``SUCCESS``; the dispatcher advances to the mixed ``ui`` step.

``analyze`` is a precondition: the step refuses to plan a contract
when the upstream gate did not succeed, mirroring ``backend.plan``.

Idempotent: a re-entry with ``contract_confirmed=True`` round-trips
through ``SUCCESS`` without re-emitting a halt the user already
answered.
"""
from __future__ import annotations

from typing import Any

from ...delivery_state import (
    DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
)

REQUIRED_CONTRACT_KEYS: tuple[str, ...] = (
    "data_model",
    "api_surface",
)
"""Top-level keys every well-formed contract must carry.

``data_model`` lists the entities (and their fields) the UI will
read or write. ``api_surface`` lists the endpoints / actions the UI
will call. Both are non-empty lists when populated; the schema
validator in ``state._validate_contract`` enforces only the type, the
content check lives here.
"""

AMBIGUITIES: tuple[dict[str, str], ...] = (
    {
        "code": "upstream_analyze_failed",
        "trigger": "`analyze` outcome is not `success`",
        "resolution": "re-run the mixed flow from the start",
    },
    {
        "code": "contract_missing",
        "trigger": "state.contract is None or empty — contract has not been produced",
        "resolution": "agent directive `contract-plan` → `feature-plan` skill "
        "writes the contract into state.contract",
    },
    {
        "code": "contract_incomplete",
        "trigger": "contract is populated but missing required keys "
        "(`data_model`, `api_surface`) or one of them is empty",
        "resolution": "agent re-runs `feature-plan` with contract-only scope; "
        "halt lists the missing slots",
    },
    {
        "code": "contract_unconfirmed",
        "trigger": "contract is well-formed but contract_confirmed is unset/False",
        "resolution": "user reviews the contract summary and sets "
        "state.contract.contract_confirmed = True (or asks for "
        "revisions, which loops back to contract-plan)",
    },
)
"""Declared ambiguity surfaces. Every BLOCKED return maps to one code."""


def run(state: DeliveryState) -> StepResult:
    """Apply the contract-first lock to ``state.contract``."""
    if state.outcomes.get("analyze") != Outcome.SUCCESS.value:
        return _blocked_on_precondition(state)

    contract = state.contract
    if not _is_populated(contract):
        return _delegate_to_feature_plan(state)

    missing = _missing_required_keys(contract)
    if missing:
        return _halt_incomplete_contract(state, missing)

    if contract.get("contract_confirmed") is True:
        return StepResult(outcome=Outcome.SUCCESS)

    return _halt_unconfirmed(state, contract)


def _is_populated(contract: Any) -> bool:
    """True when ``contract`` carries an actionable backend lock.

    Non-dict and empty-dict shapes are treated as "skill has not run"
    so the first-pass directive fires. Once the skill writes a
    contract, the dict carries at least one of the required keys;
    from there :func:`_missing_required_keys` decides whether the
    contract is complete enough to advance.
    """
    if not isinstance(contract, dict):
        return False
    if not contract:
        return False
    return any(key in contract for key in REQUIRED_CONTRACT_KEYS)


def _missing_required_keys(contract: dict[str, Any]) -> list[str]:
    """Return required top-level keys that are missing or empty.

    Schema validation (``state._validate_contract``) already rejects
    non-list ``data_model`` / ``api_surface``; here we treat empty
    lists the same as missing — an empty data model or an empty
    surface gives the UI nothing to consume.
    """
    missing: list[str] = []
    for key in REQUIRED_CONTRACT_KEYS:
        value = contract.get(key)
        if value is None or value == [] or value == {}:
            missing.append(key)
    return missing


def _preview_input(state: DeliveryState) -> str:
    """Render a one-line preview of the input being contracted."""
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
    """BLOCKED halt \u2014 upstream ``analyze`` did not succeed."""
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            "> `analyze` did not succeed; cannot lock the contract until "
            "the upstream investigation lands.",
            "> 1. Re-run \u2014 restart the mixed flow from the start",
            "> 2. Abort \u2014 drop this request",
        ],
        message="contract step gated on analyze; upstream outcome is not success.",
    )


def _delegate_to_feature_plan(state: DeliveryState) -> StepResult:
    """Halt with an agent directive so the orchestrator runs ``feature-plan``.

    The directive carries a ``contract-only`` scope marker so the
    skill produces just the data model and API surface \u2014 no UI
    plan yet (Phase 4 Step 2 owns that).
    """
    preview = _preview_input(state)
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            agent_directive("contract-plan"),
            f"> Input: {preview}",
            "> No backend contract yet \u2014 producing one now. The contract "
            "locks the data model and API surface the UI will consume; "
            "the mixed `ui` step refuses to start without it.",
            "> Scope: contract-only (no UI plan, no implementation).",
            "> 1. Continue \u2014 produce the contract via `feature-plan`",
            "> 2. Abort \u2014 drop this mixed request",
        ],
        message="Mixed contract missing; delegating to feature-plan (contract-only).",
    )


def _halt_incomplete_contract(
    state: DeliveryState,
    missing: list[str],
) -> StepResult:
    """BLOCKED halt \u2014 contract is missing required keys."""
    preview = _preview_input(state)
    lines = [
        agent_directive("contract-plan"),
        f"> Input: {preview}",
        "> Backend contract is incomplete. Missing required slots:",
    ]
    for path in missing:
        lines.append(f"> - `{path}`")
    lines.append(
        "> Re-run `feature-plan` (contract-only) so every required slot "
        "has a final value before the UI track starts.",
    )
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=lines,
        message=(
            f"Mixed contract incomplete; {len(missing)} required slot(s) missing."
        ),
    )


def _halt_unconfirmed(
    state: DeliveryState,
    contract: dict[str, Any],
) -> StepResult:
    """BLOCKED halt \u2014 contract is well-formed; user must sign off."""
    preview = _preview_input(state)
    data_model = contract.get("data_model") or []
    api_surface = contract.get("api_surface") or []

    entity_count = len(data_model) if isinstance(data_model, list) else 0
    endpoint_count = len(api_surface) if isinstance(api_surface, list) else 0

    lines = [
        f"> Input: {preview}",
        "> Backend contract is ready. Summary:",
        f"> - Entities (data model): {entity_count}",
        f"> - Endpoints / actions (api surface): {endpoint_count}",
        "> 1. Confirm \u2014 lock this contract and advance to the UI track",
        "> 2. Revise \u2014 send feedback; loops back to `contract-plan`",
        "> 3. Abort \u2014 drop this mixed request",
        "",
        "**Recommendation: 1 \u2014 Confirm** \u2014 the contract covers both "
        "required slots. Caveat: flip to 2 only if an entity field or "
        "endpoint signature is wrong; the UI track will treat this "
        "contract as immutable input.",
    ]
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=lines,
        message=(
            "Mixed contract ready; halting for user confirmation before UI track."
        ),
    )


__all__ = [
    "AMBIGUITIES",
    "REQUIRED_CONTRACT_KEYS",
    "run",
]
