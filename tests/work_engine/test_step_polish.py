"""Tests for the ``ui.polish`` step — Phase 3 Step 5 of the UI track.

Branches covered:

- ``review_clean`` True (or no findings) — passes through to
  ``SUCCESS`` regardless of round count.
- ``review_clean`` False, rounds < ``POLISH_CEILING`` — emits the
  stack-specific ``@agent-directive: ui-polish-<stack>`` halt with
  the next-round count.
- ``review_clean`` False, rounds == ``POLISH_CEILING`` — emits the
  ceiling halt with ship-as-is / abort / hand-off options; refuses
  to start a third round.
- Stack dispatch maps ``state.stack.frontend`` to the matching
  directive; missing / unknown stack falls through to
  ``ui-polish-plain``.
- Defensive parsing — non-int / bool ``rounds`` is treated as 0.
- Schema mirror — ``POLISH_CEILING`` aligns with the
  :func:`work_engine.state._validate_ui_polish` ceiling.
"""
from __future__ import annotations

from work_engine import DeliveryState, Outcome
from work_engine.delivery_state import AGENT_DIRECTIVE_PREFIX
from work_engine.directives.ui import polish


def _ui_state(
    *,
    stack: str | None = "blade-livewire-flux",
    ui_review: object | None = None,
    ui_polish: object | None = None,
    ui_audit: object | None = None,
) -> DeliveryState:
    """Build a DeliveryState shaped for the polish step."""
    ticket: dict[str, object] = {
        "id": "UI-4",
        "title": "Polish dark mode toggle",
        "raw": "Polish dark mode toggle",
    }
    state = DeliveryState(ticket=ticket)
    if ui_review is not None:
        state.ui_review = ui_review  # type: ignore[assignment]
    if ui_polish is not None:
        state.ui_polish = ui_polish  # type: ignore[assignment]
    if ui_audit is not None:
        state.ui_audit = ui_audit  # type: ignore[assignment]
    if stack is not None:
        state.stack = {"frontend": stack, "mtime": 0.0}
    return state


# --- success / no-op paths --------------------------------------------------


def test_polish_succeeds_when_review_is_clean() -> None:
    state = _ui_state(
        ui_review={"findings": [], "review_clean": True},
    )

    result = polish.run(state)

    assert result.outcome is Outcome.SUCCESS


def test_polish_succeeds_when_findings_empty_even_if_clean_flag_false() -> None:
    """Defensive: empty findings is the strongest signal."""
    state = _ui_state(
        ui_review={"findings": [], "review_clean": False},
    )

    result = polish.run(state)

    assert result.outcome is Outcome.SUCCESS


def test_polish_succeeds_with_clean_flag_after_max_rounds() -> None:
    """Ship-as-is replay — review_clean=True with findings present."""
    state = _ui_state(
        ui_review={
            "findings": [{"path": "label", "issue": "wrong copy"}],
            "review_clean": True,
        },
        ui_polish={"rounds": 2, "applied": []},
    )

    result = polish.run(state)

    assert result.outcome is Outcome.SUCCESS


# --- bounded loop -----------------------------------------------------------


def test_polish_emits_directive_on_first_round() -> None:
    state = _ui_state(
        ui_review={
            "findings": [{"path": "label", "issue": "wrong copy"}],
            "review_clean": False,
        },
        ui_polish=None,
    )

    result = polish.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)
    assert "ui-polish-blade-livewire-flux" in result.questions[0]
    body = "\n".join(result.questions)
    assert "1 of 2" in body or "round 1" in body.lower()


def test_polish_emits_directive_on_second_round() -> None:
    state = _ui_state(
        ui_review={
            "findings": [{"path": "label", "issue": "wrong copy"}],
            "review_clean": False,
        },
        ui_polish={"rounds": 1, "applied": [{"path": "label", "fix": "x"}]},
    )

    result = polish.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)
    body = "\n".join(result.questions)
    assert "2 of 2" in body or "round 2" in body.lower()


