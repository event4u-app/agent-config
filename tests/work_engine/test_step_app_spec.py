"""Tests for the ``ui.app_spec`` step — greenfield-scaffold Phase 2.

The app-spec gate occupies the UI set's ``memory`` slot. It is a no-op
``SUCCESS`` for every non-greenfield-scaffold flow and only engages the
derive → confirm / bypass loop when the audit recorded a ``scaffold``
greenfield decision.

Branches covered:

- Non-greenfield (no audit / improve flow) — clean ``SUCCESS`` no-op.
- Greenfield ``bare`` / ``external_reference`` / undecided — no-op.
- Greenfield ``scaffold``, ``app_spec`` empty / None / non-dict /
  no ``pages`` — emits the ``@agent-directive: app-spec`` first-pass halt.
- Greenfield ``scaffold``, populated but unconfirmed — emits the
  lightweight confirm halt.
- Greenfield ``scaffold``, confirmed — passes through (idempotent).
- Greenfield ``scaffold``, bypassed — passes through even without a
  derived page-set.

The handler is pure, so no fakes are needed.
"""
from __future__ import annotations

from work_engine import DeliveryState, Outcome
from work_engine.delivery_state import AGENT_DIRECTIVE_PREFIX
from work_engine.directives.ui import app_spec


def _state(
    *,
    ui_audit: object | None = None,
    app_spec_slice: object | None = None,
) -> DeliveryState:
    """Build a UI-routed DeliveryState with an audit + app_spec overlay."""
    state = DeliveryState(
        ticket={
            "id": "UI-1",
            "title": "Build a project management app",
            "raw": "Build a project management app with boards and tasks",
        },
    )
    state.ui_audit = ui_audit  # type: ignore[assignment]
    state.app_spec = app_spec_slice  # type: ignore[assignment]
    return state


def _scaffold_audit() -> dict[str, object]:
    return {"greenfield": True, "greenfield_decision": "scaffold"}


# --- no-op paths (gate inert) -------------------------------------------------


def test_no_op_when_no_audit() -> None:
    result = app_spec.run(_state(ui_audit=None))
    assert result.outcome is Outcome.SUCCESS
    assert result.questions == []


def test_no_op_for_improve_flow() -> None:
    audit = {"components_found": [{"name": "Card", "similarity": 0.8}]}
    result = app_spec.run(_state(ui_audit=audit))
    assert result.outcome is Outcome.SUCCESS


def test_no_op_for_bare_greenfield() -> None:
    audit = {"greenfield": True, "greenfield_decision": "bare"}
    result = app_spec.run(_state(ui_audit=audit))
    assert result.outcome is Outcome.SUCCESS


def test_no_op_for_external_reference_greenfield() -> None:
    audit = {"greenfield": True, "greenfield_decision": "external_reference"}
    result = app_spec.run(_state(ui_audit=audit))
    assert result.outcome is Outcome.SUCCESS


def test_no_op_for_greenfield_without_decision() -> None:
    audit = {"greenfield": True}
    result = app_spec.run(_state(ui_audit=audit))
    assert result.outcome is Outcome.SUCCESS


# --- first-pass derivation halt ----------------------------------------------


def test_first_pass_directive_when_app_spec_none() -> None:
    result = app_spec.run(_state(ui_audit=_scaffold_audit(), app_spec_slice=None))
    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)
    assert "app-spec" in result.questions[0]
    numbered = [q for q in result.questions if q.startswith("> 1.")]
    assert numbered
    body = "\n".join(result.questions)
    assert "just scaffold" in body.lower()  # bypass offered up front
    assert "**Recommendation: 1" in body


def test_first_pass_directive_when_app_spec_empty_dict() -> None:
    result = app_spec.run(_state(ui_audit=_scaffold_audit(), app_spec_slice={}))
    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)


def test_first_pass_directive_when_app_spec_non_dict() -> None:
    result = app_spec.run(
        _state(ui_audit=_scaffold_audit(), app_spec_slice=["not", "a", "dict"]),
    )
    assert result.outcome is Outcome.BLOCKED


def test_first_pass_directive_when_pages_missing() -> None:
    """A dict without a ``pages`` list still counts as "skill not run"."""
    result = app_spec.run(
        _state(ui_audit=_scaffold_audit(), app_spec_slice={"entity_model": []}),
    )
    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)


def test_first_pass_directive_carries_input_preview() -> None:
    result = app_spec.run(_state(ui_audit=_scaffold_audit(), app_spec_slice=None))
    body = "\n".join(result.questions)
    assert "> Input: Build a project management app" in body


# --- confirm halt ------------------------------------------------------------


def test_confirm_halt_when_populated_but_unconfirmed() -> None:
    spec = {
        "pages": ["Dashboard", "Board", "TaskDetail"],
        "entity_model": ["Board", "Task"],
        "flow_map": [],
    }
    result = app_spec.run(_state(ui_audit=_scaffold_audit(), app_spec_slice=spec))
    assert result.outcome is Outcome.BLOCKED
    # confirm halt is a user-facing question, NOT an agent directive
    assert not result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)
    body = "\n".join(result.questions)
    assert "Dashboard" in body
    assert "Pages (3)" in body
    assert "Entities (2)" in body
    assert "**Recommendation: 1 — Confirm" in body
    numbered = [q for q in result.questions if q.startswith("> 1.")]
    assert numbered


def test_confirm_halt_message_is_app_spec_unconfirmed() -> None:
    spec = {"pages": ["Home"]}
    result = app_spec.run(_state(ui_audit=_scaffold_audit(), app_spec_slice=spec))
    assert result.outcome is Outcome.BLOCKED
    assert "confirm" in result.message.lower()


# --- success / bypass paths --------------------------------------------------


def test_success_when_confirmed() -> None:
    spec = {"pages": ["Home"], "confirmed": True}
    result = app_spec.run(_state(ui_audit=_scaffold_audit(), app_spec_slice=spec))
    assert result.outcome is Outcome.SUCCESS
    assert result.questions == []


def test_confirmed_is_idempotent_on_reentry() -> None:
    spec = {"pages": ["Home", "Settings"], "confirmed": True}
    state = _state(ui_audit=_scaffold_audit(), app_spec_slice=spec)
    first = app_spec.run(state)
    second = app_spec.run(state)
    assert first.outcome is Outcome.SUCCESS
    assert second.outcome is Outcome.SUCCESS


def test_bypass_short_circuits_before_population() -> None:
    """``bypassed`` wins even when no page-set was derived."""
    spec = {"bypassed": True}
    result = app_spec.run(_state(ui_audit=_scaffold_audit(), app_spec_slice=spec))
    assert result.outcome is Outcome.SUCCESS


def test_bypass_wins_over_unconfirmed() -> None:
    spec = {"pages": ["Home"], "bypassed": True}
    result = app_spec.run(_state(ui_audit=_scaffold_audit(), app_spec_slice=spec))
    assert result.outcome is Outcome.SUCCESS
