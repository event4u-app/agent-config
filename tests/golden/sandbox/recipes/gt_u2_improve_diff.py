"""GT-U2 — UI improve via diff: existing-screen diff input → full UI track.

Six engine cycles total — the diff-mode capture that pins the
behaviour of the ``ui`` directive set when the entry point is a
unified diff describing changes to an *existing* surface (not a
free-form prompt). The diff envelope routes directly to
``ui-improve`` per :func:`work_engine.intent.classify.populate_routing`,
which forces the audit gate without going through the prose-oriented
classifier.

1. ``existing-ui-audit`` directive halt → recipe writes a populated
   ``state.ui_audit`` with one matched component
   (``forms.text-input``) plus ``audit_path = "high_confidence"`` so
   the idempotent re-entry returns ``SUCCESS`` without re-emitting
   the candidate-pick halt. Mirrors GT-U1's audit shape so the two
   captures cover identical happy-path shapes — the only thing GT-U2
   pins extra is the diff entry point.
2. ``ui-design-brief`` directive halt → recipe writes a fully formed
   brief (layout / components / states / microcopy / a11y) into
   ``state.ui_design``. Microcopy is final on first write.
3. ``_no_directive`` halt (design-confirmation summary) → recipe flips
   ``state.ui_design.design_confirmed = True`` (user picks option 1).
4. ``ui-apply-plain`` directive halt → recipe writes the apply
   envelope into ``state.input.data.ui_apply``.
5. ``ui-design-review-plain`` directive halt → clean review
   (``review_clean = True``); polish short-circuits to ``SUCCESS``.
6. ``report`` runs → engine exits 0 with the delivery-Markdown report.

The capture locks that diff entry → ``input.kind="diff"`` →
``intent="ui-improve"`` → ``directive_set="ui"`` is stable, and that
the same six-step UI track applies regardless of whether the input
arrived as a prompt (GT-U1) or as a diff (GT-U2).
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

META = {
    "gt_id": "GT-U2",
    "diff_relpath": "diffs/gt-u2-improve-diff.diff",
    "persona": None,
    "cycle_cap": 8,
}


def build_recipe(workspace: Path) -> dict[str, Any]:
    """Return the directive→step mapping with ``workspace`` bound in."""

    def on_existing_ui_audit(state: dict[str, Any], record) -> dict[str, Any]:
        state["ui_audit"] = {
            "components_found": [
                {
                    "path": "resources/views/components/forms/text-input.blade.php",
                    "name": "forms.text-input",
                    "kind": "form-primitive",
                    "similarity": 0.78,
                },
            ],
            "design_tokens": {
                "spacing": ["sm", "md", "lg"],
                "color": ["primary", "muted", "danger"],
            },
            "audit_path": "high_confidence",
            "candidate_pick": "forms.text-input",
        }
        record.recipe_notes.append(
            "ui_audit populated: 1 component, audit_path=high_confidence",
        )
        return state

    def on_ui_design_brief(state: dict[str, Any], record) -> dict[str, Any]:
        state["ui_design"] = {
            "layout": "single-column form, max-w-md, centered",
            "components": [
                {"name": "ContactForm", "primitives": ["forms.text-input", "button"]},
            ],
            "states": {
                "empty": "Initial render: name field empty, submit enabled",
                "loading": "Submit pressed: button shows spinner, field disabled",
                "error": "Validation error: field-level message under input",
                "success": "Form replaced by confirmation card",
                "disabled": "Field disabled while loading state is active",
            },
            "microcopy": {
                "title": "Contact us",
                "fields": {"name": "Your name"},
                "buttons": {"submit": "Send"},
                "errors": {"name_required": "Please enter your name."},
                "success": "Thanks — we will be in touch within one business day.",
            },
            "a11y": {
                "labels": "name field has visible label tied via for/id",
                "focus": "first invalid field receives focus on submit error",
                "aria_live": "success card is announced via aria-live=polite",
            },
            "reused_from_audit": ["forms.text-input"],
        }
        record.recipe_notes.append("ui_design brief written; microcopy final")
        return state

    def on_no_directive(state: dict[str, Any], record) -> dict[str, Any]:
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
            "summary": "Contact form refined with locked microcopy and a11y label",
            "rendered": {
                "resources/views/contact.blade.php":
                    "Contact us — Your name (labeled), Send.",
            },
            "files": [
                "resources/views/contact.blade.php",
            ],
        }
        record.recipe_notes.append("ui_apply envelope written: 1 file")
        return state

    def on_ui_review_plain(state: dict[str, Any], record) -> dict[str, Any]:
        state["ui_review"] = {
            "findings": [],
            "review_clean": True,
        }
        record.recipe_notes.append("ui_review clean: 0 findings, review_clean=True")
        return state

    return {
        "existing-ui-audit": on_existing_ui_audit,
        "ui-design-brief": on_ui_design_brief,
        "_no_directive": on_no_directive,
        "ui-apply-plain": on_ui_apply_plain,
        "ui-design-review-plain": on_ui_review_plain,
    }


__all__ = ["META", "build_recipe"]