# --- ceiling halt -----------------------------------------------------------


def test_polish_halts_at_ceiling_when_review_still_dirty() -> None:
    state = _ui_state(
        ui_review={
            "findings": [
                {"path": "label", "issue": "wrong copy"},
                {"path": "btn", "issue": "missing aria-label"},
            ],
            "review_clean": False,
        },
        ui_polish={"rounds": 2, "applied": []},
    )

    result = polish.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions)
    # Ceiling halt is a user-decision halt — not an agent directive.
    assert not result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)
    assert "ceiling" in body.lower()
    assert "Ship as-is" in body
    assert "Abort" in body
    assert "Hand off" in body


def test_polish_ceiling_surfaces_findings_count() -> None:
    state = _ui_state(
        ui_review={
            "findings": [{"path": f"f{i}", "issue": "x"} for i in range(3)],
            "review_clean": False,
        },
        ui_polish={"rounds": 2, "applied": []},
    )

    result = polish.run(state)

    body = "\n".join(result.questions)
    assert "3" in body


def test_polish_refuses_third_round_even_with_higher_rounds_value() -> None:
    """Defensive: rounds > ceiling is still a ceiling halt."""
    state = _ui_state(
        ui_review={
            "findings": [{"path": "x", "issue": "y"}],
            "review_clean": False,
        },
        ui_polish={"rounds": 5, "applied": []},
    )

    result = polish.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions)
    assert "Ship as-is" in body


# --- stack dispatch ---------------------------------------------------------


def test_polish_dispatches_to_react_shadcn_directive() -> None:
    state = _ui_state(
        stack="react-shadcn",
        ui_review={
            "findings": [{"path": "x", "issue": "y"}],
            "review_clean": False,
        },
    )

    result = polish.run(state)

    assert "ui-polish-react-shadcn" in result.questions[0]


def test_polish_falls_back_to_plain_when_stack_missing() -> None:
    state = _ui_state(
        stack=None,
        ui_review={
            "findings": [{"path": "x", "issue": "y"}],
            "review_clean": False,
        },
    )

    result = polish.run(state)

    assert "ui-polish-plain" in result.questions[0]


def test_stack_directives_table_matches_known_stacks() -> None:
    """Every label in :data:`stack.detect.KNOWN_STACKS` has a directive."""
    from work_engine.stack.detect import KNOWN_STACKS

    assert set(polish.STACK_DIRECTIVES.keys()) == set(KNOWN_STACKS)


# --- defensive parsing ------------------------------------------------------


def test_polish_treats_non_int_rounds_as_zero() -> None:
    state = _ui_state(
        ui_review={
            "findings": [{"path": "x", "issue": "y"}],
            "review_clean": False,
        },
        ui_polish={"rounds": "two", "applied": []},
    )

    result = polish.run(state)

    # Non-int rounds → 0 → first-round directive (not ceiling).
    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)


def test_polish_treats_bool_rounds_as_zero() -> None:
    """``True`` is technically an int but must not count as round 1."""
    state = _ui_state(
        ui_review={
            "findings": [{"path": "x", "issue": "y"}],
            "review_clean": False,
        },
        ui_polish={"rounds": True, "applied": []},
    )

    result = polish.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)
    body = "\n".join(result.questions)
    assert "1 of 2" in body or "round 1" in body.lower()


# --- ceiling alignment ------------------------------------------------------


def test_polish_ceiling_is_two() -> None:
    """Schema mirror — state.py rejects rounds > 2 on disk."""
    assert polish.POLISH_CEILING == 2



# --- token-violation refactor ----------------------------------------------


def _token_finding(
    category: str,
    value: str,
    *,
    path: str = "Component.razor",
) -> dict[str, object]:
    """Build a ``token_violation`` review finding."""
    return {
        "kind": polish.TOKEN_VIOLATION_KIND,
        "category": category,
        "value": value,
        "path": path,
        "issue": f"hardcoded {category} value `{value}`",
    }


