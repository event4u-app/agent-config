"""GT-U14 — a11y blocks at ceiling; user accepts known violations.

Pins R4 Phase 2's ``polish_a11y_blocking`` halt: when polish reaches
``rounds == POLISH_CEILING`` and at least one ``a11y_violation``
finding remains, the engine emits the dedicated a11y-blocking halt
(extend / accept / abort) instead of the subjective
``polish_ceiling_reached`` halt. The user picks **accept**, the
recipe appends the open violation to
``state.ui_review.a11y.accepted_violations``, the next review re-enters
clean, and the run ships.

Cycle map (cap = 10):

1. ``existing-ui-audit``        — recipe writes audit *with*
   ``a11y_baseline = []``.
2. ``ui-design-brief``          — recipe writes a fully formed brief.
3. ``_no_directive`` (confirm)  — recipe sets ``design_confirmed=True``.
4. ``ui-apply-plain``           — recipe writes the apply envelope.
5. ``ui-design-review-plain``   — recipe writes ``a11y.violations=[A,B]``
   (both moderate). Gate synthesises both findings, flips
   ``review_clean=False``.
6. ``ui-polish-plain`` (round 1) — recipe sets ``rounds=1`` and writes
   a refreshed review with **only B** still open (A was fixed).
7. ``ui-polish-plain`` (round 2) — recipe sets ``rounds=2`` and writes
   another review with B still open (no convergence on the second
   violation either).
8. ``_no_directive`` (a11y_blocking) — engine emits the dedicated
   halt because ``rounds == 2`` AND ``findings`` carries an
   ``a11y_violation`` entry. Recipe accepts: appends B to
   ``a11y.accepted_violations`` and sets ``review_clean=True``.
9. ``report`` runs              — review re-enters with B filtered
   out by the accepted list, polish short-circuits on
   ``review_clean=True``, report produces the delivery markdown,
   exit 0.

Iron-law contract this capture pins:

- A11y findings dominate the ceiling halt: with at least one
  ``a11y_violation`` entry at ``rounds == 2``, the engine **must**
  emit ``polish_a11y_blocking`` and never ``polish_ceiling_reached``.
- ``accepted_violations`` filtering is on ``(rule, selector)``: once
  the violation is appended, the next review gate treats it as
  known and stops blocking.
- The one-shot extension is *not* used here — only accept/abort
  paths are exercised. ``state.ui_polish.extension_used`` stays
  ``False`` for the whole transcript.
- Two ``_no_directive`` halts share this run (design confirm at
  cycle 3, a11y_blocking at cycle 8). The recipe discriminates by
  reading ``ui_polish.rounds`` — same pattern as GT-U4.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

META = {
    "gt_id": "GT-U14",
    "prompt_relpath": "prompts/gt-u14-a11y-ceiling.txt",
    "persona": None,
    "cycle_cap": 10,
}


VIOLATION_A: dict[str, Any] = {
    "rule": "label",
    "selector": "input#settings-toggle-notifications",
    "severity": "moderate",
}
"""First violation — fixed in polish round 1."""

VIOLATION_B: dict[str, Any] = {
    "rule": "aria-tooltip-name",
    "selector": "[role=tooltip]#settings-help",
    "severity": "moderate",
}
"""Second violation — does not converge across two polish rounds."""


def build_recipe(workspace: Path) -> dict[str, Any]:
    """Return the directive→step mapping with ``workspace`` bound in."""

    def on_existing_ui_audit(state: dict[str, Any], record) -> dict[str, Any]:
        state["ui_audit"] = {
            "components_found": [
                {
                    "path": "resources/views/components/forms/toggle.blade.php",
                    "name": "forms.toggle",
                    "kind": "form-primitive",
                    "similarity": 0.81,
                },
            ],
            "design_tokens": {"spacing": {"sm": "8px", "md": "12px"}},
            "audit_path": "high_confidence",
            "candidate_pick": "forms.toggle",
            "a11y_baseline": [],
        }
        record.recipe_notes.append(
            "ui_audit populated with empty a11y_baseline (a11y gate opted in)",
        )
        return state

    def on_ui_design_brief(state: dict[str, Any], record) -> dict[str, Any]:
        state["ui_design"] = {
            "layout": "two-column settings panel, max-w-3xl",
            "components": [
                {
                    "name": "SettingsPanel",
                    "primitives": ["forms.toggle", "tooltip"],
                },
            ],
            "states": {
                "empty": "Panel renders with default toggle states",
                "loading": "Save button shows spinner while persisting",
                "error": "Inline error replaces toast on save failure",
                "success": "Save button confirms with checkmark for 1s",
                "disabled": "Toggles disabled while save is in flight",
            },
            "microcopy": {
                "title": "Notification settings",
                "fields": {
                    "notifications": "Email me when a job finishes",
                },
                "tooltips": {
                    "notifications": "Sent at most once per hour.",
                },
                "buttons": {"save": "Save changes"},
            },
            "a11y": {
                "labels": "every toggle has a visible label and matching for/id",
                "focus": "save button reachable after the last toggle",
                "aria_live": "save confirmation announced via aria-live=polite",
            },
            "reused_from_audit": ["forms.toggle"],
        }
        record.recipe_notes.append("ui_design brief written for settings panel")
        return state

    def on_no_directive(state: dict[str, Any], record) -> dict[str, Any]:
        # Two halts share this key: design confirmation at cycle 3 and
        # polish_a11y_blocking at cycle 8. Discriminate on the polish
        # round counter — a11y_blocking only fires at the ceiling.
        polish = state.get("ui_polish") or {}
        rounds = polish.get("rounds", 0)
        if isinstance(rounds, int) and not isinstance(rounds, bool) and rounds >= 2:
            review = state.get("ui_review")
            if not isinstance(review, dict):
                review = {}
                state["ui_review"] = review
            a11y = review.get("a11y")
            if not isinstance(a11y, dict):
                a11y = {}
                review["a11y"] = a11y
            accepted = a11y.get("accepted_violations")
            if not isinstance(accepted, list):
                accepted = []
                a11y["accepted_violations"] = accepted
            accepted.append(dict(VIOLATION_B))
            review["review_clean"] = True
            record.recipe_notes.append(
                "a11y_blocking halt: user picked Accept; "
                "VIOLATION_B appended to accepted_violations",
            )
            return state
        design = state.get("ui_design")
        if not isinstance(design, dict):
            design = {}
            state["ui_design"] = design
        design["design_confirmed"] = True
        record.recipe_notes.append("design_confirmed=True (user picked option 1)")
        return state

    def on_ui_apply_plain(state: dict[str, Any], record) -> dict[str, Any]:
        data = state.setdefault("input", {}).setdefault("data", {})
        data["ui_apply"] = {
            "summary": "Settings panel rendered with toggles and tooltips",
            "rendered": {
                "resources/views/settings/notifications.blade.php":
                    "Notification settings — Email me when a job finishes. "
                    "Save changes.",
            },
            "files": ["resources/views/settings/notifications.blade.php"],
        }
        record.recipe_notes.append("ui_apply envelope written: 1 file")
        return state

    def on_ui_review_plain(state: dict[str, Any], record) -> dict[str, Any]:
        # First review pass: skill reports two moderate a11y violations.
        # The gate will synthesise both as findings on the next cycle.
        state["ui_review"] = {
            "findings": [],
            "review_clean": True,
            "a11y": {
                "violations": [dict(VIOLATION_A), dict(VIOLATION_B)],
            },
        }
        record.recipe_notes.append(
            "ui_review with 2 moderate a11y violations; gate will synthesise findings",
        )
        return state

    def on_ui_polish_plain(state: dict[str, Any], record) -> dict[str, Any]:
        polish = state.get("ui_polish")
        if not isinstance(polish, dict):
            polish = {}
            state["ui_polish"] = polish
        rounds = polish.get("rounds", 0)
        if not isinstance(rounds, int) or isinstance(rounds, bool):
            rounds = 0
        polish["rounds"] = rounds + 1
        applied = polish.setdefault("applied", [])
        # Round 1 fixes VIOLATION_A; round 2 still cannot fix VIOLATION_B.
        # The polish skill is responsible for producing the refreshed
        # review envelope (the dispatcher skips the review gate after
        # its first SUCCESS), so the recipe synthesises the leftover
        # a11y_violation finding directly — same shape the review gate
        # produces via _synthesize_a11y_findings.
        if polish["rounds"] == 1:
            applied.append(
                "round 1: added <label for> on settings-toggle-notifications; "
                "tooltip name still missing",
            )
        else:
            applied.append(
                f"round {polish['rounds']}: tried wrapping tooltip in role=group; "
                "a11y still flags missing accessible name",
            )
        state["ui_review"] = {
            "findings": [
                {
                    "kind": "a11y_violation",
                    "rule": VIOLATION_B["rule"],
                    "selector": VIOLATION_B["selector"],
                    "severity": VIOLATION_B["severity"],
                },
            ],
            "review_clean": False,
            "a11y": {
                "violations": [dict(VIOLATION_B)],
            },
        }
        record.recipe_notes.append(
            f"polish round {polish['rounds']}: VIOLATION_B still open; "
            "synthesised a11y_violation finding into ui_review.findings",
        )
        return state

    return {
        "existing-ui-audit": on_existing_ui_audit,
        "ui-design-brief": on_ui_design_brief,
        "_no_directive": on_no_directive,
        "ui-apply-plain": on_ui_apply_plain,
        "ui-design-review-plain": on_ui_review_plain,
        "ui-polish-plain": on_ui_polish_plain,
    }


__all__ = ["META", "VIOLATION_A", "VIOLATION_B", "build_recipe"]
