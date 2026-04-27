"""Tests for the ``implement`` step — gate + apply-plan directive.

Four outcomes: precondition block, directive delegation, shape
validation failure, and the clean success path.
"""
from __future__ import annotations

from work_engine import AGENT_DIRECTIVE_PREFIX, DeliveryState, Outcome
from work_engine.steps import implement


def _state(**overrides) -> DeliveryState:
    ticket = {"id": "TICKET-42", "title": "Add export button"}
    ticket.update(overrides.pop("ticket", {}))
    state = DeliveryState(ticket=ticket, **overrides)
    state.outcomes["plan"] = Outcome.SUCCESS.value
    return state


def test_implement_blocks_when_plan_did_not_succeed() -> None:
    state = _state()
    state.outcomes["plan"] = Outcome.BLOCKED.value

    result = implement.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "plan gate" in result.message
    assert not any(q.startswith(AGENT_DIRECTIVE_PREFIX) for q in result.questions)


def test_implement_delegates_when_changes_is_empty() -> None:
    state = _state()

    result = implement.run(state)

    assert result.outcome is Outcome.BLOCKED
    directive = result.questions[0]
    assert directive.startswith(AGENT_DIRECTIVE_PREFIX)
    assert "apply-plan" in directive
    assert "ticket=TICKET-42" in directive


def test_implement_succeeds_when_changes_carry_paths() -> None:
    state = _state(changes=[
        {"path": "app/Http/Controllers/Export.php", "purpose": "new endpoint"},
        {"path": "resources/views/exports.blade.php"},
    ])

    result = implement.run(state)

    assert result.outcome is Outcome.SUCCESS


def test_implement_accepts_file_alias_for_path() -> None:
    """The loose shape in the flow contract allows ``file`` as alias."""
    state = _state(changes=[{"file": "config/app.php"}])

    result = implement.run(state)

    assert result.outcome is Outcome.SUCCESS


def test_implement_blocks_when_change_entry_is_not_a_dict() -> None:
    state = _state(changes=["a raw string, no shape"])

    result = implement.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "not a dict" in result.message


def test_implement_blocks_when_change_has_no_path() -> None:
    state = _state(changes=[{"purpose": "no path here"}])

    result = implement.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "no path" in result.message


def test_implement_reports_every_shape_failure() -> None:
    state = _state(changes=[
        {"path": "ok.php"},
        "raw string",
        {"purpose": "no path"},
    ])

    result = implement.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "change #2" in result.message
    assert "change #3" in result.message
