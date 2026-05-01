"""GT-U10 — greenfield audit halt → user picks ``bare``.

Sibling of GT-U9. Same engine path through the audit gate, but the
recipe simulates the user picking option 2 (``bare``) instead of
option 1 (``scaffold``). The audit step records
``greenfield_decision = "bare"`` and ``audit_path = "greenfield"``;
the dispatcher advances through design → apply → review → report
on the happy path.

Cycle map (cap = 8):

1. ``existing-ui-audit``        — recipe writes ``greenfield=True`` audit
                                  with no decision yet.
2. ``_no_directive`` (greenfield) — recipe writes
                                  ``greenfield_decision = "bare"``
                                  (mirrors user picking option 2).
3. ``ui-design-brief``          — recipe writes a minimal brief.
4. ``_no_directive`` (confirm)  — recipe sets ``design_confirmed=True``.
5. ``ui-apply-plain``           — recipe writes the apply envelope.
6. ``ui-design-review-plain``   — recipe writes a clean review.
7. ``report`` runs              — engine exits 0 with delivery report.

Iron-law contract this capture pins:

- ``greenfield_decision`` accepts ``"bare"`` as a valid pick; the
  audit step does not gate on the specific value, only on presence.
- The delivery report carries the ``greenfield`` audit_path and the
  recorded ``bare`` decision verbatim so downstream consumers can
  flag the run as "scaffolded with Tailwind defaults".
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

META = {
    "gt_id": "GT-U10",
    "prompt_relpath": "prompts/gt-u10-greenfield-bare.txt",
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
        # at cycle 2 and the design-confirmation halt at cycle 4.
        # Branch on audit shape so each halt gets the right mutation.
        audit = state.get("ui_audit")
        if (
            isinstance(audit, dict)
            and audit.get("greenfield") is True
            and not audit.get("greenfield_decision")
        ):
            audit["greenfield_decision"] = "bare"
            record.recipe_notes.append(
                "greenfield_decision=bare (user picked option 2)",
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
            "layout": "single-column demo page, max-w-3xl, header + body",
            "components": [
                {"name": "DemoPage", "primitives": ["heading", "paragraph"]},
            ],
            "states": {
                "empty": "Initial render with heading and body copy",
                "loading": "n/a — static page",
                "error": "n/a — static page",
                "success": "n/a — static page",
                "disabled": "n/a — static page",
            },
            "microcopy": {
                "title": "Internal showcase demo",
                "body": "Throwaway page for next week's review.",
            },
            "a11y": {
                "labels": "h1 carries the page title",
                "focus": "default browser focus order",
                "aria_live": "n/a",
            },
            "reused_from_audit": [],
        }
        record.recipe_notes.append("ui_design brief written for bare demo page")
        return state

    def on_ui_apply_plain(state: dict[str, Any], record) -> dict[str, Any]:
        data = state.setdefault("input", {}).setdefault("data", {})
        data["ui_apply"] = {
            "summary": "Bare demo page scaffolded with Tailwind defaults",
            "rendered": {
                "resources/views/demo/showcase.blade.php":
                    "Internal showcase demo. Throwaway page for next "
                    "week's review.",
            },
            "files": ["resources/views/demo/showcase.blade.php"],
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
