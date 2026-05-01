"""GT-U15 — preview render failure; user skips the visual artifact.

Pins R4 Phase 3's preview gate: when the review skill writes
``state.ui_review.preview.render_ok = False`` the engine emits the
dedicated ``preview_render_failed`` halt (Retry / Skip / Abort)
instead of advancing to polish or report. The user picks **Skip**,
the recipe sets ``preview.skipped = True``, the next review re-enters
with the gate as a no-op, and the run ships without a screenshot
artifact.

The audit deliberately omits ``a11y_baseline`` so the a11y gate is a
no-op for this transcript — the preview gate is the *only* new halt.

Cycle map (cap = 8):

1. ``existing-ui-audit``        — recipe writes audit (no
   ``a11y_baseline``; a11y gate stays silent).
2. ``ui-design-brief``          — recipe writes a fully formed brief.
3. ``_no_directive`` (confirm)  — recipe sets ``design_confirmed=True``.
4. ``ui-apply-plain``           — recipe writes the apply envelope.
5. ``ui-design-review-plain``   — recipe writes ``findings=[]``,
   ``review_clean=True``, and ``preview.render_ok=False`` with an
   error message. The engine's preview gate then emits
   ``preview_render_failed`` on the *next* cycle (same directive,
   so the skill can retry the render).
6. ``ui-design-review-plain``   — preview-failed re-entry: recipe
   detects ``preview.render_ok is False`` with ``skipped`` unset and
   picks Skip, flipping ``state.ui_review.preview.skipped = True``.
7. ``report`` runs              — preview gate is a no-op once
   ``skipped`` is truthy; review returns SUCCESS, polish
   short-circuits on the empty findings, report produces the
   delivery markdown, exit 0.

Iron-law contract this capture pins:

- The engine never renders. The skill writes ``preview.render_ok``;
  the engine reads it and gates on the value.
- ``preview.skipped`` makes the gate idempotent: once set, re-entry
  passes through silently regardless of ``render_ok``.
- The preview gate is independent of the a11y gate — this run keeps
  ``a11y_baseline`` absent so only the preview path is exercised.
- The preview halt re-uses the review directive (same skill retries
  the render); the recipe discriminates first-call vs Skip by
  reading ``state.ui_review.preview`` — analogous state-marker
  pattern to GT-U4 and GT-U14, but on the review step rather than
  ``_no_directive``.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

META = {
    "gt_id": "GT-U15",
    "prompt_relpath": "prompts/gt-u15-preview-fail.txt",
    "persona": None,
    "cycle_cap": 8,
}


def build_recipe(workspace: Path) -> dict[str, Any]:
    """Return the directive→step mapping with ``workspace`` bound in."""

    def on_existing_ui_audit(state: dict[str, Any], record) -> dict[str, Any]:
        state["ui_audit"] = {
            "components_found": [
                {
                    "path": "resources/views/components/cards/tier.blade.php",
                    "name": "cards.tier",
                    "kind": "card",
                    "similarity": 0.83,
                },
            ],
            "design_tokens": {
                "spacing": {"sm": "8px", "md": "12px", "lg": "16px"},
                "color": {"primary": "#1a73e8", "muted": "#6b7280"},
            },
            "audit_path": "high_confidence",
            "candidate_pick": "cards.tier",
        }
        record.recipe_notes.append(
            "ui_audit populated; no a11y_baseline (a11y gate stays silent)",
        )
        return state

    def on_ui_design_brief(state: dict[str, Any], record) -> dict[str, Any]:
        state["ui_design"] = {
            "layout": "three-column tier grid, max-w-6xl, centered",
            "components": [
                {"name": "PricingTierCard", "primitives": ["cards.tier", "button"]},
            ],
            "states": {
                "empty": "Grid renders all three tiers with default emphasis",
                "loading": "Skeleton placeholders while pricing data resolves",
                "error": "Inline error replaces grid on price-feed failure",
                "success": "Selected tier highlighted; CTA enabled",
                "disabled": "Tiers muted while a checkout flow is active",
            },
            "microcopy": {
                "title": "Pricing",
                "tiers": {
                    "starter": "Starter — for solo builders",
                    "team": "Team — for growing squads",
                    "enterprise": "Enterprise — talk to sales",
                },
                "buttons": {"cta": "Choose plan"},
            },
            "a11y": {
                "labels": "each tier card is a labelled region with heading",
                "focus": "CTA button reachable after the tier description",
                "aria_live": "selection feedback announced via aria-live=polite",
            },
            "reused_from_audit": ["cards.tier"],
        }
        record.recipe_notes.append("ui_design brief written for pricing grid")
        return state

    def on_no_directive(state: dict[str, Any], record) -> dict[str, Any]:
        # The only ``_no_directive`` halt in this recipe is the design
        # confirmation at cycle 3. ``preview_render_failed`` is emitted
        # by the review step itself with directive
        # ``ui-design-review-<stack>`` and is therefore handled inside
        # ``on_ui_review_plain`` below.
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
            "summary": "Pricing tier grid rendered with three tiers",
            "rendered": {
                "resources/views/marketing/pricing.blade.php":
                    "Pricing — Starter, Team, Enterprise. Choose plan.",
            },
            "files": ["resources/views/marketing/pricing.blade.php"],
        }
        record.recipe_notes.append("ui_apply envelope written: 1 file")
        return state

    def on_ui_review_plain(state: dict[str, Any], record) -> dict[str, Any]:
        # Two halts share this directive: the first-pass review
        # delegation at cycle 5 and the ``preview_render_failed`` halt
        # at cycle 6 (the engine emits the same review directive so the
        # skill can retry the render). Discriminate on the preview
        # envelope: first call writes the failure; the rebound flips
        # ``preview.skipped = True`` to honour the user's Skip choice.
        review = state.get("ui_review")
        existing_preview = (
            review.get("preview")
            if isinstance(review, dict)
            else None
        )
        if (
            isinstance(existing_preview, dict)
            and existing_preview.get("render_ok") is False
            and not existing_preview.get("skipped")
        ):
            existing_preview["skipped"] = True
            record.recipe_notes.append(
                "preview_render_failed halt: user picked Skip; "
                "preview.skipped=True (gate is now a no-op)",
            )
            return state
        # First-pass review: skill ran but the headless render failed
        # (e.g. Playwright could not boot or the Blade view threw on
        # render). Findings list stays empty, review_clean=True; the
        # preview envelope is what the engine gates on.
        state["ui_review"] = {
            "findings": [],
            "review_clean": True,
            "preview": {
                "render_ok": False,
                "error": (
                    "playwright: net::ERR_CONNECTION_REFUSED at "
                    "http://localhost:8080/marketing/pricing"
                ),
            },
        }
        record.recipe_notes.append(
            "ui_review with preview.render_ok=False; "
            "engine will halt on preview_render_failed",
        )
        return state

    return {
        "existing-ui-audit": on_existing_ui_audit,
        "ui-design-brief": on_ui_design_brief,
        "_no_directive": on_no_directive,
        "ui-apply-plain": on_ui_apply_plain,
        "ui-design-review-plain": on_ui_review_plain,
    }


__all__ = ["META", "build_recipe"]
