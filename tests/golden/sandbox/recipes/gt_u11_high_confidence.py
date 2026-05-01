"""GT-U11 — high-confidence audit halt-budget: exactly 1 halt.

Pins the contract: when the audit produces a single strong reusable
match (similarity ``\u2265 STRONG_SIMILARITY``, no runner-up within
``TIE_GAP``) and the input's confidence band is ``"high"``, the audit
step's ``_decide_path`` resolves to ``"high_confidence"`` and returns
``SUCCESS`` without emitting a halt. The dispatcher advances directly
into design, where the brief directive is the *only* user-facing halt
on the entire flow.

Halt budget — locked by this golden:

- **1 halt total** — ``ui-design-brief`` on cycle 1.
- No ``existing-ui-audit`` halt (seeded ``state.ui_audit`` short-circuits
  the audit-skill delegation).
- No ``_no_directive`` design sign-off halt (recipe writes
  ``design_confirmed=True`` together with the brief).
- No ``ui-apply-plain`` halt (seeded ``state.ui_apply`` carries a
  rendered envelope already).
- No ``ui-design-review-plain`` halt (seeded ``state.ui_review`` is
  ``review_clean=True`` with empty findings; polish short-circuits).

The seed deliberately omits ``audit_path`` so the engine's
deterministic ``_decide_path`` runs on the first cycle and records
``audit_path = "high_confidence"`` itself — the golden pins the
*decision*, not a pre-baked label.

Cycle map (cap = 4):

1. ``ui-design-brief``     — audit re-enters with seeded findings,
                             ``_decide_path`` returns
                             ``"high_confidence"``; design halts on the
                             brief directive. Recipe writes the brief
                             *with* ``design_confirmed=True`` so the
                             sign-off halt is skipped.
2. ``report`` runs         — audit / design / apply / review / polish
                             all return ``SUCCESS``; engine exits 0
                             with the delivery-Markdown report.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

META = {
    "gt_id": "GT-U11",
    "prompt_relpath": "prompts/gt-u11-high-confidence.txt",
    "persona": None,
    "cycle_cap": 4,
}


def seed_state(workspace: Path) -> dict[str, Any]:
    """Pre-populate the state file so cycle 1 starts past the audit gate.

    Carries the v1 envelope (``version`` / ``input`` / ``intent`` /
    ``directive_set``) plus a populated ``ui_audit`` (high-confidence
    shape, no ``audit_path`` — the engine's ``_decide_path`` records
    it), a rendered ``ui_apply`` envelope, and a clean ``ui_review``
    envelope. ``ui_design`` is intentionally absent so the design step
    halts on the brief directive — the *only* halt on this flow.
    """
    return {
        "version": 1,
        "input": {
            "kind": "prompt",
            "data": {
                "raw": (
                    "Add a contact form to the marketing site that "
                    "matches the existing form primitives.\n"
                ),
                "reconstructed_ac": [],
                "assumptions": [],
                "confidence": {
                    "band": "high",
                    "score": 0.92,
                },
                "ui_apply": {
                    "summary": (
                        "Contact form scaffolded reusing forms.text-input"
                    ),
                    "rendered": {
                        "resources/views/contact.blade.php": (
                            "Contact us \u2014 Your name, Your email "
                            "address, How can we help? Send message."
                        ),
                    },
                    "files": ["resources/views/contact.blade.php"],
                },
            },
        },
        "intent": "ui-build",
        "directive_set": "ui",
        "stack": None,
        "ui_audit": {
            "components_found": [
                {
                    "path": (
                        "resources/views/components/forms/"
                        "text-input.blade.php"
                    ),
                    "name": "forms.text-input",
                    "kind": "form-primitive",
                    "similarity": 0.85,
                },
                {
                    "path": (
                        "resources/views/components/forms/"
                        "textarea.blade.php"
                    ),
                    "name": "forms.textarea",
                    "kind": "form-primitive",
                    "similarity": 0.55,
                },
            ],
            "design_tokens": {
                "spacing": ["sm", "md", "lg"],
                "color": ["primary", "muted", "danger"],
            },
        },
        "ui_design": None,
        "ui_review": {
            "findings": [],
            "review_clean": True,
        },
        "ui_polish": None,
        "contract": None,
        "stitch": None,
        "persona": "senior-engineer",
        "memory": [],
        "plan": None,
        "changes": [],
        "tests": None,
        "verify": None,
        "outcomes": {},
        "questions": [],
        "report": "",
    }


def build_recipe(workspace: Path) -> dict[str, Any]:
    """Return the directive\u2192step mapping with ``workspace`` bound in."""

    def on_ui_design_brief(state: dict[str, Any], record) -> dict[str, Any]:
        state["ui_design"] = {
            "layout": "single-column form, max-w-md, centered",
            "components": [
                {
                    "name": "ContactForm",
                    "primitives": ["forms.text-input", "button"],
                },
            ],
            "states": {
                "empty": "Initial render: all fields empty, submit disabled",
                "loading": (
                    "Submit pressed: button shows spinner, fields disabled"
                ),
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
                "success": (
                    "Thanks \u2014 we will be in touch within one "
                    "business day."
                ),
            },
            "a11y": {
                "labels": (
                    "every field has a visible label tied via for/id"
                ),
                "focus": (
                    "first invalid field receives focus on submit error"
                ),
                "aria_live": (
                    "success card is announced via aria-live=polite"
                ),
            },
            "reused_from_audit": ["forms.text-input"],
            "design_confirmed": True,
        }
        record.recipe_notes.append(
            "ui_design brief written with design_confirmed=True "
            "(sign-off halt skipped on the high-confidence path)",
        )
        return state

    return {
        "ui-design-brief": on_ui_design_brief,
    }


__all__ = ["META", "build_recipe", "seed_state"]
