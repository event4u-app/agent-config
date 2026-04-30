"""Tests for the ``ui.audit`` step — Phase 2 of the UI track.

Branches covered:

- ``state.ui_audit`` empty / ``None`` / non-dict — emits the
  ``@agent-directive: existing-ui-audit`` halt.
- Greenfield without ``greenfield_decision`` — emits a numbered
  scaffold/bare/external_reference halt.
- Greenfield with decision — passes through, records ``audit_path``.
- Populated, **high-confidence** (band=high + one strong match) —
  passes through, records ``audit_path = "high_confidence"``.
- Populated, **ambiguous** (medium band, weak top match, or tied
  candidates) — emits a numbered candidate-pick halt.
- Idempotent re-entry on a recorded ``audit_path``.

The handler is pure, so no fakes are needed; the tests construct
``DeliveryState`` instances directly and call ``audit.run``.
"""
from __future__ import annotations

from work_engine import DeliveryState, Outcome
from work_engine.delivery_state import AGENT_DIRECTIVE_PREFIX
from work_engine.directives.ui import audit


def _ui_state(
    *,
    confidence_band: str | None = "high",
    **overrides: object,
) -> DeliveryState:
    """Build a DeliveryState shaped like a UI-routed envelope.

    ``confidence_band`` is mirrored into ``ticket["confidence"]["band"]``
    the way the backend ``refine`` step writes it. Pass ``None`` to leave
    the slot empty (emulates a fresh ticket without a scored band).
    """
    ticket: dict[str, object] = {
        "id": "UI-1",
        "title": "Add a dark mode toggle to settings",
        "raw": "Add a dark mode toggle to settings",
    }
    if confidence_band is not None:
        ticket["confidence"] = {"band": confidence_band}
    state = DeliveryState(ticket=ticket)
    for key, value in overrides.items():
        setattr(state, key, value)
    return state


# --- first-pass directive halt ----------------------------------------------


def test_audit_emits_directive_when_ui_audit_is_none() -> None:
    state = _ui_state(ui_audit=None)

    result = audit.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)
    assert "existing-ui-audit" in result.questions[0]
    assert any(q.startswith("> 1.") for q in result.questions)
    assert any(q.startswith("> 2.") for q in result.questions)


def test_audit_emits_directive_when_ui_audit_is_empty_dict() -> None:
    state = _ui_state(ui_audit={})

    result = audit.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)


def test_audit_emits_directive_when_ui_audit_is_non_dict() -> None:
    """A list / string / int is treated as "skill has not run yet"."""
    state = _ui_state(ui_audit=["not", "a", "dict"])  # type: ignore[arg-type]

    result = audit.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)


def test_audit_directive_carries_input_preview() -> None:
    state = _ui_state(ui_audit=None)

    result = audit.run(state)

    body = "\n".join(result.questions)
    assert "> Input: Add a dark mode toggle to settings" in body


def test_audit_directive_truncates_long_previews() -> None:
    long_raw = "x" * 200
    state = _ui_state(ticket={"id": "UI-2", "raw": long_raw})

    result = audit.run(state)

    preview_line = next(q for q in result.questions if q.startswith("> Input:"))
    # Trailing ellipsis comes from _preview_input — preview itself capped at 80.
    assert preview_line.endswith("\u2026")
    assert len(preview_line) <= len("> Input: ") + 80


# --- greenfield-decision halt -----------------------------------------------


def test_audit_halts_when_greenfield_without_decision() -> None:
    state = _ui_state(ui_audit={"greenfield": True})

    result = audit.run(state)

    assert result.outcome is Outcome.BLOCKED
    # No agent directive on the greenfield branch — user-facing only.
    assert not result.questions[0].startswith(AGENT_DIRECTIVE_PREFIX)
    body = "\n".join(result.questions)
    assert "greenfield" in body.lower()
    assert "> 1." in body and "> 2." in body and "> 3." in body
    assert "**Recommendation:" in body


def test_audit_passes_when_greenfield_decision_recorded() -> None:
    state = _ui_state(
        ui_audit={"greenfield": True, "greenfield_decision": "scaffold"},
    )

    result = audit.run(state)

    assert result.outcome is Outcome.SUCCESS
    assert result.questions == []
    assert state.ui_audit["audit_path"] == "greenfield"


# --- high-confidence path ---------------------------------------------------


def test_audit_passes_on_high_confidence_with_strong_match() -> None:
    """Band=high + one strong match (similarity ≥ 0.7) → SUCCESS."""
    state = _ui_state(
        confidence_band="high",
        ui_audit={
            "components_found": [
                {"name": "DarkModeToggle", "path": "x", "similarity": 0.85},
                {"name": "ThemeSwitcher", "path": "y", "similarity": 0.40},
            ],
        },
    )

    result = audit.run(state)

    assert result.outcome is Outcome.SUCCESS
    assert result.questions == []
    assert state.ui_audit["audit_path"] == "high_confidence"


def test_audit_idempotent_on_recorded_high_confidence_path() -> None:
    """Recorded path round-trips through SUCCESS without re-emitting halt."""
    state = _ui_state(
        confidence_band="medium",  # would normally halt
        ui_audit={
            "components_found": [{"name": "X", "similarity": 0.1}],
            "audit_path": "high_confidence",
        },
    )

    result = audit.run(state)

    assert result.outcome is Outcome.SUCCESS


# --- ambiguous path ---------------------------------------------------------


def test_audit_halts_on_medium_confidence() -> None:
    state = _ui_state(
        confidence_band="medium",
        ui_audit={
            "components_found": [
                {"name": "Button", "path": "x", "similarity": 0.95},
            ],
        },
    )

    result = audit.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions)
    assert "ambiguous" in body.lower()
    assert "> 1." in body and "Build new" in body
    assert "**Recommendation:" in body


def test_audit_halts_when_top_match_below_strong_threshold() -> None:
    """Band=high but no match clears 0.7 → ambiguous."""
    state = _ui_state(
        confidence_band="high",
        ui_audit={
            "components_found": [
                {"name": "Card", "similarity": 0.55},
                {"name": "Tile", "similarity": 0.30},
            ],
        },
    )

    result = audit.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions)
    assert "Build new" in body


def test_audit_halts_on_tied_top_candidates() -> None:
    """Two strong matches within TIE_GAP → ambiguous."""
    state = _ui_state(
        confidence_band="high",
        ui_audit={
            "components_found": [
                {"name": "ToggleA", "similarity": 0.82},
                {"name": "ToggleB", "similarity": 0.80},
            ],
        },
    )

    result = audit.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions)
    assert "ToggleA" in body and "ToggleB" in body


def test_audit_idempotent_on_recorded_ambiguous_path() -> None:
    state = _ui_state(
        confidence_band="medium",
        ui_audit={
            "components_found": [{"name": "X", "similarity": 0.1}],
            "audit_path": "ambiguous",
            "candidate_pick": "X",
        },
    )

    result = audit.run(state)

    assert result.outcome is Outcome.SUCCESS


def test_audit_passes_on_legacy_components_alias_with_high_confidence() -> None:
    """The legacy ``components`` key counts as populated for back-compat."""
    state = _ui_state(
        confidence_band="high",
        ui_audit={"components": [{"name": "Card", "similarity": 0.9}]},
    )

    result = audit.run(state)

    assert result.outcome is Outcome.SUCCESS


# --- ambiguity declaration --------------------------------------------------


def test_audit_declares_three_ambiguity_codes() -> None:
    codes = {entry["code"] for entry in audit.AMBIGUITIES}
    assert codes == {"audit_missing", "greenfield_undecided", "audit_ambiguous"}
