"""Tests for the ``plan`` step — gate + Option-A delegation to ``feature-plan``.

Three outcomes the step must navigate correctly:

1. ``analyze`` has not succeeded → BLOCKED on precondition.
2. ``state.plan`` is empty → BLOCKED with ``@agent-directive: create-plan``.
3. ``state.plan`` is populated with a valid shape → SUCCESS.
4. ``state.plan`` is populated but malformed → BLOCKED with shape complaint.
"""
from __future__ import annotations

from work_engine import AGENT_DIRECTIVE_PREFIX, DeliveryState, Outcome
from work_engine.directives.backend import plan as plan_step


def _state(**overrides) -> DeliveryState:
    ticket = {"id": "TICKET-42", "title": "Add export button"}
    ticket.update(overrides.pop("ticket", {}))
    state = DeliveryState(ticket=ticket, **overrides)
    state.outcomes["analyze"] = Outcome.SUCCESS.value
    return state


def test_plan_blocks_when_analyze_did_not_succeed() -> None:
    state = _state()
    state.outcomes["analyze"] = Outcome.BLOCKED.value

    result = plan_step.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "analyze gate" in result.message
    # Precondition block is user-facing only \u2014 no agent directive here,
    # because the agent cannot fix an upstream gate failure.
    assert not any(q.startswith(AGENT_DIRECTIVE_PREFIX) for q in result.questions)


def test_plan_delegates_to_feature_plan_when_plan_is_empty() -> None:
    state = _state()
    # state.plan defaults to None \u2014 empty.

    result = plan_step.run(state)

    assert result.outcome is Outcome.BLOCKED
    directive = result.questions[0]
    assert directive.startswith(AGENT_DIRECTIVE_PREFIX)
    assert "create-plan" in directive
    assert "ticket=TICKET-42" in directive


def test_plan_treats_blank_string_as_empty() -> None:
    state = _state(plan="   ")

    result = plan_step.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)


def test_plan_treats_empty_list_as_empty() -> None:
    state = _state(plan=[])

    result = plan_step.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)


def test_plan_succeeds_on_valid_string_plan() -> None:
    state = _state(plan="1. Add endpoint\n2. Wire button")

    result = plan_step.run(state)

    assert result.outcome is Outcome.SUCCESS


def test_plan_succeeds_on_valid_list_of_strings() -> None:
    state = _state(plan=["Add endpoint", "Wire button"])

    result = plan_step.run(state)

    assert result.outcome is Outcome.SUCCESS


def test_plan_succeeds_on_valid_list_of_title_dicts() -> None:
    state = _state(plan=[
        {"title": "Add endpoint", "detail": "GET /exports"},
        {"title": "Wire button"},
    ])

    result = plan_step.run(state)

    assert result.outcome is Outcome.SUCCESS


def test_plan_succeeds_on_dict_with_steps_key() -> None:
    state = _state(plan={"steps": [{"title": "Add endpoint"}], "followups": []})

    result = plan_step.run(state)

    assert result.outcome is Outcome.SUCCESS


def test_plan_blocks_when_list_contains_untitled_step_dict() -> None:
    state = _state(plan=[{"detail": "no title here"}])

    result = plan_step.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "no title" in result.message
    # Shape failure is user-facing, not an agent directive.
    assert not any(q.startswith(AGENT_DIRECTIVE_PREFIX) for q in result.questions)


def test_plan_blocks_on_unsupported_type() -> None:
    state = _state(plan=42)

    result = plan_step.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "unsupported type" in result.message


def test_plan_blocks_when_dict_has_no_steps_key() -> None:
    state = _state(plan={"followups": ["something"]})

    result = plan_step.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "steps" in result.message
