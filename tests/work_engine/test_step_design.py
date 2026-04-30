"""Tests for the ``ui.design`` step — Phase 3 Step 1 of the UI track.

Branches covered:

- ``state.ui_design`` empty / ``None`` / non-dict — emits the
  ``@agent-directive: ui-design-brief`` halt.
- Populated brief missing required keys — emits the incomplete-brief
  halt with the offending paths listed.
- Populated brief whose microcopy contains placeholder patterns —
  emits the placeholder halt with violation paths.
- Well-formed brief without ``design_confirmed`` — emits the
  unconfirmed-brief summary halt.
- Well-formed brief with ``design_confirmed = True`` — passes through
  to ``SUCCESS`` (idempotent re-entry).
"""
from __future__ import annotations

from work_engine import DeliveryState, Outcome
from work_engine.delivery_state import AGENT_DIRECTIVE_PREFIX
from work_engine.directives.ui import design


def _ui_state(**overrides: object) -> DeliveryState:
    """Build a DeliveryState shaped like a UI-routed envelope post-audit."""
    ticket: dict[str, object] = {
        "id": "UI-1",
        "title": "Add a dark mode toggle to settings",
        "raw": "Add a dark mode toggle to settings",
        "confidence": {"band": "high"},
    }
    state = DeliveryState(ticket=ticket)
    for key, value in overrides.items():
        setattr(state, key, value)
    return state


def _well_formed_brief(**overrides: object) -> dict[str, object]:
    """Return a minimal brief that satisfies every required slot."""
    brief: dict[str, object] = {
        "layout": "sidebar + main panel",
        "components": [{"name": "DarkModeToggle", "kind": "switch"}],
        "states": {
            "empty": "no setting yet",
            "loading": "Saving…",
            "error": "Could not save preference",
            "success": "Preference saved",
            "disabled": "Sign in to change",
        },
        "microcopy": {
            "label": "Dark mode",
            "buttons": {"submit": "Save", "cancel": "Cancel"},
        },
        "a11y": "aria-label='Toggle dark mode'",
    }
    brief.update(overrides)
    return brief


# --- first-pass directive halt ----------------------------------------------


def test_design_emits_directive_when_ui_design_is_none() -> None:
    state = _ui_state(ui_design=None)

    result = design.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)
    assert "ui-design-brief" in result.questions[0]


def test_design_emits_directive_when_ui_design_is_empty_dict() -> None:
    state = _ui_state(ui_design={})

    result = design.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)


def test_design_emits_directive_when_ui_design_is_non_dict() -> None:
    state = _ui_state(ui_design=["nope"])  # type: ignore[arg-type]

    result = design.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)


def test_design_directive_carries_input_preview() -> None:
    state = _ui_state(ui_design=None)

    result = design.run(state)

    body = "\n".join(result.questions)
    assert "> Input: Add a dark mode toggle to settings" in body


# --- incomplete-brief halt --------------------------------------------------


def test_design_halts_when_required_keys_missing() -> None:
    """Brief with only `layout` set must list every missing required slot."""
    state = _ui_state(ui_design={"layout": "stub"})

    result = design.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions)
    assert "incomplete" in body.lower() or "Missing required" in body
    assert "components" in body
    assert "states" in body
    assert "microcopy" in body
    assert "a11y" in body


def test_design_halts_when_states_dict_misses_required_keys() -> None:
    """Partial states dict (only `empty`) flags the rest as `states.<key>`."""
    brief = _well_formed_brief(states={"empty": "nope"})
    state = _ui_state(ui_design=brief)

    result = design.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions)
    assert "states.loading" in body
    assert "states.error" in body
    assert "states.success" in body
    assert "states.disabled" in body


# --- placeholder halt -------------------------------------------------------


def test_design_halts_on_placeholder_in_top_level_microcopy() -> None:
    brief = _well_formed_brief(
        microcopy={
            "label": "<placeholder>",
            "buttons": {"submit": "Save", "cancel": "Cancel"},
        },
    )
    state = _ui_state(ui_design=brief)

    result = design.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions)
    assert "placeholder" in body.lower()
    assert "microcopy.label" in body


def test_design_halts_on_placeholder_in_nested_microcopy() -> None:
    """Nested dict-of-strings — Lorem in `buttons.submit` is reported."""
    brief = _well_formed_brief(
        microcopy={
            "label": "Dark mode",
            "buttons": {"submit": "Lorem ipsum", "cancel": "Cancel"},
        },
    )
    state = _ui_state(ui_design=brief)

    result = design.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions)
    assert "microcopy.buttons.submit" in body


def test_design_detects_each_documented_placeholder_pattern() -> None:
    """Every PLACEHOLDER_PATTERNS entry must trip the halt."""
    for pattern in design.PLACEHOLDER_PATTERNS:
        brief = _well_formed_brief(
            microcopy={
                "label": f"copy with {pattern} embedded",
                "buttons": {"submit": "Save", "cancel": "Cancel"},
            },
        )
        state = _ui_state(ui_design=brief)

        result = design.run(state)

        assert result.outcome is Outcome.BLOCKED, f"pattern {pattern!r} slipped"
        body = "\n".join(result.questions)
        assert "microcopy.label" in body, f"pattern {pattern!r} not flagged"


# --- unconfirmed-brief halt -------------------------------------------------


def test_design_halts_when_brief_is_well_formed_but_unconfirmed() -> None:
    state = _ui_state(ui_design=_well_formed_brief())

    result = design.run(state)

    assert result.outcome is Outcome.BLOCKED
    # No agent directive on the confirmation branch — user-facing only.
    assert not result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)
    body = "\n".join(result.questions)
    assert "Components: 1" in body
    assert "States covered: 5" in body
    assert "Microcopy entries (locked): 3" in body
    assert "> 1." in body and "> 2." in body and "> 3." in body
    assert "**Recommendation:" in body


def test_design_halts_when_design_confirmed_is_false() -> None:
    brief = _well_formed_brief()
    brief["design_confirmed"] = False
    state = _ui_state(ui_design=brief)

    result = design.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions)
    assert "Confirm" in body


# --- success / idempotency --------------------------------------------------


def test_design_passes_when_brief_confirmed() -> None:
    brief = _well_formed_brief()
    brief["design_confirmed"] = True
    state = _ui_state(ui_design=brief)

    result = design.run(state)

    assert result.outcome is Outcome.SUCCESS
    assert result.questions == []


def test_design_idempotent_on_confirmed_brief() -> None:
    """Re-entering with confirmation set must not re-emit a halt."""
    brief = _well_formed_brief()
    brief["design_confirmed"] = True
    state = _ui_state(ui_design=brief)

    first = design.run(state)
    second = design.run(state)

    assert first.outcome is Outcome.SUCCESS
    assert second.outcome is Outcome.SUCCESS


# --- ambiguity declaration --------------------------------------------------


def test_design_declares_three_ambiguity_codes() -> None:
    codes = {entry["code"] for entry in design.AMBIGUITIES}
    assert codes == {
        "design_missing",
        "design_placeholders",
        "design_unconfirmed",
    }
