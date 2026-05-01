"""GT-U13 — a11y findings drive polish loop; round 1 fixes them.

Pins R4 Phase 1's a11y gate end-to-end: when the audit declares a
baseline (opt-in marker) and the review skill returns an ``a11y``
envelope with one actionable violation at severity ``"serious"``, the
gate synthesises an ``a11y_violation`` finding, flips
``review_clean`` to ``False``, and the dispatcher walks into polish.
Round 1 fixes the violation, the next review re-enters clean, and
the run ships.

Cycle map (cap = 8):

1. ``existing-ui-audit``        — recipe writes audit *with*
   ``a11y_baseline = []`` (empty list flags the surface as
   a11y-tracked without grandfathering anything in).
2. ``ui-design-brief``          — recipe writes a fully formed brief.
3. ``_no_directive`` (confirm)  — recipe sets ``design_confirmed=True``.
4. ``ui-apply-plain``           — recipe writes the apply envelope.
5. ``ui-design-review-plain``   — recipe writes ``findings=[]``,
   ``review_clean=True``, and ``a11y.violations=[serious]``. The
   engine's a11y gate then synthesises an ``a11y_violation`` finding
   on the *next* cycle and forces ``review_clean=False``.
6. ``ui-polish-plain`` (round 1) — recipe sets
   ``ui_polish.rounds=1`` and writes a clean review (no violations,
   ``review_clean=True``). The polish skill converged in one round.
7. ``report`` runs              — review re-enters clean, polish
   short-circuits, report produces the delivery markdown, exit 0.

Iron-law contract this capture pins:

- A11y baseline opt-in: present on ``ui_audit`` → gate fires; absent
  (GT-U1, GT-U4) → gate is a no-op.
- A11y findings round-trip through the synthesise → polish → fix
  path identical to subjective findings; the only discriminator is
  the ``kind == "a11y_violation"`` marker.
- One round is enough on convergent fixes; the polish ceiling and
  ``polish_a11y_blocking`` halt never enter this transcript.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

META = {
    "gt_id": "GT-U13",
    "prompt_relpath": "prompts/gt-u13-a11y-polish.txt",
    "persona": None,
    "cycle_cap": 8,
}


def build_recipe(workspace: Path) -> dict[str, Any]:
    """Return the directive→step mapping with ``workspace`` bound in."""

    def on_existing_ui_audit(state: dict[str, Any], record) -> dict[str, Any]:
        state["ui_audit"] = {
            "components_found": [
                {
                    "path": "resources/views/components/banners/status.blade.php",
                    "name": "banners.status",
                    "kind": "banner",
                    "similarity": 0.78,
                },
            ],
            "design_tokens": {"spacing": {"sm": "8px", "md": "12px"}},
            "audit_path": "high_confidence",
            "candidate_pick": "banners.status",
            "a11y_baseline": [],
        }
        record.recipe_notes.append(
            "ui_audit populated with empty a11y_baseline (a11y gate opted in)",
        )
        return state

    def on_ui_design_brief(state: dict[str, Any], record) -> dict[str, Any]:
        state["ui_design"] = {
            "layout": "horizontal banner under top nav, full-width",
            "components": [
                {"name": "StatusBanner", "primitives": ["banners.status"]},
            ],
            "states": {
                "empty": "Banner hidden when no status to surface",
                "loading": "Banner shows neutral spinner while message resolves",
                "error": "Banner switches to danger variant on failures",
                "success": "Banner switches to success variant on positive ack",
                "disabled": "Banner muted while another modal owns focus",
            },
            "microcopy": {
                "title": "System status",
                "message": "All services operating normally.",
                "buttons": {"dismiss": "Dismiss"},
            },
            "a11y": {
                "labels": "banner has role=status with aria-live=polite",
                "focus": "dismiss button reachable as last item in tab order",
                "aria_live": "status changes announced via aria-live=polite",
            },
            "reused_from_audit": ["banners.status"],
        }
        record.recipe_notes.append("ui_design brief written for status banner")
        return state

    def on_no_directive(state: dict[str, Any], record) -> dict[str, Any]:
        # Only one _no_directive halt on this run: cycle 3 design confirm.
        # The polish loop converges in round 1 so polish_a11y_blocking
        # never fires.
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
            "summary": "Status banner rendered under the dashboard header",
            "rendered": {
                "resources/views/dashboard/header.blade.php":
                    "System status — All services operating normally. Dismiss.",
            },
            "files": ["resources/views/dashboard/header.blade.php"],
        }
        record.recipe_notes.append("ui_apply envelope written: 1 file")
        return state

    def on_ui_review_plain(state: dict[str, Any], record) -> dict[str, Any]:
        # First review pass: skill reports one serious a11y violation.
        # The engine's a11y gate synthesises a finding and flips
        # review_clean=False on the next cycle.
        state["ui_review"] = {
            "findings": [],
            "review_clean": True,
            "a11y": {
                "violations": [
                    {
                        "rule": "image-alt",
                        "selector": "img.banner-icon",
                        "severity": "serious",
                    },
                ],
            },
        }
        record.recipe_notes.append(
            "ui_review with 1 serious a11y violation; gate will synthesise finding",
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
        polish.setdefault("applied", []).append(
            f"round {polish['rounds']}: added alt text to banner-icon image",
        )
        # Polish round 1 fixed the violation; the refreshed review is
        # clean (empty violations list, review_clean=True). The a11y
        # gate sees no actionable leftovers and advances.
        state["ui_review"] = {
            "findings": [],
            "review_clean": True,
            "a11y": {
                "violations": [],
            },
        }
        record.recipe_notes.append(
            f"polish round {polish['rounds']}: a11y violation fixed; review clean",
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


__all__ = ["META", "build_recipe"]
