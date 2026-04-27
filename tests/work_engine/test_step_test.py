"""Tests for the ``test`` step — gate + run-tests directive.

Five outcomes: precondition block, directive delegation, shape
failure, non-success verdict block, and the clean success path.
"""
from __future__ import annotations

from work_engine import AGENT_DIRECTIVE_PREFIX, DeliveryState, Outcome
from work_engine.steps import test as test_step


def _state(**overrides) -> DeliveryState:
    ticket = {"id": "TICKET-42", "title": "Add export button"}
    ticket.update(overrides.pop("ticket", {}))
    state = DeliveryState(ticket=ticket, **overrides)
    state.outcomes["implement"] = Outcome.SUCCESS.value
    return state


def test_test_blocks_when_implement_did_not_succeed() -> None:
    state = _state()
    state.outcomes["implement"] = Outcome.PARTIAL.value

    result = test_step.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "implement gate" in result.message


def test_test_delegates_with_targeted_scope_when_tests_is_empty() -> None:
    state = _state()

    result = test_step.run(state)

    assert result.outcome is Outcome.BLOCKED
    directive = result.questions[0]
    assert directive.startswith(AGENT_DIRECTIVE_PREFIX)
    assert "run-tests" in directive
    assert "scope=targeted" in directive


def test_test_succeeds_on_success_verdict() -> None:
    state = _state(tests={"verdict": "success", "targeted": "all green"})

    result = test_step.run(state)

    assert result.outcome is Outcome.SUCCESS


def test_test_blocks_on_failed_verdict() -> None:
    state = _state(tests={"verdict": "failed", "targeted": "3 failures"})

    result = test_step.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "`failed`" in result.message


def test_test_blocks_on_mixed_verdict() -> None:
    state = _state(tests={"verdict": "mixed"})

    result = test_step.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "`mixed`" in result.message


def test_test_blocks_when_tests_is_not_a_dict() -> None:
    state = _state(tests="all green")

    result = test_step.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "must be a dict" in result.message


def test_test_blocks_on_unknown_verdict() -> None:
    state = _state(tests={"verdict": "maybe"})

    result = test_step.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "verdict" in result.message
    assert "'maybe'" in result.message


def test_test_blocks_when_verdict_key_is_missing() -> None:
    state = _state(tests={"targeted": "all green"})

    result = test_step.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "verdict" in result.message
