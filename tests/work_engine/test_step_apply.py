"""Tests for the ``ui.apply`` step — Phase 3 Step 2 of the UI track.

Branches covered:

- ``state.ticket['ui_apply']`` empty / ``None`` / non-dict — emits the
  stack-specific ``@agent-directive: ui-apply-<stack>`` halt.
- Stack dispatch maps ``state.stack.frontend`` to the matching
  directive name; missing / unknown stack falls through to
  ``ui-apply-plain``.
- Rendered output containing placeholder patterns
  (``<placeholder>``, ``Lorem``, ``TODO:``) emits the rejection halt
  with violation paths from the rendered tree.
- Well-formed envelope with placeholder-free rendered text records
  one ``state.changes`` entry per file and returns ``SUCCESS``.
"""
from __future__ import annotations

from work_engine import DeliveryState, Outcome
from work_engine.delivery_state import AGENT_DIRECTIVE_PREFIX
from work_engine.directives.ui import apply


def _ui_state(
    *,
    stack: str | None = "blade-livewire-flux",
    ui_apply: object | None = None,
) -> DeliveryState:
    """Build a DeliveryState shaped like a UI-routed envelope post-design."""
    ticket: dict[str, object] = {
        "id": "UI-2",
        "title": "Render dark mode toggle",
        "raw": "Render dark mode toggle",
    }
    if ui_apply is not None:
        ticket["ui_apply"] = ui_apply
    state = DeliveryState(ticket=ticket)
    if stack is not None:
        state.stack = {"frontend": stack, "mtime": 0.0}
    return state


def _well_formed_envelope(**overrides: object) -> dict[str, object]:
    envelope: dict[str, object] = {
        "files": ["resources/views/components/dark-mode-toggle.blade.php"],
        "rendered": {
            "label": "Dark mode",
            "buttons": {"submit": "Save", "cancel": "Cancel"},
        },
        "summary": "rendered dark mode toggle component",
    }
    envelope.update(overrides)
    return envelope


# --- first-pass directive halt ----------------------------------------------


def test_apply_emits_directive_when_ui_apply_missing() -> None:
    state = _ui_state(ui_apply=None)

    result = apply.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)
    assert "ui-apply-blade-livewire-flux" in result.questions[0]


def test_apply_emits_directive_when_ui_apply_empty_dict() -> None:
    state = _ui_state(ui_apply={})

    result = apply.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)


def test_apply_emits_directive_when_ui_apply_non_dict() -> None:
    state = _ui_state(ui_apply=["nope"])

    result = apply.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)


# --- stack dispatch ---------------------------------------------------------


def test_apply_dispatches_to_react_shadcn_directive() -> None:
    state = _ui_state(stack="react-shadcn", ui_apply=None)

    result = apply.run(state)

    assert "ui-apply-react-shadcn" in result.questions[0]
    body = "\n".join(result.questions)
    assert "`react-shadcn`" in body


def test_apply_dispatches_to_vue_directive() -> None:
    state = _ui_state(stack="vue", ui_apply=None)

    result = apply.run(state)

    assert "ui-apply-vue" in result.questions[0]


def test_apply_dispatches_to_plain_directive() -> None:
    state = _ui_state(stack="plain", ui_apply=None)

    result = apply.run(state)

    assert "ui-apply-plain" in result.questions[0]


def test_apply_falls_back_to_plain_when_stack_missing() -> None:
    state = _ui_state(stack=None, ui_apply=None)

    result = apply.run(state)

    assert "ui-apply-plain" in result.questions[0]


def test_apply_falls_back_to_plain_when_stack_unknown() -> None:
    state = _ui_state(stack=None, ui_apply=None)
    state.stack = {"frontend": "svelte", "mtime": 0.0}

    result = apply.run(state)

    assert "ui-apply-plain" in result.questions[0]


def test_stack_directives_table_matches_known_stacks() -> None:
    """Every label in :data:`stack.detect.KNOWN_STACKS` has a directive."""
    from work_engine.stack.detect import KNOWN_STACKS

    assert set(apply.STACK_DIRECTIVES.keys()) == set(KNOWN_STACKS)


# --- placeholder rejection --------------------------------------------------


def test_apply_rejects_lorem_in_rendered_text() -> None:
    envelope = _well_formed_envelope(
        rendered={"label": "Lorem ipsum dolor", "buttons": {"submit": "Save"}},
    )
    state = _ui_state(ui_apply=envelope)

    result = apply.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions)
    assert "label" in body
    assert "placeholder" in body.lower() or "rejected" in body.lower()


def test_apply_rejects_todo_in_nested_rendered() -> None:
    envelope = _well_formed_envelope(
        rendered={
            "label": "Dark mode",
            "buttons": {"submit": "TODO: confirm copy", "cancel": "Cancel"},
        },
    )
    state = _ui_state(ui_apply=envelope)

    result = apply.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions)
    assert "buttons.submit" in body


def test_apply_rejects_angle_placeholder() -> None:
    envelope = _well_formed_envelope(
        rendered={"label": "<placeholder>", "buttons": {"submit": "Save"}},
    )
    state = _ui_state(ui_apply=envelope)

    result = apply.run(state)

    assert result.outcome is Outcome.BLOCKED


# --- success path -----------------------------------------------------------


def test_apply_records_one_change_per_file_on_success() -> None:
    envelope = _well_formed_envelope(
        files=[
            "resources/views/components/toggle.blade.php",
            "app/Livewire/DarkMode.php",
        ],
    )
    state = _ui_state(ui_apply=envelope)

    result = apply.run(state)

    assert result.outcome is Outcome.SUCCESS
    assert len(state.changes) == 2
    paths = {change["file"] for change in state.changes}
    assert "app/Livewire/DarkMode.php" in paths
    for change in state.changes:
        assert change["kind"] == "ui"
        assert change["stack"] == "blade-livewire-flux"
        assert change["summary"] == "rendered dark mode toggle component"


def test_apply_success_with_empty_files_records_nothing() -> None:
    envelope = _well_formed_envelope(files=[])
    # rendered must still be non-placeholder; empty files just means
    # the agent reports no file-level changes (e.g. only state changes).
    state = _ui_state(ui_apply=envelope)

    result = apply.run(state)

    assert result.outcome is Outcome.SUCCESS
    assert state.changes == []


def test_apply_success_skips_non_string_paths() -> None:
    envelope = _well_formed_envelope(
        files=["app/Livewire/DarkMode.php", "", 42, None],  # type: ignore[list-item]
    )
    state = _ui_state(ui_apply=envelope)

    result = apply.run(state)

    assert result.outcome is Outcome.SUCCESS
    assert len(state.changes) == 1
    assert state.changes[0]["file"] == "app/Livewire/DarkMode.php"
