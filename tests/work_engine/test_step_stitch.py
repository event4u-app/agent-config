"""Tests for the ``mixed.stitch`` step — Phase 4 Step 3 of the UI track.

Branches covered:

- Upstream ``implement`` outcome is not ``success`` — emits the
  precondition halt; no agent directive.
- ``state.stitch`` empty / ``None`` — emits the
  ``@agent-directive: integration-test`` delegation halt with the
  endpoint count from the contract.
- ``state.stitch`` shape malformed (non-dict, bad verdict) — emits
  the shape halt; verdict cannot be trusted.
- ``state.stitch.verdict = "success"`` — passes through to
  ``SUCCESS`` (idempotent).
- Verdict ``blocked`` / ``partial`` and not user-confirmed —
  emits the bad-verdict halt with three numbered options.
- Verdict ``blocked`` / ``partial`` with
  ``integration_confirmed = True`` — passes as user override.
- Ambiguity surface declares all four codes.
"""
from __future__ import annotations

from work_engine import DeliveryState, Outcome
from work_engine.delivery_state import AGENT_DIRECTIVE_PREFIX
from work_engine.directives.mixed import stitch


def _mixed_state(**overrides: object) -> DeliveryState:
    """Build a DeliveryState shaped like a mixed-routed envelope post-implement."""
    ticket: dict[str, object] = {
        "id": "MIX-3",
        "title": "Add saved-search form with persistence endpoint",
        "raw": "Add saved-search form with persistence endpoint",
        "confidence": {"band": "high"},
    }
    state = DeliveryState(ticket=ticket)
    state.outcomes["implement"] = Outcome.SUCCESS.value
    state.contract = {
        "data_model": [{"name": "SavedSearch"}],
        "api_surface": [
            {"method": "POST", "path": "/saved-searches"},
            {"method": "GET", "path": "/saved-searches"},
        ],
        "contract_confirmed": True,
    }
    for key, value in overrides.items():
        setattr(state, key, value)
    return state


# --- precondition halt ------------------------------------------------------


def test_stitch_blocks_when_implement_did_not_succeed() -> None:
    state = _mixed_state()
    state.outcomes.pop("implement", None)

    result = stitch.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert not result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)
    assert "implement" in "\n".join(result.questions).lower()


def test_stitch_blocks_when_implement_outcome_is_blocked() -> None:
    state = _mixed_state()
    state.outcomes["implement"] = Outcome.BLOCKED.value

    result = stitch.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert not result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)


# --- integration-test directive halt ---------------------------------------


def test_stitch_emits_directive_when_stitch_is_none() -> None:
    state = _mixed_state(stitch=None)

    result = stitch.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)
    assert "integration-test" in result.questions[0]


def test_stitch_emits_directive_when_stitch_is_empty_dict() -> None:
    state = _mixed_state(stitch={})

    result = stitch.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)


def test_stitch_directive_carries_input_preview_and_endpoint_count() -> None:
    state = _mixed_state(stitch=None)

    result = stitch.run(state)

    body = "\n".join(result.questions)
    assert "> Input: Add saved-search form with persistence endpoint" in body
    assert "Endpoints / actions to smoke: 2" in body


# --- malformed-shape halt --------------------------------------------------


def test_stitch_halts_when_verdict_is_invalid() -> None:
    state = _mixed_state(stitch={"verdict": "wat"})

    result = stitch.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions)
    assert "verdict" in body
    assert "malformed" in body.lower()


# --- success path ----------------------------------------------------------


def test_stitch_passes_when_verdict_is_success() -> None:
    state = _mixed_state(
        stitch={"verdict": "success", "scenarios": [{"id": "S-1"}]},
    )

    result = stitch.run(state)

    assert result.outcome is Outcome.SUCCESS
    assert result.questions == []


def test_stitch_idempotent_on_success_verdict() -> None:
    state = _mixed_state(stitch={"verdict": "success"})

    first = stitch.run(state)
    second = stitch.run(state)

    assert first.outcome is Outcome.SUCCESS
    assert second.outcome is Outcome.SUCCESS


# --- bad-verdict halt ------------------------------------------------------


def test_stitch_halts_on_blocked_verdict_without_override() -> None:
    state = _mixed_state(
        stitch={
            "verdict": "blocked",
            "scenarios": [{"id": "S-1"}, {"id": "S-2"}],
        },
    )

    result = stitch.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions)
    assert "`blocked`" in body
    assert "2 scenario(s)" in body
    assert "> 1." in body and "> 2." in body and "> 3." in body
    assert not result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)


def test_stitch_halts_on_partial_verdict_without_override() -> None:
    state = _mixed_state(stitch={"verdict": "partial"})

    result = stitch.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions)
    assert "`partial`" in body
    assert "0 scenario(s)" in body


def test_stitch_halts_when_integration_confirmed_is_false() -> None:
    state = _mixed_state(
        stitch={"verdict": "blocked", "integration_confirmed": False},
    )

    result = stitch.run(state)

    assert result.outcome is Outcome.BLOCKED


# --- user override ---------------------------------------------------------


def test_stitch_passes_with_override_on_blocked_verdict() -> None:
    state = _mixed_state(
        stitch={"verdict": "blocked", "integration_confirmed": True},
    )

    result = stitch.run(state)

    assert result.outcome is Outcome.SUCCESS
    assert "overridden" in (result.message or "").lower()


def test_stitch_passes_with_override_on_partial_verdict() -> None:
    state = _mixed_state(
        stitch={"verdict": "partial", "integration_confirmed": True},
    )

    result = stitch.run(state)

    assert result.outcome is Outcome.SUCCESS


def test_stitch_override_does_not_apply_on_malformed_shape() -> None:
    """Override only short-circuits past a clean verdict, not malformed shape."""
    state = _mixed_state(
        stitch={"verdict": "wat", "integration_confirmed": True},
    )

    result = stitch.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "malformed" in "\n".join(result.questions).lower()


# --- ambiguity declaration -------------------------------------------------


def test_stitch_declares_four_ambiguity_codes() -> None:
    codes = {entry["code"] for entry in stitch.AMBIGUITIES}
    assert codes == {
        "upstream_ui_failed",
        "empty_stitch_delegate",
        "malformed_stitch",
        "bad_stitch_verdict",
    }

