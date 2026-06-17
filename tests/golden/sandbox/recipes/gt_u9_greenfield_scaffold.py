"""GT-U9 — greenfield audit halt → user picks ``scaffold`` → full Zero-to-One flow.

Pins the contract: when ``existing-ui-audit`` reports
``greenfield == True`` and no ``greenfield_decision`` is recorded
yet, the engine emits a numbered-options halt (no agent-directive
line, three options: scaffold / bare / external_reference). The
recipe simulates the user picking option 1 (``scaffold``); the audit
step folds the decision back and the dispatcher walks the full
greenfield Zero-to-One pipeline added by the greenfield-scaffold
roadmap (Phases 2-4 council, Option A ordering):

    audit → app-spec → design → scaffold → apply → review → report

Cycle map (cap = 12):

1. ``existing-ui-audit``        — recipe writes ``greenfield=True`` audit
                                  with no decision yet.
2. ``_no_directive`` (greenfield) — recipe writes
                                  ``greenfield_decision = "scaffold"``.
3. ``app-spec``                 — recipe writes the derived
                                  ``state.app_spec`` (pages + entities +
                                  flow-map), ``confirmed`` unset.
4. ``_no_directive`` (app-spec confirm) — recipe sets
                                  ``app_spec.confirmed = True``.
5. ``ui-design-brief``          — recipe writes a fully formed brief.
6. ``_no_directive`` (design confirm) — recipe sets
                                  ``design_confirmed = True``.
7. ``ui-scaffold-plan``         — recipe writes the stack-agnostic
                                  scaffold plan into ``state.ui_scaffold``.
8. ``ui-scaffold-plain``        — recipe marks ``scaffolded = True`` and
                                  records ``artifacts`` (engine wrote no
                                  files; the stack skill did).
9. ``ui-apply-plain``           — recipe writes the apply envelope.
10. ``ui-design-review-plain``  — recipe writes a clean review.
11. ``report`` runs             — engine exits 0 with delivery report.

Iron-law contracts this capture pins:

- The greenfield halt is the first ``_no_directive`` in the run; it
  fires only when ``audit.greenfield`` is True AND
  ``greenfield_decision`` is unset.
- After ``greenfield_decision = "scaffold"`` is recorded, the
  greenfield path runs app-spec (``memory`` slot) before design and
  scaffold (``plan`` slot) after design — the Option A ordering.
- ``_no_directive`` is shared by three halts (greenfield, app-spec
  confirm, design confirm); the recipe differentiates by reading the
  state shape.
- Scaffold is plan-only: the engine writes no files; the recipe (acting
  as the stack skill) sets ``scaffolded = True`` + ``artifacts``.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

META = {
    "gt_id": "GT-U9",
    "prompt_relpath": "prompts/gt-u9-greenfield-scaffold.txt",
    "persona": None,
    "cycle_cap": 12,
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
        # Three halts share this key in this run: the greenfield halt
        # (audit.greenfield=True, no decision), the app-spec confirm
        # halt (app_spec has a page-set, not confirmed), and the
        # design-confirmation halt (design brief ready, design_confirmed
        # unset). Branch on state shape so each halt gets the right
        # mutation; the greenfield → app-spec → design order makes the
        # branches mutually exclusive at the cycle each fires.
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

        spec = state.get("app_spec")
        if (
            isinstance(spec, dict)
            and isinstance(spec.get("pages"), list)
            and spec.get("confirmed") is not True
            and not spec.get("bypassed")
        ):
            spec["confirmed"] = True
            record.recipe_notes.append("app_spec confirmed (user picked option 1)")
            return state

        design = state.get("ui_design")
        if not isinstance(design, dict):
            design = {}
            state["ui_design"] = design
        design["design_confirmed"] = True
        record.recipe_notes.append("design_confirmed=True (user picked option 1)")
        return state

    def on_app_spec(state: dict[str, Any], record) -> dict[str, Any]:
        state["app_spec"] = {
            "pages": ["Landing"],
            "entity_model": ["SignupLead"],
            "flow_map": {"Landing": ["signup-submit"]},
        }
        record.recipe_notes.append(
            "app_spec derived: 1 page (Landing), 1 entity (SignupLead)",
        )
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

    def on_ui_scaffold_plan(state: dict[str, Any], record) -> dict[str, Any]:
        state["ui_scaffold"] = {
            "pages": ["Landing"],
            "routes": ["/"],
            "layout_strategy": "single-column-shell",
            "component_manifest": ["MarketingLanding", "SignupForm"],
            "token_seed": {"radius": "0.5rem", "font": "system-ui"},
        }
        record.recipe_notes.append(
            "ui_scaffold plan written: 1 page, 1 route, single-column-shell",
        )
        return state

    def on_ui_scaffold_plain(state: dict[str, Any], record) -> dict[str, Any]:
        scaffold = state.setdefault("ui_scaffold", {})
        scaffold["scaffolded"] = True
        scaffold["artifacts"] = [
            "resources/views/marketing/landing.blade.php",
            "routes/marketing.php",
        ]
        record.recipe_notes.append(
            "scaffold skeleton created: scaffolded=True, 2 artifacts",
        )
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
        "app-spec": on_app_spec,
        "ui-design-brief": on_ui_design_brief,
        "ui-scaffold-plan": on_ui_scaffold_plan,
        "ui-scaffold-plain": on_ui_scaffold_plain,
        "ui-apply-plain": on_ui_apply_plain,
        "ui-design-review-plain": on_ui_review_plain,
    }


__all__ = ["META", "build_recipe"]
