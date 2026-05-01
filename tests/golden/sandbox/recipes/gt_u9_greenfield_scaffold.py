"""GT-U9 — greenfield audit halt → user picks ``scaffold``.

Pins the contract: when ``existing-ui-audit`` reports
``greenfield == True`` and no ``greenfield_decision`` is recorded
yet, the engine emits a numbered-options halt (no agent-directive
line, three options: scaffold / bare / external_reference). The
recipe simulates the user picking option 1 (``scaffold``); the
audit step then folds the decision back, sets
``audit_path = "greenfield"``, and the dispatcher advances through
design → apply → review → report on the happy path.

Cycle map (cap = 8):

1. ``existing-ui-audit``        — recipe writes ``greenfield=True`` audit
                                  with no decision yet.
2. ``_no_directive`` (greenfield) — recipe writes
                                  ``greenfield_decision = "scaffold"``
                                  (mirrors user picking option 1).
3. ``ui-design-brief``          — recipe writes a fully formed brief.
4. ``_no_directive`` (confirm)  — recipe sets ``design_confirmed=True``.
5. ``ui-apply-plain``           — recipe writes the apply envelope.
6. ``ui-design-review-plain``   — recipe writes a clean review.
7. ``report`` runs              — engine exits 0 with delivery report.

Iron-law contract this capture pins:

- The greenfield halt is the first ``_no_directive`` in the run; it
  fires only when ``audit.greenfield`` is True AND
  ``greenfield_decision`` is unset.
- After ``greenfield_decision`` is recorded, the audit step is
  idempotent: it returns SUCCESS and never re-emits the halt.
- ``_no_directive`` is reused for the design-confirmation halt at
  cycle 4; the recipe differentiates by reading audit shape.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

META = {
    "gt_id": "GT-U9",
    "prompt_relpath": "prompts/gt-u9-greenfield-scaffold.txt",
    "persona": None,
    "cycle_cap": 8,
}


def build_recipe(workspace: Path) -> dict[str, Any]:
    """Return the directive→step mapping with ``workspace`` bound in."""

    def on_existing_ui_audit(state: dict[str, Any], record) -> dict[str, Any]:
        state["ui_audit"] = {
            "greenfield": True,
            "components_found": [],
            "design_tokens": {},
        }
        record.recipe_notes.append(
            "ui_audit populated: greenfield=True, no components, no decision",
        )
        return state

    def on_no_directive(state: dict[str, Any], record) -> dict[str, Any]:
        # Two halts share this key in this run: the greenfield halt
        # at cycle 2 (audit.greenfield=True, no decision) and the
        # design-confirmation halt at cycle 4 (design brief ready,
        # design_confirmed unset). Branch on audit shape so each halt
        # gets the right state mutation.
        audit = state.get("ui_audit")
        if (
            isinstance(audit, dict)
            and audit.get("greenfield") is True
            and not audit.get("greenfield_decision")
        ):
            audit["greenfield_decision"] = "scaffold"
            record.recipe_notes.append(
                "greenfield_decision=scaffold (user picked option 1)",
            )
            return state
        design = state.get("ui_design")
        if not isinstance(design, dict):
            design = {}
            state["ui_design"] = design
        design["design_confirmed"] = True
        record.recipe_notes.append("design_confirmed=True (user picked option 1)")
        return state

    def on_ui_design_brief(state: dict[str, Any], record) -> dict[str, Any]:
        state["ui_design"] = {
            "layout": "single-column landing page, max-w-5xl, hero + 3 feature blocks",
            "components": [
                {"name": "MarketingLanding", "primitives": ["hero", "feature-grid", "cta"]},
            ],
            "states": {
                "empty": "First load with hero, features, CTA",
                "loading": "CTA button shows spinner while signup form submits",
                "error": "Inline validation on signup field",
                "success": "CTA replaced by 'Thanks — check your inbox'",
                "disabled": "CTA disabled while submission is in flight",
            },
            "microcopy": {
                "hero_title": "Ship faster with our SaaS platform",
                "hero_subtitle": "Deploy in minutes, not days.",
                "cta_button": "Start free trial",
                "success": "Thanks — check your inbox to confirm your email.",
            },
            "a11y": {
                "labels": "hero h1 is the page title; CTA button labelled explicitly",
                "focus": "skip link to main content; CTA receives focus on success",
                "aria_live": "success message announced via aria-live=polite",
            },
            "reused_from_audit": [],
        }
        record.recipe_notes.append("ui_design brief written for greenfield landing")
        return state

    def on_ui_apply_plain(state: dict[str, Any], record) -> dict[str, Any]:
        data = state.setdefault("input", {}).setdefault("data", {})
        data["ui_apply"] = {
            "summary": "Marketing landing page scaffolded with locked microcopy",
            "rendered": {
                "resources/views/marketing/landing.blade.php":
                    "Ship faster with our SaaS platform. Deploy in minutes, "
                    "not days. Start free trial.",
            },
            "files": ["resources/views/marketing/landing.blade.php"],
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
        "_no_directive": on_no_directive,
        "ui-design-brief": on_ui_design_brief,
        "ui-apply-plain": on_ui_apply_plain,
        "ui-design-review-plain": on_ui_review_plain,
    }


__all__ = ["META", "build_recipe"]
