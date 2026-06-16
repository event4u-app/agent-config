"""Tests for the ``ui.scaffold`` step — greenfield-scaffold Phase 3.

The scaffold gate occupies the UI set's ``plan`` slot (after design). It
is a no-op ``SUCCESS`` for every non-greenfield-scaffold flow and only
engages the plan → build loop when the audit recorded a ``scaffold``
greenfield decision.

Branches covered:

- Non-greenfield / ``bare`` / ``external_reference`` — clean ``SUCCESS``
  no-op (keeps existing flows byte-identical).
- Greenfield ``scaffold``, no plan (None / empty / ``pages`` only) —
  emits the stack-agnostic ``@agent-directive: ui-scaffold-plan`` halt.
- Greenfield ``scaffold``, plan present, ``scaffolded`` not True —
  emits the stack-specific build directive.
- Greenfield ``scaffold``, ``scaffolded`` True — passes through
  (idempotent); the engine never wrote files.
- Stack dispatch picks the matching build directive; unknown stack
  falls back to ``ui-scaffold-plain``.
"""
from __future__ import annotations

from work_engine import DeliveryState, Outcome
from work_engine.delivery_state import AGENT_DIRECTIVE_PREFIX
from work_engine.directives.ui import scaffold


def _state(
    *,
    ui_audit: object | None = None,
    ui_scaffold: object | None = None,
    stack: object | None = None,
) -> DeliveryState:
    state = DeliveryState(
        ticket={
            "id": "UI-1",
            "title": "Build a project management app",
            "raw": "Build a project management app with boards and tasks",
        },
    )
    state.ui_audit = ui_audit  # type: ignore[assignment]
    state.ui_scaffold = ui_scaffold  # type: ignore[assignment]
    state.stack = stack  # type: ignore[assignment]
    return state


def _scaffold_audit() -> dict[str, object]:
    return {"greenfield": True, "greenfield_decision": "scaffold"}


# --- no-op paths (gate inert) -------------------------------------------------


def test_no_op_when_no_audit() -> None:
    result = scaffold.run(_state(ui_audit=None))
    assert result.outcome is Outcome.SUCCESS
    assert result.questions == []


def test_no_op_for_improve_flow() -> None:
    audit = {"components_found": [{"name": "Card", "similarity": 0.8}]}
    result = scaffold.run(_state(ui_audit=audit))
    assert result.outcome is Outcome.SUCCESS


def test_no_op_for_bare_greenfield() -> None:
    audit = {"greenfield": True, "greenfield_decision": "bare"}
    result = scaffold.run(_state(ui_audit=audit, ui_scaffold=None))
    assert result.outcome is Outcome.SUCCESS


def test_no_op_for_external_reference_greenfield() -> None:
    audit = {"greenfield": True, "greenfield_decision": "external_reference"}
    result = scaffold.run(_state(ui_audit=audit))
    assert result.outcome is Outcome.SUCCESS


# --- stage 1: plan derivation -------------------------------------------------


def test_plan_directive_when_scaffold_none() -> None:
    result = scaffold.run(_state(ui_audit=_scaffold_audit(), ui_scaffold=None))
    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)
    assert "ui-scaffold-plan" in result.questions[0]
    body = "\n".join(result.questions)
    assert "token_seed" in body
    assert "**Recommendation: 1" in body


def test_plan_directive_when_scaffold_empty() -> None:
    result = scaffold.run(_state(ui_audit=_scaffold_audit(), ui_scaffold={}))
    assert result.outcome is Outcome.BLOCKED
    assert "ui-scaffold-plan" in result.questions[0]


def test_plan_directive_when_only_pages_present() -> None:
    """``pages`` alone is not a plan — routes / layout / manifest define it."""
    result = scaffold.run(
        _state(ui_audit=_scaffold_audit(), ui_scaffold={"pages": ["Home"]}),
    )
    assert result.outcome is Outcome.BLOCKED
    assert "ui-scaffold-plan" in result.questions[0]


# --- stage 2: stack build -----------------------------------------------------


def test_build_directive_when_plan_present_unscaffolded() -> None:
    plan = {
        "pages": ["Dashboard", "Board"],
        "routes": ["/", "/board/:id"],
        "layout_strategy": "sidebar-shell",
        "component_manifest": ["AppShell", "BoardGrid"],
        "token_seed": {"radius": "0.5rem"},
    }
    result = scaffold.run(
        _state(
            ui_audit=_scaffold_audit(),
            ui_scaffold=plan,
            stack={"frontend": "react-shadcn"},
        ),
    )
    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)
    assert "ui-scaffold-react-shadcn" in result.questions[0]
    body = "\n".join(result.questions)
    assert "2 page(s)" in body
    assert "2 route(s)" in body
    assert "scaffolded = true" in body


def test_build_directive_falls_back_to_plain_for_unknown_stack() -> None:
    plan = {"routes": ["/"], "layout_strategy": "single"}
    result = scaffold.run(
        _state(
            ui_audit=_scaffold_audit(),
            ui_scaffold=plan,
            stack={"frontend": "svelte"},
        ),
    )
    assert result.outcome is Outcome.BLOCKED
    assert "ui-scaffold-plain" in result.questions[0]


def test_build_directive_when_stack_missing() -> None:
    plan = {"routes": ["/"]}
    result = scaffold.run(_state(ui_audit=_scaffold_audit(), ui_scaffold=plan))
    assert result.outcome is Outcome.BLOCKED
    assert "ui-scaffold-plain" in result.questions[0]


# --- terminal: scaffolded -----------------------------------------------------


def test_success_when_scaffolded() -> None:
    plan = {
        "routes": ["/"],
        "layout_strategy": "single",
        "scaffolded": True,
        "artifacts": ["src/App.tsx", "src/routes.ts"],
    }
    result = scaffold.run(_state(ui_audit=_scaffold_audit(), ui_scaffold=plan))
    assert result.outcome is Outcome.SUCCESS
    assert result.questions == []


def test_scaffolded_is_idempotent_on_reentry() -> None:
    plan = {"routes": ["/"], "scaffolded": True}
    state = _state(ui_audit=_scaffold_audit(), ui_scaffold=plan)
    first = scaffold.run(state)
    second = scaffold.run(state)
    assert first.outcome is Outcome.SUCCESS
    assert second.outcome is Outcome.SUCCESS
