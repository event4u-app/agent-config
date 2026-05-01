"""GT-U8 — ui-trivial reclassification: violations promote to ``ui``.

Pins the contract for the audit-bypass safety floor: when the agent's
``trivial-apply`` envelope violates any precondition (``> 1 file``,
``> 5 lines``, new component / state / dependency),
``ui_trivial.apply._halt_reclassify`` BLOCKS with
``@agent-directive: reclassify-to-ui-improve``. The orchestrator
promotes ``state.directive_set`` from ``"ui-trivial"`` to ``"ui"`` and
clears the ``state.outcomes`` slate so the full audit / design / apply
/ review / polish track runs from scratch on the rebound. No edit ever
lands without the audit gate.

Halt budget — locked by this golden:

- **6 halts total** —
  1. ``trivial-apply`` (cycle 1) — recipe writes a violating envelope
     (2 files, 7 lines changed; both ceilings exceeded).
  2. ``reclassify-to-ui-improve`` (cycle 2) — recipe promotes
     ``directive_set='ui'``, ``intent='ui-improve'``, clears outcomes.
  3. ``existing-ui-audit`` (cycle 3) — recipe writes a high-confidence
     audit (one matched component, ``audit_path='high_confidence'``).
  4. ``ui-design-brief`` (cycle 4) — recipe writes the brief with
     ``design_confirmed=True`` so the sign-off halt is skipped.
  5. ``ui-apply-plain`` (cycle 5) — recipe writes the apply envelope.
  6. ``ui-design-review-plain`` (cycle 6) — recipe writes a clean
     review (``review_clean=True``); polish short-circuits.
- Cycle 7 — ``report`` runs, engine exits 0.

The capture pins three things at once: ``ui-trivial`` enforces its
preconditions, the reclassification directive wires through the
orchestrator's outcome reset, and the promoted ``ui`` track resumes
from refine / audit (not from where ``ui-trivial`` left off).
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from ._helpers import trivial_envelope

META = {
    "gt_id": "GT-U8",
    "prompt_relpath": "prompts/gt-u8-trivial-reclassification.txt",
    "persona": None,
    "cycle_cap": 8,
}


def seed_state(workspace: Path) -> dict[str, Any]:
    """Pre-populate the state file so cycle 1 starts inside ``ui-trivial``.

    Mirrors GT-U7's seed — the prompt looks trivial on the surface
    (single-file copy / token tweak), the violation is only revealed
    when the agent's edit envelope arrives. ``intent='ui-trivial'`` is
    pinned in both ``input.data`` (read by ``ui_trivial.refine``) and
    at top level (round-tripped by ``populate_routing``).
    """
    return {
        "version": 1,
        "input": {
            "kind": "prompt",
            "data": {
                "raw": (
                    "Tweak the marketing hero copy and align the CTA "
                    "button color to the new brand-red token.\n"
                ),
                "reconstructed_ac": [
                    "Hero headline reads 'Welcome to the next chapter'",
                    "CTA button uses brand-red token",
                ],
                "assumptions": [
                    "brand-red token already exists",
                    "edit fits the trivial path",
                ],
                "confidence": {"band": "high", "score": 0.9},
                "intent": "ui-trivial",
            },
        },
        "intent": "ui-trivial",
        "directive_set": "ui-trivial",
        "stack": None,
        "ui_audit": None,
        "ui_design": None,
        "ui_review": None,
        "ui_polish": None,
        "contract": None,
        "stitch": None,
        "persona": None,
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

    def on_trivial_apply(state: dict[str, Any], record) -> dict[str, Any]:
        data = state.setdefault("input", {}).setdefault("data", {})
        data["trivial_edit"] = trivial_envelope(
            files=[
                "resources/views/marketing/hero.blade.php",
                "resources/views/components/button.blade.php",
            ],
            lines_changed=7,
            summary="hero copy + CTA button color (touches 2 files / 7 lines)",
        )
        record.recipe_notes.append(
            "violating trivial_edit written: 2 files (>1), 7 lines (>5)",
        )
        return state

    def on_reclassify(state: dict[str, Any], record) -> dict[str, Any]:
        state["directive_set"] = "ui"
        state["intent"] = "ui-improve"
        data = state.setdefault("input", {}).setdefault("data", {})
        data["intent"] = "ui-improve"
        data.pop("trivial_edit", None)
        data.pop("__reclassify_to__", None)
        state["outcomes"] = {}
        record.recipe_notes.append(
            "promoted directive_set=ui, intent=ui-improve, "
            "outcomes cleared so audit gate runs from scratch",
        )
        return state

    def on_existing_ui_audit(state: dict[str, Any], record) -> dict[str, Any]:
        state["ui_audit"] = {
            "components_found": [
                {
                    "path": "resources/views/components/button.blade.php",
                    "name": "button",
                    "kind": "ui-primitive",
                    "similarity": 0.82,
                },
            ],
            "design_tokens": {
                "spacing": ["sm", "md", "lg"],
                "color": ["primary", "muted", "danger", "brand-red"],
            },
            "audit_path": "high_confidence",
            "candidate_pick": "button",
        }
        record.recipe_notes.append(
            "ui_audit populated: 1 component, audit_path=high_confidence",
        )
        return state

    def on_ui_design_brief(state: dict[str, Any], record) -> dict[str, Any]:
        state["ui_design"] = {
            "layout": "marketing hero band, full-width, single CTA",
            "components": [
                {"name": "Hero", "primitives": ["button"]},
            ],
            "states": {
                "empty": "Headline + subhead + CTA rendered",
                "loading": "n/a — static surface",
                "error": "n/a — static surface",
                "success": "n/a — static surface",
                "disabled": "n/a — static surface",
            },
            "microcopy": {
                "title": "Welcome to the next chapter",
                "buttons": {"submit": "Get started"},
            },
            "a11y": {
                "labels": "CTA carries accessible name 'Get started'",
                "focus": "CTA receives focus on tab order entry",
                "aria_live": "n/a — static surface",
            },
            "reused_from_audit": ["button"],
            "design_confirmed": True,
        }
        record.recipe_notes.append(
            "ui_design brief written with design_confirmed=True "
            "(sign-off halt skipped)",
        )
        return state

    def on_ui_apply_plain(state: dict[str, Any], record) -> dict[str, Any]:
        data = state.setdefault("input", {}).setdefault("data", {})
        data["ui_apply"] = {
            "summary": (
                "Hero headline updated and CTA button retokenised to brand-red"
            ),
            "rendered": {
                "resources/views/marketing/hero.blade.php": (
                    "Welcome to the next chapter — Get started."
                ),
                "resources/views/components/button.blade.php": (
                    "<button class=\"bg-brand-red\">Get started</button>"
                ),
            },
            "files": [
                "resources/views/marketing/hero.blade.php",
                "resources/views/components/button.blade.php",
            ],
        }
        record.recipe_notes.append(
            "ui_apply envelope written: 2 files via the audit-gated path",
        )
        return state

    def on_ui_review_plain(state: dict[str, Any], record) -> dict[str, Any]:
        state["ui_review"] = {
            "findings": [],
            "review_clean": True,
        }
        record.recipe_notes.append(
            "ui_review clean: 0 findings, review_clean=True",
        )
        return state

    return {
        "trivial-apply": on_trivial_apply,
        "reclassify-to-ui-improve": on_reclassify,
        "existing-ui-audit": on_existing_ui_audit,
        "ui-design-brief": on_ui_design_brief,
        "ui-apply-plain": on_ui_apply_plain,
        "ui-design-review-plain": on_ui_review_plain,
    }


__all__ = ["META", "build_recipe", "seed_state"]