def test_polish_auto_converts_when_token_matches_existing_design_token() -> None:
    """Matched token-violation: no halt, count surfaced in delegate body."""
    state = _ui_state(
        ui_review={
            "findings": [
                _token_finding("colors", "#3b82f6", path="Button.blade.php"),
                _token_finding("colors", "#3b82f6", path="Card.blade.php"),
            ],
            "review_clean": False,
        },
        ui_audit={
            "components_found": [],
            "design_tokens": {"colors": {"primary": "#3b82f6"}},
        },
    )

    result = polish.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)
    body = "\n".join(result.questions)
    assert "2 token-violation match" in body or "auto-convert" in body


def test_polish_halts_when_unmatched_value_repeats_above_threshold() -> None:
    """3 occurrences > threshold(2) of a hardcoded value with no token match."""
    state = _ui_state(
        ui_review={
            "findings": [
                _token_finding("colors", "#abcdef", path=f"f{i}.blade.php")
                for i in range(3)
            ],
            "review_clean": False,
        },
        ui_audit={"design_tokens": {"colors": {"primary": "#3b82f6"}}},
    )

    result = polish.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert not result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)
    body = "\n".join(result.questions)
    assert "#abcdef" in body
    assert "Extract" in body
    assert "Inline" in body
    assert "Abort" in body


def test_polish_does_not_halt_when_unmatched_value_appears_exactly_threshold_times() -> None:
    """Threshold is strict `>` — 2 occurrences must NOT trigger the halt."""
    state = _ui_state(
        ui_review={
            "findings": [
                _token_finding("spacing", "13px", path="A.blade.php"),
                _token_finding("spacing", "13px", path="B.blade.php"),
            ],
            "review_clean": False,
        },
        ui_audit={"design_tokens": {"spacing": {"sm": "8px"}}},
    )

    result = polish.run(state)

    # Falls through to normal polish delegate, no extraction halt.
    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)
    body = "\n".join(result.questions)
    assert "Extract" not in body


def test_polish_token_extraction_halt_skipped_when_audit_missing() -> None:
    """Defensive: no `ui_audit` → unmatched buckets still halt (no tokens known)."""
    state = _ui_state(
        ui_review={
            "findings": [
                _token_finding("colors", "#deadbe") for _ in range(3)
            ],
            "review_clean": False,
        },
    )

    result = polish.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions)
    # No tokens known → value treated as unmatched and halt fires.
    assert "Extract" in body


def test_polish_ignores_non_token_findings_in_classifier() -> None:
    """Findings without ``kind == token_violation`` flow through normally."""
    state = _ui_state(
        ui_review={
            "findings": [
                {"path": "label", "issue": "wrong copy"},
                {"path": "btn", "issue": "missing aria-label"},
            ],
            "review_clean": False,
        },
        ui_audit={"design_tokens": {"colors": {"primary": "#fff"}}},
    )

    result = polish.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)
    body = "\n".join(result.questions)
    assert "Extract" not in body
    assert "token-violation match" not in body


def test_polish_ceiling_overrides_token_extraction_halt() -> None:
    """Ceiling fires before token-extraction even with unmatched repeats."""
    state = _ui_state(
        ui_review={
            "findings": [
                _token_finding("colors", "#abcdef") for _ in range(3)
            ],
            "review_clean": False,
        },
        ui_polish={"rounds": 2, "applied": []},
        ui_audit={"design_tokens": {"colors": {}}},
    )

    result = polish.run(state)

    body = "\n".join(result.questions)
    assert "Ship as-is" in body
    assert "Extract" not in body


def test_polish_token_threshold_is_two() -> None:
    """Roadmap mirror — Phase 3 Step 5 says ">2 times"."""
    assert polish.TOKEN_REPEAT_THRESHOLD == 2
