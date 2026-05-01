"""GT-U4 — polish-loop ceiling: engine refuses a third polish round.

The capture pins ``polish.POLISH_CEILING == 2``. The recipe walks the
full UI track up to the polish loop, then keeps the review envelope
*dirty* across both polish rounds. After round 2 the dispatcher emits
``_halt_ceiling`` (no agent-directive line, three numbered options:
ship as-is / abort / hand off). The recipe deliberately does not ship
the dirty findings as clean — leaving the ceiling halt re-emitted
idempotently until the cycle cap trips.

Cycle map (cap = 9):

1. ``existing-ui-audit``        — recipe writes a populated audit.
2. ``ui-design-brief``          — recipe writes a fully formed brief.
3. ``_no_directive`` (confirm)  — recipe sets ``design_confirmed=True``.
4. ``ui-apply-plain``           — recipe writes the apply envelope.
5. ``ui-design-review-plain``   — recipe writes ``findings`` + ``review_clean=False``.
6. ``ui-polish-plain`` (round 1) — recipe sets ``ui_polish.rounds=1``;
   ``ui_review`` stays dirty (the fix did not converge).
7. ``ui-polish-plain`` (round 2) — recipe sets ``ui_polish.rounds=2``;
   ``ui_review`` still dirty.
8. ``_no_directive`` (ceiling)  — recipe leaves state untouched
   (the dirty ``ui_review`` survives, ``rounds==2`` survives) so the
   engine re-emits the ceiling halt on the next cycle.
9. ``_no_directive`` (ceiling)  — same halt, idempotent. Cycle cap
   trips and the run ends with ``cycle_cap_reached``.

Iron-law contract this capture pins:

- The polish-ceiling check fires at exactly ``rounds == 2``; round 3
  is never started by the engine.
- The ceiling halt is idempotent — repeated entry produces the same
  halt body (Stack/Polish-ceiling/findings line, three options,
  recommendation block).
- ``_no_directive`` is reused for two distinct halts in this run
  (design confirmation at cycle 3, ceiling halt at cycles 8-9). The
  recipe differentiates by reading ``ui_polish.rounds`` so each halt
  gets the right state mutation.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

META = {
    "gt_id": "GT-U4",
    "prompt_relpath": "prompts/gt-u4-polish-ceiling.txt",
    "persona": None,
    "cycle_cap": 9,
}


def _dirty_review() -> dict[str, Any]:
    """Return a structurally well-formed but dirty review envelope.

    One generic finding (no ``token_violation`` kind so the polish
    step takes the standard delegate-to-skill path, not the token
    extraction branch) plus ``review_clean=False`` keeps the polish
    loop running across both rounds.
    """
    return {
        "findings": [
            {
                "kind": "spacing-mismatch",
                "component": "OnboardingWizard",
                "severity": "minor",
                "note": "step indicators use 8px gap; brief asks 12px",
            },
        ],
        "review_clean": False,
    }


def build_recipe(workspace: Path) -> dict[str, Any]:
    """Return the directive→step mapping with ``workspace`` bound in."""

    def on_existing_ui_audit(state: dict[str, Any], record) -> dict[str, Any]:
        state["ui_audit"] = {
            "components_found": [
                {
                    "path": "resources/views/components/wizards/step.blade.php",
                    "name": "wizards.step",
                    "kind": "wizard-step",
                    "similarity": 0.74,
                },
            ],
            "design_tokens": {"spacing": {"sm": "8px", "md": "12px", "lg": "16px"}},
            "audit_path": "high_confidence",
            "candidate_pick": "wizards.step",
        }
        record.recipe_notes.append("ui_audit populated for polish-ceiling run")
        return state

    def on_ui_design_brief(state: dict[str, Any], record) -> dict[str, Any]:
        state["ui_design"] = {
            "layout": "vertical wizard, max-w-2xl, 12px step gap",
            "components": [
                {"name": "OnboardingWizard", "primitives": ["wizards.step"]},
            ],
            "states": {
                "empty": "Wizard rendered with first step active",
                "loading": "Step transition shows inline spinner",
                "error": "Step-level validation errors inline",
                "success": "Final step replaced by completion card",
                "disabled": "Disabled steps show muted indicators",
            },
            "microcopy": {
                "title": "Welcome — let's set up your account",
                "buttons": {"next": "Continue", "back": "Back"},
                "completion": "All set — onboarding complete.",
            },
            "a11y": {
                "labels": "every step has aria-current=step when active",
                "focus": "first invalid field focused on validation error",
                "aria_live": "completion card announced via aria-live=polite",
            },
            "reused_from_audit": ["wizards.step"],
        }
        record.recipe_notes.append("ui_design brief written for wizard polish")
        return state

    def on_no_directive(state: dict[str, Any], record) -> dict[str, Any]:
        # Two halts share this key in this run: the design confirmation
        # at cycle 3 and the ceiling halt at cycles 8-9. Branch on the
        # polish round counter — ceiling halts only fire when
        # rounds == POLISH_CEILING, so the round count is the cleanest
        # discriminator that does not couple us to the question text.
        polish = state.get("ui_polish") or {}
        rounds = polish.get("rounds", 0)
        if isinstance(rounds, int) and not isinstance(rounds, bool) and rounds >= 2:
            record.recipe_notes.append(
                "ceiling halt observed; state left untouched for idempotent re-halt",
            )
            return state
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
            "summary": "Onboarding wizard rendered; spacing applied per brief",
            "rendered": {
                "resources/views/onboarding/wizard.blade.php":
                    "Welcome — let's set up your account. Continue / Back. "
                    "All set — onboarding complete.",
            },
            "files": ["resources/views/onboarding/wizard.blade.php"],
        }
        record.recipe_notes.append("ui_apply envelope written: 1 file")
        return state

    def on_ui_review_plain(state: dict[str, Any], record) -> dict[str, Any]:
        state["ui_review"] = _dirty_review()
        record.recipe_notes.append(
            "ui_review dirty: 1 finding, review_clean=False (round 0 baseline)",
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
            f"round {polish['rounds']}: tried tightening step gap; review still dirty",
        )
        # Refresh the review envelope so the next cycle sees a still-dirty
        # but structurally well-formed review, exactly the shape a real
        # polish skill would produce when the fix did not converge.
        state["ui_review"] = _dirty_review()
        record.recipe_notes.append(
            f"polish round {polish['rounds']}: review still dirty, no convergence",
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
