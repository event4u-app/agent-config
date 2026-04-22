"""Tests for the ``/implement-ticket`` linear dispatcher.

Phase 1 scope: the dispatcher and ``DeliveryState`` contract. Real
step handlers arrive in Phase 2 — these tests inject minimal fakes so
each of the three terminal outcomes is exercised against the real
control flow, not against a mock of the dispatcher itself.
"""
from __future__ import annotations

import pytest

from implement_ticket import (
    STEP_ORDER,
    DeliveryState,
    Outcome,
    StepResult,
    dispatch,
)


def _always_success(_state: DeliveryState) -> StepResult:
    return StepResult(outcome=Outcome.SUCCESS)


def _all_success_steps() -> dict[str, object]:
    return {name: _always_success for name in STEP_ORDER}


def _state(**ticket_overrides) -> DeliveryState:
    ticket = {
        "id": "TICKET-1",
        "title": "fixture ticket",
        "acceptance_criteria": ["one concrete AC"],
        **ticket_overrides,
    }
    return DeliveryState(ticket=ticket)


def test_dispatch_success_runs_every_step_in_order() -> None:
    state = _state()

    final, halting_step = dispatch(state, _all_success_steps())

    assert final is Outcome.SUCCESS
    assert halting_step is None
    assert tuple(state.outcomes) == STEP_ORDER
    assert all(value == "success" for value in state.outcomes.values())
    assert state.questions == []


def test_dispatch_blocked_halts_at_first_blocking_step() -> None:
    blocking_questions = [
        "> 1. Define a measurable performance target.",
        "> 2. Drop the ticket — too vague to execute.",
    ]

    def _block_at_refine(_state: DeliveryState) -> StepResult:
        return StepResult(outcome=Outcome.BLOCKED, questions=blocking_questions)

    steps = _all_success_steps()
    steps["refine"] = _block_at_refine

    state = _state(acceptance_criteria=[])

    final, halting_step = dispatch(state, steps)

    assert final is Outcome.BLOCKED
    assert halting_step == "refine"
    assert state.outcomes == {"refine": "blocked"}
    assert state.questions == blocking_questions
    # No later step may run once refine blocks.
    assert "memory" not in state.outcomes
    assert "report" not in state.outcomes


def test_dispatch_partial_halts_and_surfaces_questions() -> None:
    partial_questions = ["> 1. Continue with the partial plan.", "> 2. Abort."]

    def _partial_at_plan(state: DeliveryState) -> StepResult:
        state.plan = {"sketch": "only the happy path"}
        return StepResult(outcome=Outcome.PARTIAL, questions=partial_questions)

    steps = _all_success_steps()
    steps["plan"] = _partial_at_plan

    state = _state()

    final, halting_step = dispatch(state, steps)

    assert final is Outcome.PARTIAL
    assert halting_step == "plan"
    assert state.outcomes == {
        "refine": "success",
        "memory": "success",
        "analyze": "success",
        "plan": "partial",
    }
    assert state.plan == {"sketch": "only the happy path"}
    assert state.questions == partial_questions


def test_dispatch_rejects_missing_step_handlers() -> None:
    steps = _all_success_steps()
    del steps["verify"]
    del steps["report"]

    with pytest.raises(KeyError) as excinfo:
        dispatch(_state(), steps)

    message = str(excinfo.value)
    assert "verify" in message
    assert "report" in message


def test_dispatch_rejects_blocked_without_questions() -> None:
    def _silent_block(_state: DeliveryState) -> StepResult:
        return StepResult(outcome=Outcome.BLOCKED)

    steps = _all_success_steps()
    steps["refine"] = _silent_block

    with pytest.raises(ValueError, match="refine"):
        dispatch(_state(), steps)


def test_dispatch_rejects_partial_without_questions() -> None:
    def _silent_partial(_state: DeliveryState) -> StepResult:
        return StepResult(outcome=Outcome.PARTIAL)

    steps = _all_success_steps()
    steps["plan"] = _silent_partial

    with pytest.raises(ValueError, match="plan"):
        dispatch(_state(), steps)


def test_delivery_state_defaults_isolate_between_instances() -> None:
    one = DeliveryState(ticket={"id": "A"})
    two = DeliveryState(ticket={"id": "B"})

    one.memory.append({"id": "inv-1"})
    one.outcomes["refine"] = "success"

    assert two.memory == []
    assert two.outcomes == {}
