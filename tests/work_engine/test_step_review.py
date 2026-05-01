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


# --- R4 Phase 1: a11y gate --------------------------------------------------


def _ui_state_with_audit(
    *,
    audit: dict[str, object] | None,
    ui_review: dict[str, object],
) -> DeliveryState:
    """Build a state with both ``ui_audit`` and ``ui_review`` populated."""
    state = _ui_state(ui_review=ui_review)
    if audit is not None:
        state.ui_audit = audit
    return state


def test_a11y_gate_no_baseline_no_envelope_passes() -> None:
    """Pre-R4 envelopes (no baseline, no a11y) bypass the gate."""
    state = _ui_state(ui_review={"findings": [], "review_clean": True})

    result = review.run(state)

    assert result.outcome is Outcome.SUCCESS


def test_a11y_gate_baseline_without_envelope_halts_pending() -> None:
    """Audit declared a baseline but review skipped a11y → pending halt."""
    state = _ui_state_with_audit(
        audit={"a11y_baseline": []},
        ui_review={"findings": [], "review_clean": True},
    )

    result = review.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions)
    assert "a11y" in body.lower()
    assert "baseline" in body.lower()


def test_a11y_gate_no_baseline_envelope_present_still_filters() -> None:
    """Envelope without a baseline still applies severity / accepted filters.

    Useful when a stack opts in to a11y without recording a baseline
    (greenfield component).
    """
    state = _ui_state_with_audit(
        audit=None,
        ui_review={
            "findings": [],
            "review_clean": True,
            "a11y": {
                "violations": [
                    {"rule": "label", "selector": "input", "severity": "serious"},
                ],
            },
        },
    )

    result = review.run(state)

    assert result.outcome is Outcome.SUCCESS
    assert state.ui_review["review_clean"] is False
    findings = state.ui_review["findings"]
    assert len(findings) == 1
    assert findings[0]["kind"] == "a11y_violation"
    assert findings[0]["rule"] == "label"


def test_a11y_gate_filters_baseline_violations() -> None:
    """Pre-existing violations (baseline match) are ignored."""
    state = _ui_state_with_audit(
        audit={
            "a11y_baseline": [
                {"rule": "color-contrast", "selector": "h1", "severity": "moderate"},
            ],
        },
        ui_review={
            "findings": [],
            "review_clean": True,
            "a11y": {
                "violations": [
                    {"rule": "color-contrast", "selector": "h1", "severity": "moderate"},
                ],
            },
        },
    )

    result = review.run(state)

    assert result.outcome is Outcome.SUCCESS
    assert state.ui_review["review_clean"] is True
    assert state.ui_review["findings"] == []


def test_a11y_gate_filters_below_severity_floor() -> None:
    """Violations strictly below the floor are informational, not blocking."""
    state = _ui_state_with_audit(
        audit={"a11y_baseline": []},
        ui_review={
            "findings": [],
            "review_clean": True,
            "a11y": {
                "violations": [
                    {"rule": "region", "selector": "main", "severity": "minor"},
                ],
                "severity_floor": "moderate",
            },
        },
    )

    result = review.run(state)

    assert result.outcome is Outcome.SUCCESS
    assert state.ui_review["review_clean"] is True
    assert state.ui_review["findings"] == []


def test_a11y_gate_filters_accepted_violations() -> None:
    """User-acknowledged violations from a previous halt are not re-blocked."""
    state = _ui_state_with_audit(
        audit={"a11y_baseline": []},
        ui_review={
            "findings": [],
            "review_clean": True,
            "a11y": {
                "violations": [
                    {"rule": "aria-roles", "selector": "[role=tab]", "severity": "serious"},
                ],
                "accepted_violations": [
                    {"rule": "aria-roles", "selector": "[role=tab]"},
                ],
            },
        },
    )

    result = review.run(state)

    assert result.outcome is Outcome.SUCCESS
    assert state.ui_review["review_clean"] is True
    assert state.ui_review["findings"] == []


def test_a11y_gate_synthesizes_actionable_findings() -> None:
    """Actionable violations land as ``a11y_violation`` findings."""
    state = _ui_state_with_audit(
        audit={"a11y_baseline": []},
        ui_review={
            "findings": [],
            "review_clean": True,
            "a11y": {
                "violations": [
                    {"rule": "label", "selector": "input#email", "severity": "serious"},
                    {"rule": "color-contrast", "selector": "h1", "severity": "critical"},
                    {"rule": "region", "selector": "main", "severity": "minor"},
                ],
                "severity_floor": "moderate",
            },
        },
    )

    result = review.run(state)

    assert result.outcome is Outcome.SUCCESS
    assert state.ui_review["review_clean"] is False
    findings = state.ui_review["findings"]
    assert len(findings) == 2
    rules = {f["rule"] for f in findings}
    assert rules == {"label", "color-contrast"}
    for f in findings:
        assert f["kind"] == "a11y_violation"


def test_a11y_gate_is_idempotent_on_re_entry() -> None:
    """Re-running the gate must not duplicate synthesised findings."""
    state = _ui_state_with_audit(
        audit={"a11y_baseline": []},
        ui_review={
            "findings": [],
            "review_clean": True,
            "a11y": {
                "violations": [
                    {"rule": "label", "selector": "input", "severity": "serious"},
                ],
            },
        },
    )

    review.run(state)
    review.run(state)
    review.run(state)

    findings = state.ui_review["findings"]
    assert len(findings) == 1
    assert findings[0]["rule"] == "label"


