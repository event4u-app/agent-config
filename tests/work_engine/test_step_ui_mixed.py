"""Tests for the ``mixed.ui`` step — Phase 4 Step 2 of the UI track.

Branches covered:

- Upstream ``plan`` outcome is not ``success`` — emits the precondition
  halt; no agent directive.
- ``plan`` succeeded but ``state.contract.contract_confirmed`` is
  missing / ``False`` — emits the defense-in-depth sentinel halt.
- Contract sentinel locked, ``state.ui_review`` empty / missing
  ``review_clean`` — emits the ``@agent-directive: ui-track``
  delegation halt with entity / endpoint counts.
- ``state.ui_review.review_clean = True`` — passes through to
  ``SUCCESS`` (idempotent re-entry).
- ``state.ui_review.review_clean = False`` — emits the unclean-review
  halt with three numbered options.
- Ambiguity surface declares all four codes.
"""
from __future__ import annotations

from work_engine import DeliveryState, Outcome
from work_engine.delivery_state import AGENT_DIRECTIVE_PREFIX
from work_engine.directives.mixed import ui


def _mixed_state(**overrides: object) -> DeliveryState:
    """Build a DeliveryState shaped like a mixed-routed envelope post-plan."""
    ticket: dict[str, object] = {
        "id": "MIX-2",
        "title": "Add saved-search form with persistence endpoint",
        "raw": "Add saved-search form with persistence endpoint",
        "confidence": {"band": "high"},
    }
    state = DeliveryState(ticket=ticket)
    state.outcomes["plan"] = Outcome.SUCCESS.value
    for key, value in overrides.items():
        setattr(state, key, value)
    return state


def _confirmed_contract() -> dict[str, object]:
    return {
        "data_model": [
            {"name": "SavedSearch", "fields": ["id", "name", "query"]},
        ],
        "api_surface": [
            {"method": "POST", "path": "/saved-searches"},
            {"method": "GET", "path": "/saved-searches"},
        ],
        "contract_confirmed": True,
    }


# --- precondition halt ------------------------------------------------------


def test_ui_blocks_when_plan_did_not_succeed() -> None:
    state = _mixed_state()
    state.outcomes.pop("plan", None)

    result = ui.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert not result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)
    assert "contract" in "\n".join(result.questions).lower()


def test_ui_blocks_when_plan_outcome_is_blocked() -> None:
    state = _mixed_state(contract=_confirmed_contract())
    state.outcomes["plan"] = Outcome.BLOCKED.value

    result = ui.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert not result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)


# --- contract sentinel halt -------------------------------------------------


def test_ui_blocks_when_contract_sentinel_missing() -> None:
    """Defense-in-depth: plan succeeded but sentinel never set."""
    payload = _confirmed_contract()
    payload.pop("contract_confirmed")
    state = _mixed_state(contract=payload)

    result = ui.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions)
    assert "contract_confirmed" in body
    assert not result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)


def test_ui_blocks_when_contract_sentinel_false() -> None:
    payload = _confirmed_contract()
    payload["contract_confirmed"] = False
    state = _mixed_state(contract=payload)

    result = ui.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "contract_confirmed" in "\n".join(result.questions)


def test_ui_blocks_when_contract_is_none() -> None:
    state = _mixed_state(contract=None)

    result = ui.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "contract_confirmed" in "\n".join(result.questions)


# --- ui-track delegation halt -----------------------------------------------


def test_ui_emits_directive_when_ui_review_missing() -> None:
    state = _mixed_state(contract=_confirmed_contract())

    result = ui.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)
    assert "ui-track" in result.questions[0]


def test_ui_emits_directive_when_ui_review_lacks_review_clean() -> None:
    state = _mixed_state(
        contract=_confirmed_contract(),
        ui_review={"findings": []},
    )

    result = ui.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)
    assert "ui-track" in result.questions[0]


def test_ui_directive_carries_input_preview_and_counts() -> None:
    state = _mixed_state(contract=_confirmed_contract())

    result = ui.run(state)

    body = "\n".join(result.questions)
    assert "> Input: Add saved-search form with persistence endpoint" in body
    assert "Entities: 1" in body
    assert "Endpoints / actions: 2" in body


# --- success / unclean review ----------------------------------------------


def test_ui_passes_when_review_clean_is_true() -> None:
    state = _mixed_state(
        contract=_confirmed_contract(),
        ui_review={"review_clean": True, "findings": []},
    )

    result = ui.run(state)

    assert result.outcome is Outcome.SUCCESS
    assert result.questions == []


def test_ui_idempotent_on_clean_review() -> None:
    """Re-entering with a clean review must not re-emit the delegation."""
    state = _mixed_state(
        contract=_confirmed_contract(),
        ui_review={"review_clean": True},
    )

    first = ui.run(state)
    second = ui.run(state)

    assert first.outcome is Outcome.SUCCESS
    assert second.outcome is Outcome.SUCCESS


def test_ui_halts_when_review_unclean() -> None:
    state = _mixed_state(
        contract=_confirmed_contract(),
        ui_review={
            "review_clean": False,
            "findings": [{"id": "F-1"}, {"id": "F-2"}, {"id": "F-3"}],
        },
    )

    result = ui.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions)
    assert "Findings remaining: 3" in body
    assert "> 1." in body and "> 2." in body and "> 3." in body
    # Unclean halt is user-facing; not an agent directive.
    assert not result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)


# --- ambiguity declaration --------------------------------------------------


def test_ui_declares_four_ambiguity_codes() -> None:
    codes = {entry["code"] for entry in ui.AMBIGUITIES}
    assert codes == {
        "upstream_contract_failed",
        "contract_sentinel_missing",
        "ui_track_not_started",
        "ui_track_review_unclean",
    }
