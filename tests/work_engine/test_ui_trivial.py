"""Unit tests for the ``ui-trivial`` directive set (R3 Phase 2 Step 6).

The trivial path short-circuits the audit / design / review / polish
loop for single-file ≤5-line edits. These tests pin the contract:

- ``apply`` delegates to the agent on first pass (no envelope yet);
- ``apply`` records a clean change entry when preconditions pass;
- ``apply`` halts with the reclassification directive on every
  precondition violation (multi-file, line ceiling, new component,
  new state, new dependency);
- the violation halt sets ``state.ticket['__reclassify_to__']`` so the
  orchestrator knows to promote ``directive_set`` to ``ui-improve``;
- ``refine`` is a silent pass when the intent is ``ui-trivial`` (or
  absent) and a halt when the routing landed on the wrong intent;
- ``test`` delegates to the smoke runner when ``state.tests`` is empty
  and halts on a non-success verdict;
- ``report`` renders the one-line delivery summary without raising.
"""
from __future__ import annotations

import pytest

from work_engine.delivery_state import DeliveryState, Outcome, is_agent_directive
from work_engine.directives.ui_trivial import apply, refine, report, test


def _state(**ticket_overrides: object) -> DeliveryState:
    ticket = {"id": "T-trivial", "title": "make the Save button red", "acceptance_criteria": []}
    ticket.update(ticket_overrides)
    return DeliveryState(ticket=ticket)


def _envelope(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "files": ["resources/views/components/save-button.blade.php"],
        "lines_changed": 1,
        "summary": "swap text-blue-500 for text-red-500",
        "new_component": False,
        "new_state": False,
        "new_dependency": False,
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------- apply


def test_apply_first_pass_delegates_to_agent() -> None:
    state = _state()
    result = apply.run(state)
    assert result.outcome is Outcome.BLOCKED
    assert is_agent_directive(result.questions[0])
    assert "trivial-apply" in result.questions[0]


def test_apply_records_change_when_preconditions_pass() -> None:
    state = _state(trivial_edit=_envelope())
    result = apply.run(state)
    assert result.outcome is Outcome.SUCCESS
    assert len(state.changes) == 1
    change = state.changes[0]
    assert change["kind"] == "ui-trivial"
    assert change["lines_changed"] == 1
    assert change["files"] == ["resources/views/components/save-button.blade.php"]


def test_apply_reclassifies_on_multi_file_edit() -> None:
    state = _state(trivial_edit=_envelope(files=["a.blade.php", "b.blade.php"]))
    result = apply.run(state)
    assert result.outcome is Outcome.BLOCKED
    assert "reclassify-to-ui-improve" in result.questions[0]
    assert state.ticket["__reclassify_to__"] == "ui-improve"
    assert "trivial_edit" not in state.ticket


def test_apply_reclassifies_on_line_ceiling() -> None:
    state = _state(trivial_edit=_envelope(lines_changed=apply.MAX_LINES_CHANGED + 1))
    result = apply.run(state)
    assert result.outcome is Outcome.BLOCKED
    assert state.ticket["__reclassify_to__"] == "ui-improve"


@pytest.mark.parametrize("flag", ["new_component", "new_state", "new_dependency"])
def test_apply_reclassifies_on_safety_flag(flag: str) -> None:
    state = _state(trivial_edit=_envelope(**{flag: True}))
    result = apply.run(state)
    assert result.outcome is Outcome.BLOCKED
    assert state.ticket["__reclassify_to__"] == "ui-improve"
    assert flag in result.message


# ---------------------------------------------------------------- refine


def test_refine_passes_when_intent_matches() -> None:
    state = _state(intent="ui-trivial")
    assert refine.run(state).outcome is Outcome.SUCCESS


def test_refine_passes_when_intent_absent() -> None:
    """v0 callers carry no intent label — the trivial path tolerates that."""
    assert refine.run(_state()).outcome is Outcome.SUCCESS


def test_refine_halts_on_wrong_intent() -> None:
    state = _state(intent="ui-build")
    result = refine.run(state)
    assert result.outcome is Outcome.BLOCKED
    assert "ui-build" in result.message


# ---------------------------------------------------------------- test


def test_test_delegates_when_no_verdict_recorded() -> None:
    state = _state()
    result = test.run(state)
    assert result.outcome is Outcome.BLOCKED
    assert is_agent_directive(result.questions[0])
    assert "scope=smoke" in result.questions[0]


def test_test_passes_on_success_verdict() -> None:
    state = _state()
    state.tests = {"verdict": "success", "scope": "smoke"}
    assert test.run(state).outcome is Outcome.SUCCESS


@pytest.mark.parametrize("verdict", ["failed", "mixed"])
def test_test_halts_on_bad_verdict(verdict: str) -> None:
    state = _state()
    state.tests = {"verdict": verdict, "scope": "smoke"}
    result = test.run(state)
    assert result.outcome is Outcome.BLOCKED
    assert verdict in result.message


# ---------------------------------------------------------------- report


def test_report_renders_one_line_summary() -> None:
    state = _state(trivial_edit=_envelope())
    apply.run(state)
    state.tests = {"verdict": "success", "scope": "smoke"}
    result = report.run(state)
    assert result.outcome is Outcome.SUCCESS
    assert "Trivial edit" in state.report
    assert "save-button" in state.report
    assert "smoke: **success**" in state.report


def test_report_handles_missing_change_entry() -> None:
    """No trivial change recorded → fallback summary, still SUCCESS."""
    result = report.run(_state())
    assert result.outcome is Outcome.SUCCESS
