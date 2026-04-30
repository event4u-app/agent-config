"""GT-U1 — UI build happy path: full audit→design→apply→review chain.

Six engine cycles total — the prompt-mode capture that pins the
behaviour of the ``ui`` directive set end-to-end:

1. ``existing-ui-audit`` directive halt → recipe writes a populated
   ``state.ui_audit`` with ``components_found`` plus
   ``audit_path = "high_confidence"`` so the idempotent re-entry on
   cycle 2 returns ``SUCCESS`` without re-emitting the candidate-pick
   halt. The shortcut is deliberate: GT-U1 pins the *shape* of the
   happy path, not the deterministic confidence-band scoring (that
   surface lives in unit tests for ``audit.py``).
2. ``ui-design-brief`` directive halt → recipe writes a fully formed
   brief (layout / components / states / microcopy / a11y) into
   ``state.ui_design``. Microcopy is final on first write — no
   placeholder patterns.
3. ``_no_directive`` halt (design-confirmation summary) → recipe flips
   ``state.ui_design.design_confirmed = True`` mirroring the user
   picking option ``1``.
4. ``ui-apply-plain`` directive halt → recipe writes the apply
   envelope (``rendered`` + ``files`` + ``summary``) into
   ``state.input.data.ui_apply``. The handler then records one
   ``state.changes`` entry per file on the rebound and advances.
5. ``ui-design-review-plain`` directive halt → recipe writes a clean
   review envelope (``findings = []``, ``review_clean = True``).
   Polish short-circuits to ``SUCCESS`` on ``review_clean=True``.
6. ``report`` runs → engine exits 0 with the delivery-Markdown report.

The capture locks the iron-law contract that the UI track enforces
the audit gate first, the brief lock second, and the placeholder
gate at apply — and that a clean review lets polish exit silently.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

META = {
    "gt_id": "GT-U1",
    "prompt_relpath": "prompts/gt-u1-build-happy.txt",
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
                    "similarity": 0.82,
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
                "empty": "Initial render: all fields empty, submit disabled",
                "loading": "Submit pressed: button shows spinner, fields disabled",
                "error": "Validation or server error: field-level messages",
                "success": "Form replaced by confirmation card",
                "disabled": "Fields disabled while loading state is active",
            },
            "microcopy": {
                "title": "Contact us",
                "fields": {
                    "name": "Your name",
                    "email": "Your email address",
                    "message": "How can we help?",
                },
                "buttons": {"submit": "Send message"},
                "errors": {
                    "name_required": "Please enter your name.",
                    "email_invalid": "Enter a valid email address.",
                    "message_required": "Please enter a message.",
                },
                "success": "Thanks — we will be in touch within one business day.",
            },
            "a11y": {
                "labels": "every field has a visible label tied via for/id",
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
            "summary": "Contact form scaffolded with locked microcopy",
            "rendered": {
                "resources/views/contact.blade.php":
                    "Contact us — Your name, Your email address, "
                    "How can we help? Send message.",
                "app/Http/Controllers/ContactController.php":
                    "store: validate name/email/message, dispatch mail, "
                    "return success view.",
            },
            "files": [
                "resources/views/contact.blade.php",
                "app/Http/Controllers/ContactController.php",
            ],
        }
        record.recipe_notes.append("ui_apply envelope written: 2 files")
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