def test_a11y_gate_preserves_existing_non_a11y_findings() -> None:
    """Non-a11y findings (design issues) stay intact alongside synthesised a11y."""
    state = _ui_state_with_audit(
        audit={"a11y_baseline": []},
        ui_review={
            "findings": [
                {"path": "header", "issue": "wrong padding"},
            ],
            "review_clean": False,
            "a11y": {
                "violations": [
                    {"rule": "label", "selector": "input", "severity": "serious"},
                ],
            },
        },
    )

    result = review.run(state)

    assert result.outcome is Outcome.SUCCESS
    findings = state.ui_review["findings"]
    assert len(findings) == 2
    a11y_findings = [f for f in findings if f.get("kind") == "a11y_violation"]
    assert len(a11y_findings) == 1


def test_a11y_gate_unknown_severity_defaults_to_floor() -> None:
    """Malformed severity must not silently weaken the gate."""
    state = _ui_state_with_audit(
        audit={"a11y_baseline": []},
        ui_review={
            "findings": [],
            "review_clean": True,
            "a11y": {
                "violations": [
                    {"rule": "label", "selector": "input", "severity": "bogus"},
                ],
                "severity_floor": "moderate",
            },
        },
    )

    result = review.run(state)

    assert result.outcome is Outcome.SUCCESS
    # Unknown severity defaulted to moderate → at floor → actionable
    assert state.ui_review["review_clean"] is False
    assert len(state.ui_review["findings"]) == 1


def test_a11y_pending_halt_runs_after_basic_gates() -> None:
    """Basic shape errors (missing findings) still surface first."""
    state = _ui_state_with_audit(
        audit={"a11y_baseline": []},
        ui_review={"review_clean": True},  # findings missing
    )

    result = review.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions).lower()
    assert "findings" in body
    assert "a11y" not in body  # a11y halt did not fire


def test_a11y_gate_in_ambiguities_table() -> None:
    """``review_a11y_pending`` is declared in the AMBIGUITIES table."""
    codes = {entry["code"] for entry in review.AMBIGUITIES}
    assert "review_a11y_pending" in codes



# --- R4 Phase 3: preview envelope gate --------------------------------------


def test_preview_gate_no_envelope_passes() -> None:
    """Pre-R4 envelopes (no `preview` key) flow through silently."""
    state = _ui_state(ui_review={"findings": [], "review_clean": True})

    result = review.run(state)

    assert result.outcome is Outcome.SUCCESS


def test_preview_gate_render_ok_true_passes() -> None:
    """Successful render → no halt; report picks up the artifact."""
    state = _ui_state(
        ui_review={
            "findings": [],
            "review_clean": True,
            "preview": {
                "render_ok": True,
                "screenshot_path": "tmp/preview/foo.png",
            },
        },
    )

    result = review.run(state)

    assert result.outcome is Outcome.SUCCESS


def test_preview_gate_render_ok_missing_passes() -> None:
    """Incomplete envelope (skill still working) is not yet actionable."""
    state = _ui_state(
        ui_review={
            "findings": [],
            "review_clean": True,
            "preview": {},
        },
    )

    result = review.run(state)

    assert result.outcome is Outcome.SUCCESS


def test_preview_gate_render_ok_false_halts() -> None:
    """`render_ok: False` triggers `preview_render_failed`."""
    state = _ui_state(
        ui_review={
            "findings": [],
            "review_clean": True,
            "preview": {
                "render_ok": False,
                "error": "ECONNREFUSED at http://localhost:5173",
            },
        },
    )

    result = review.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions).lower()
    assert "preview" in body
    assert "render" in body
    # Error string surfaces in the halt body for the user.
    assert "econnrefused" in body
    # All three options are present.
    assert "retry" in body
    assert "skip" in body
    assert "abort" in body


def test_preview_gate_render_ok_false_without_error_still_halts() -> None:
    """Missing `error` does not weaken the halt; placeholder is rendered."""
    state = _ui_state(
        ui_review={
            "findings": [],
            "review_clean": True,
            "preview": {"render_ok": False},
        },
    )

    result = review.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions).lower()
    assert "none reported" in body


def test_preview_gate_skipped_idempotent() -> None:
    """`skipped: True` round-trips through SUCCESS without re-halting."""
    state = _ui_state(
        ui_review={
            "findings": [],
            "review_clean": True,
            "preview": {
                "render_ok": False,
                "error": "boom",
                "skipped": True,
            },
        },
    )

    result = review.run(state)

    assert result.outcome is Outcome.SUCCESS


def test_preview_gate_runs_after_a11y_gate() -> None:
    """A11y pending halts surface BEFORE preview gate fires.

    Ensures the gate ordering (basic shape → a11y → preview) is stable;
    a missing a11y envelope plus a failed preview must surface a11y first.
    """
    state = _ui_state_with_audit(
        audit={"a11y_baseline": []},
        ui_review={
            "findings": [],
            "review_clean": True,
            # No `a11y` key → a11y_pending halt fires first.
            "preview": {"render_ok": False, "error": "boom"},
        },
    )

    result = review.run(state)

    assert result.outcome is Outcome.BLOCKED
    body = "\n".join(result.questions).lower()
    assert "a11y" in body
    assert "render" not in body  # preview halt did not fire


def test_preview_gate_in_ambiguities_table() -> None:
    """`preview_render_failed` is declared in the AMBIGUITIES table."""
    codes = {entry["code"] for entry in review.AMBIGUITIES}
    assert "preview_render_failed" in codes
