"""Tests for the ``verify`` step — gate + review-changes directive.

Same five outcomes as the ``test`` step, but with the
``review-changes`` vocabulary (success / blocked / partial).
"""
from __future__ import annotations

from work_engine import AGENT_DIRECTIVE_PREFIX, DeliveryState, Outcome
from work_engine.steps import verify


def _state(**overrides) -> DeliveryState:
    ticket = {"id": "TICKET-42", "title": "Add export button"}
    ticket.update(overrides.pop("ticket", {}))
    state = DeliveryState(ticket=ticket, **overrides)
    state.outcomes["test"] = Outcome.SUCCESS.value
    return state


def test_verify_blocks_when_test_did_not_succeed() -> None:
    state = _state()
    state.outcomes["test"] = Outcome.BLOCKED.value

    result = verify.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "test gate" in result.message


def test_verify_delegates_to_review_changes_when_verify_is_empty() -> None:
    state = _state()

    result = verify.run(state)

    assert result.outcome is Outcome.BLOCKED
    directive = result.questions[0]
    assert directive.startswith(AGENT_DIRECTIVE_PREFIX)
    assert "review-changes" in directive


def test_verify_succeeds_on_success_verdict() -> None:
    state = _state(verify={"verdict": "success", "confidence": "high"})

    result = verify.run(state)

    assert result.outcome is Outcome.SUCCESS


def test_verify_blocks_on_blocked_verdict() -> None:
    state = _state(verify={"verdict": "blocked", "findings": ["auth gap"]})

    result = verify.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "`blocked`" in result.message


def test_verify_blocks_on_partial_verdict() -> None:
    state = _state(verify={"verdict": "partial"})

    result = verify.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "`partial`" in result.message


def test_verify_blocks_when_not_a_dict() -> None:
    state = _state(verify="looks fine")

    result = verify.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "must be a dict" in result.message


def test_verify_blocks_on_unknown_verdict() -> None:
    state = _state(verify={"verdict": "yolo"})

    result = verify.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "'yolo'" in result.message
