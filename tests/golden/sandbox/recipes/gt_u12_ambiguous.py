"""GT-U12 — ambiguous audit halt-budget: exactly 2 halts.

Counterpart to GT-U11. Pins the contract: when the audit produces
multiple close candidates *or* the input's confidence band is
``"medium"``, the audit step's ``_decide_path`` resolves to
``"ambiguous"`` and emits a numbered-options halt for candidate
pick. Once the user records ``audit_path = "ambiguous"`` plus a
``candidate_pick``, the design step shows the brief as a final
summary halt (``_halt_unconfirmed``) — *not* a separate
``ui-design-brief`` delegate, because the brief is already
populated. That collapses the ambiguous path to exactly two
user-facing halts.

Halt budget — locked by this golden:

- **2 halts total.**
  - Cycle 1: ``_no_directive`` — ``audit_ambiguous`` numbered-
    options halt (3 candidates + "build new").
  - Cycle 2: ``_no_directive`` — design-summary sign-off halt
    (brief is well-formed but ``design_confirmed`` is not yet
    ``True``).
- No ``existing-ui-audit`` halt (seeded ``state.ui_audit``
  short-circuits the audit-skill delegation).
- No ``ui-design-brief`` delegate halt (seeded ``state.ui_design``
  is a complete brief — ``_is_populated`` returns ``True`` so the
  step never delegates).
- No ``ui-apply-plain`` halt (seeded ``state.ui_apply`` carries a
  rendered envelope).
- No ``ui-design-review-plain`` halt (seeded ``state.ui_review``
  is ``review_clean=True`` with empty findings; polish short-
  circuits).

The seed deliberately omits ``audit_path`` so the engine's
deterministic ``_decide_path`` runs on cycle 1 and emits
``_halt_ambiguous`` itself — the golden pins the *decision*, not
a pre-baked label.

Cycle map (cap = 4):

1. ``_no_directive``  — audit re-enters with seeded findings
                        (``confidence.band = "medium"`` plus three
                        candidates within ``TIE_GAP``);
                        ``_decide_path`` returns ``"ambiguous"`` and
                        ``_halt_ambiguous`` emits the numbered
                        options. Recipe records
                        ``audit_path = "ambiguous"`` and
                        ``candidate_pick``.
2. ``_no_directive``  — audit returns ``SUCCESS`` (decided),
                        design re-enters with the seeded brief,
                        ``_halt_unconfirmed`` emits the sign-off
                        summary. Recipe sets
                        ``design_confirmed = True``.
3. ``report`` runs    — audit / design / apply / review / polish
                        all return ``SUCCESS``; engine exits 0
                        with the delivery-Markdown report.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

META = {
    "gt_id": "GT-U12",
    "prompt_relpath": "prompts/gt-u12-ambiguous.txt",
    "persona": None,
    "cycle_cap": 4,
}


def seed_state(workspace: Path) -> dict[str, Any]:
    """Pre-populate the state file so cycle 1 starts past the audit gate.

    Carries the v1 envelope (``version`` / ``input`` / ``intent`` /
    ``directive_set``) plus a populated ``ui_audit`` (three close
    candidates, ``confidence.band = "medium"`` — neither the band
    nor the similarity scores clear the high-confidence bar, so
    ``_decide_path`` returns ``"ambiguous"``), a populated
    ``ui_design`` brief without ``design_confirmed`` (so the design
    step halts on the summary), a rendered ``ui_apply`` envelope,
    and a clean ``ui_review`` envelope.
    """
    return {
        "version": 1,
        "input": {
            "kind": "prompt",
            "data": {
                "raw": (
                    "Improve the form layout — make it look better "
                    "and feel more consistent with what we already "
                    "have.\n"
                ),
                "reconstructed_ac": [],
                "assumptions": [],
                "confidence": {
                    "band": "medium",
                    "score": 0.55,
                },
                "ui_apply": {
                    "summary": (
                        "Form layout improvements applied to the "
                        "extended primitive"
                    ),
                    "rendered": {
                        "resources/views/components/forms/"
                        "labeled-input.blade.php": (
                            "Polished labeled-input variant — "
                            "tightened spacing, consistent label "
                            "weight, focus ring tokenized."
                        ),
                    },
                    "files": [
                        "resources/views/components/forms/"
                        "labeled-input.blade.php",
                    ],
                },
            },
        },
        "intent": "ui-improve",
        "directive_set": "ui",
        "stack": None,
        "ui_audit": {
            "components_found": [
                {
                    "path": (
                        "resources/views/components/forms/"
                        "labeled-input.blade.php"
                    ),
                    "name": "forms.labeled-input",
                    "kind": "form-primitive",
                    "similarity": 0.62,
                },
                {
                    "path": (
                        "resources/views/components/forms/"
                        "stacked-input.blade.php"
                    ),
                    "name": "forms.stacked-input",
                    "kind": "form-primitive",
                    "similarity": 0.60,
                },
                {
                    "path": (
                        "resources/views/components/forms/"
                        "compact-input.blade.php"
                    ),
                    "name": "forms.compact-input",
                    "kind": "form-primitive",
                    "similarity": 0.58,
                },
            ],
            "design_tokens": {
                "spacing": ["sm", "md", "lg"],
                "color": ["primary", "muted", "danger"],
            },
        },
        "ui_design": {
            "layout": (
                "stacked form fields, max-w-md, label-on-top, "
                "consistent vertical rhythm"
            ),
            "components": [
                {
                    "name": "FormLayout",
                    "primitives": ["forms.labeled-input", "button"],
                },
            ],
            "states": {
                "empty": "Initial render: fields empty, submit enabled",
                "loading": (
                    "Submit pressed: button shows spinner, fields disabled"
                ),
                "error": (
                    "Validation error: field-level message under each input"
                ),
                "success": "Form replaced by confirmation card",
                "disabled": "Fields disabled while loading state is active",
            },
            "microcopy": {
                "title": "Update your details",
                "fields": {
                    "name": "Full name",
                    "email": "Email address",
                },
                "buttons": {"submit": "Save changes"},
                "errors": {
                    "name_required": "Please enter your name.",
                    "email_invalid": "Enter a valid email address.",
                },
                "success": "Saved — your details are up to date.",
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
            "reused_from_audit": ["forms.labeled-input"],
        },
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
    """Return the directive→step mapping with ``workspace`` bound in."""

    def on_no_directive(state: dict[str, Any], record) -> dict[str, Any]:
        audit = state.setdefault("ui_audit", {})
        if not audit.get("audit_path"):
            audit["audit_path"] = "ambiguous"
            audit["candidate_pick"] = "forms.labeled-input"
            record.recipe_notes.append(
                "audit_path=ambiguous, candidate_pick=forms.labeled-input "
                "(user picked option 1 — strongest similarity)",
            )
            return state

        design = state.setdefault("ui_design", {})
        design["design_confirmed"] = True
        record.recipe_notes.append(
            "design_confirmed=True (user signed off on the brief summary)",
        )
        return state

    return {
        "_no_directive": on_no_directive,
    }


__all__ = ["META", "build_recipe", "seed_state"]
