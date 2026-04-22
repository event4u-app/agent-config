"""Phase 0 spike — pytest smoke for the Python dispatcher.

Measures test-writability: can we assert on outcomes, questions, and
exit codes without shelling out? Throwaway.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from delivery_state import DeliveryState, Outcome  # noqa: E402
from implement_ticket import dispatch  # noqa: E402


def _state(**ticket_overrides) -> DeliveryState:
    ticket = {
        "id": "TEST-1",
        "title": "fixture",
        "acceptance_criteria": ["one concrete AC"],
        **ticket_overrides,
    }
    return DeliveryState(ticket=ticket)


def test_clean_ticket_runs_all_eight_steps_to_success() -> None:
    state = _state()

    final, block_step = dispatch(state)

    assert final is Outcome.SUCCESS
    assert block_step is None
    assert list(state.outcomes) == [
        "refine", "memory", "analyze", "plan",
        "implement", "test", "verify", "report",
    ]
    assert all(v == "success" for v in state.outcomes.values())


def test_empty_ac_blocks_at_refine() -> None:
    state = _state(acceptance_criteria=[])

    final, block_step = dispatch(state)

    assert final is Outcome.BLOCKED
    assert block_step == "refine"
    assert state.outcomes == {"refine": "blocked"}
    assert len(state.questions) == 3
    assert all(q[0].isdigit() for q in state.questions)


def test_block_halts_remaining_steps() -> None:
    state = _state(acceptance_criteria=[])

    dispatch(state)

    # Only `refine` ran; the remaining seven steps must not appear.
    assert "memory" not in state.outcomes
    assert "report" not in state.outcomes
