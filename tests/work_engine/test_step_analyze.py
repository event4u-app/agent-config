"""Tests for the ``analyze`` precondition gate.

Analyze does no work of its own; it refuses to advance the flow when
upstream state is incoherent. The tests lock down the precondition
list and the BLOCKED shape so a resuming caller cannot slip past
the gate with a partially-initialised state.
"""
from __future__ import annotations

from work_engine import DeliveryState, Outcome
from work_engine.steps import analyze


def _state_with_upstream_success(**overrides) -> DeliveryState:
    """A DeliveryState that satisfies every precondition by default."""
    ticket = {
        "id": "TICKET-42",
        "title": "Add export button",
        "acceptance_criteria": ["Export downloads a CSV within two clicks."],
    }
    ticket.update(overrides.pop("ticket", {}))
    state = DeliveryState(ticket=ticket, **overrides)
    state.outcomes["refine"] = Outcome.SUCCESS.value
    state.outcomes["memory"] = Outcome.SUCCESS.value
    return state


def test_analyze_succeeds_when_upstream_is_coherent() -> None:
    state = _state_with_upstream_success()

    result = analyze.run(state)

    assert result.outcome is Outcome.SUCCESS
    assert result.questions == []


def test_analyze_does_not_mutate_state_on_success() -> None:
    state = _state_with_upstream_success()
    snapshot_plan = state.plan
    snapshot_memory = list(state.memory)

    analyze.run(state)

    assert state.plan is snapshot_plan
    assert state.memory == snapshot_memory


def test_analyze_blocks_when_refine_did_not_succeed() -> None:
    state = _state_with_upstream_success()
    state.outcomes["refine"] = Outcome.BLOCKED.value

    result = analyze.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "refine step did not complete successfully" in result.message
    # Numbered options plus a headnote.
    assert len(result.questions) >= 2


def test_analyze_blocks_when_memory_did_not_succeed() -> None:
    state = _state_with_upstream_success()
    state.outcomes["memory"] = Outcome.PARTIAL.value

    result = analyze.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "memory step did not complete successfully" in result.message


def test_analyze_blocks_when_ticket_lost_its_acceptance_criteria() -> None:
    state = _state_with_upstream_success()
    state.ticket["acceptance_criteria"] = []

    result = analyze.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "acceptance criteria" in result.message


def test_analyze_lists_every_failure_in_one_shot() -> None:
    state = _state_with_upstream_success()
    state.outcomes["refine"] = "blocked"
    state.outcomes["memory"] = "blocked"
    state.ticket["acceptance_criteria"] = None

    result = analyze.run(state)

    assert result.outcome is Outcome.BLOCKED
    # All three complaints must surface in the single message so the
    # user can fix them in one go rather than re-running the gate.
    assert "refine" in result.message
    assert "memory" in result.message
    assert "acceptance criteria" in result.message


def test_analyze_blocked_questions_cite_the_ticket_id() -> None:
    state = _state_with_upstream_success(ticket={"id": "TICKET-99"})
    state.outcomes["refine"] = "blocked"

    result = analyze.run(state)

    headnote = result.questions[0]
    assert "TICKET-99" in headnote
