"""Tests for the ``mixed.contract`` step — Phase 4 Step 1 of the UI track.

Branches covered:

- Upstream ``analyze`` outcome is not ``success`` — emits the
  precondition halt; no agent directive.
- ``state.contract`` empty / ``None`` / non-dict — emits the
  ``@agent-directive: contract-plan`` halt with ``feature-plan``
  scoped to contract-only.
- Populated contract missing required keys — emits the incomplete
  halt with the missing slots listed.
- Well-formed contract without ``contract_confirmed`` — emits the
  unconfirmed-contract summary halt.
- Well-formed contract with ``contract_confirmed = True`` — passes
  through to ``SUCCESS`` (idempotent re-entry).
- Ambiguity surface declares all four codes.
"""
from __future__ import annotations

from work_engine import DeliveryState, Outcome
from work_engine.delivery_state import AGENT_DIRECTIVE_PREFIX
from work_engine.directives.mixed import contract


def _mixed_state(**overrides: object) -> DeliveryState:
    """Build a DeliveryState shaped like a mixed-routed envelope post-analyze."""
    ticket: dict[str, object] = {
        "id": "MIX-1",
        "title": "Add saved-search form with persistence endpoint",
        "raw": "Add saved-search form with persistence endpoint",
        "confidence": {"band": "high"},
    }
    state = DeliveryState(ticket=ticket)
    state.outcomes["analyze"] = Outcome.SUCCESS.value
    for key, value in overrides.items():
        setattr(state, key, value)
    return state


def _well_formed_contract(**overrides: object) -> dict[str, object]:
    """Return a minimal contract that satisfies every required slot."""
    payload: dict[str, object] = {
        "data_model": [
            {"name": "SavedSearch", "fields": ["id", "name", "query"]},
        ],
        "api_surface": [
            {"method": "POST", "path": "/saved-searches"},
            {"method": "GET", "path": "/saved-searches"},
        ],
    }
    payload.update(overrides)
    return payload


# --- precondition halt ------------------------------------------------------


def test_contract_blocks_when_analyze_did_not_succeed() -> None:
    state = _mixed_state()
    state.outcomes.pop("analyze", None)

    result = contract.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert not result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)
    body = "\n".join(result.questions)
    assert "analyze" in body.lower()


def test_contract_blocks_when_analyze_outcome_is_blocked() -> None:
    state = _mixed_state()
    state.outcomes["analyze"] = Outcome.BLOCKED.value

    result = contract.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "analyze" in "\n".join(result.questions).lower()


# --- first-pass directive halt ----------------------------------------------


def test_contract_emits_directive_when_contract_is_none() -> None:
    state = _mixed_state(contract=None)

    result = contract.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)
    assert "contract-plan" in result.questions[0]


def test_contract_emits_directive_when_contract_is_empty_dict() -> None:
    state = _mixed_state(contract={})

    result = contract.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)


def test_contract_emits_directive_when_contract_is_non_dict() -> None:
    state = _mixed_state(contract=["nope"])  # type: ignore[arg-type]

    result = contract.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)


def test_contract_directive_carries_input_preview() -> None:
    state = _mixed_state(contract=None)

    result = contract.run(state)

    body = "\n".join(result.questions)
    assert "> Input: Add saved-search form with persistence endpoint" in body
    assert "contract-only" in body.lower()


# --- incomplete-contract halt -----------------------------------------------


def test_contract_halts_when_data_model_missing() -> None:
    state = _mixed_state(contract={"api_surface": [{"path": "/x"}]})

    result = contract.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions)
    assert "data_model" in body
    assert "incomplete" in body.lower() or "Missing required" in body


def test_contract_halts_when_api_surface_empty_list() -> None:
    state = _mixed_state(
        contract={
            "data_model": [{"name": "X"}],
            "api_surface": [],
        },
    )

    result = contract.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions)
    assert "api_surface" in body


# --- unconfirmed-contract halt ---------------------------------------------


def test_contract_halts_when_well_formed_but_unconfirmed() -> None:
    state = _mixed_state(contract=_well_formed_contract())

    result = contract.run(state)

    assert result.outcome is Outcome.BLOCKED
    # No agent directive on the confirmation branch — user-facing only.
    assert not result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)
    body = "\n".join(result.questions)
    assert "Entities (data model): 1" in body
    assert "Endpoints / actions (api surface): 2" in body
    assert "> 1." in body and "> 2." in body and "> 3." in body
    assert "**Recommendation:" in body


def test_contract_halts_when_contract_confirmed_is_false() -> None:
    payload = _well_formed_contract()
    payload["contract_confirmed"] = False
    state = _mixed_state(contract=payload)

    result = contract.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions)
    assert "Confirm" in body


# --- success / idempotency --------------------------------------------------


def test_contract_passes_when_confirmed() -> None:
    payload = _well_formed_contract()
    payload["contract_confirmed"] = True
    state = _mixed_state(contract=payload)

    result = contract.run(state)

    assert result.outcome is Outcome.SUCCESS
    assert result.questions == []


def test_contract_idempotent_on_confirmed_payload() -> None:
    """Re-entering with confirmation set must not re-emit a halt."""
    payload = _well_formed_contract()
    payload["contract_confirmed"] = True
    state = _mixed_state(contract=payload)

    first = contract.run(state)
    second = contract.run(state)

    assert first.outcome is Outcome.SUCCESS
    assert second.outcome is Outcome.SUCCESS


# --- ambiguity declaration --------------------------------------------------


def test_contract_declares_four_ambiguity_codes() -> None:
    codes = {entry["code"] for entry in contract.AMBIGUITIES}
    assert codes == {
        "upstream_analyze_failed",
        "contract_missing",
        "contract_incomplete",
        "contract_unconfirmed",
    }

