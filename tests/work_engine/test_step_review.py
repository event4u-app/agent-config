"""Tests for the ``ui.review`` step — Phase 3 Step 4 of the UI track.

Branches covered:

- ``state.ui_review`` empty / ``None`` / non-dict — emits the
  stack-specific ``@agent-directive: ui-design-review-<stack>`` halt.
- Stack dispatch maps ``state.stack.frontend`` to the matching
  directive name; missing / unknown stack falls through to
  ``ui-design-review-plain``.
- Populated envelope with ``findings`` missing or non-list — emits
  the findings-missing halt.
- Populated envelope with valid ``findings`` but missing or non-bool
  ``review_clean`` — emits the clean-flag halt with the findings count.
- Well-formed envelope (any ``findings``, ``review_clean`` is bool) —
  passes through to ``SUCCESS`` (idempotent re-entry).
- Honesty contract: review does **not** infer ``review_clean`` from
  ``len(findings)``; the ship-as-is replay path round-trips.
"""
from __future__ import annotations

from work_engine import DeliveryState, Outcome
from work_engine.delivery_state import AGENT_DIRECTIVE_PREFIX
from work_engine.directives.ui import review


def _ui_state(
    *,
    stack: str | None = "blade-livewire-flux",
    ui_review: object | None = None,
) -> DeliveryState:
    """Build a DeliveryState shaped like a UI-routed envelope post-apply."""
    ticket: dict[str, object] = {
        "id": "UI-3",
        "title": "Render dark mode toggle",
        "raw": "Render dark mode toggle",
    }
    state = DeliveryState(ticket=ticket)
    if ui_review is not None:
        state.ui_review = ui_review  # type: ignore[assignment]
    if stack is not None:
        state.stack = {"frontend": stack, "mtime": 0.0}
    return state


# --- first-pass directive halt ----------------------------------------------


def test_review_emits_directive_when_ui_review_missing() -> None:
    state = _ui_state(ui_review=None)

    result = review.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)
    assert "ui-design-review-blade-livewire-flux" in result.questions[0]


def test_review_emits_directive_when_ui_review_empty_dict() -> None:
    state = _ui_state(ui_review={})

    result = review.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)


def test_review_emits_directive_when_ui_review_non_dict() -> None:
    state = _ui_state(ui_review=["nope"])

    result = review.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)


# --- stack dispatch ---------------------------------------------------------


def test_review_dispatches_to_react_shadcn_directive() -> None:
    state = _ui_state(stack="react-shadcn", ui_review=None)

    result = review.run(state)

    assert "ui-design-review-react-shadcn" in result.questions[0]
    body = "\n".join(result.questions)
    assert "`react-shadcn`" in body


def test_review_dispatches_to_vue_directive() -> None:
    state = _ui_state(stack="vue", ui_review=None)

    result = review.run(state)

    assert "ui-design-review-vue" in result.questions[0]


def test_review_falls_back_to_plain_when_stack_missing() -> None:
    state = _ui_state(stack=None, ui_review=None)

    result = review.run(state)

    assert "ui-design-review-plain" in result.questions[0]


def test_review_falls_back_to_plain_when_stack_unknown() -> None:
    state = _ui_state(stack=None, ui_review=None)
    state.stack = {"frontend": "svelte", "mtime": 0.0}

    result = review.run(state)

    assert "ui-design-review-plain" in result.questions[0]


def test_stack_directives_table_matches_known_stacks() -> None:
    """Every label in :data:`stack.detect.KNOWN_STACKS` has a directive."""
    from work_engine.stack.detect import KNOWN_STACKS

    assert set(review.STACK_DIRECTIVES.keys()) == set(KNOWN_STACKS)



# --- partial envelope halts -------------------------------------------------


def test_review_halts_when_findings_key_missing() -> None:
    state = _ui_state(ui_review={"review_clean": True})

    result = review.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions)
    assert "findings" in body.lower()


def test_review_halts_when_findings_is_not_a_list() -> None:
    state = _ui_state(ui_review={"findings": "all good", "review_clean": True})

    result = review.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions)
    assert "findings" in body.lower()


def test_review_halts_when_review_clean_missing() -> None:
    state = _ui_state(ui_review={"findings": [{"path": "x", "issue": "y"}]})

    result = review.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions)
    assert "review_clean" in body
    assert "1" in body  # findings count surfaced


def test_review_halts_when_review_clean_is_not_bool() -> None:
    state = _ui_state(
        ui_review={"findings": [], "review_clean": "yes"},
    )

    result = review.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions)
    assert "review_clean" in body


# --- success path -----------------------------------------------------------


def test_review_succeeds_with_clean_envelope() -> None:
    state = _ui_state(ui_review={"findings": [], "review_clean": True})

    result = review.run(state)

    assert result.outcome is Outcome.SUCCESS


def test_review_succeeds_with_dirty_envelope() -> None:
    """Findings present + review_clean=False is the polish entry shape."""
    state = _ui_state(
        ui_review={
            "findings": [{"path": "label", "issue": "wrong copy"}],
            "review_clean": False,
        },
    )

    result = review.run(state)

    assert result.outcome is Outcome.SUCCESS


def test_review_does_not_enforce_clean_matches_findings_count() -> None:
    """Honesty contract — review only checks shape, not consistency.

    The "ship as-is" replay path sets ``review_clean = True`` while
    findings are still present so the dispatcher can advance to
    ``report``. A re-entry through review must round-trip through
    ``SUCCESS`` without re-emitting a halt.
    """
    state = _ui_state(
        ui_review={
            "findings": [{"path": "label", "issue": "wrong copy"}],
            "review_clean": True,  # ship-as-is replay
        },
    )

    result = review.run(state)

    assert result.outcome is Outcome.SUCCESS
