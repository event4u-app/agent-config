"""GT-P4 — prompt-driven UI-intent rejection (band-independent).

The raw prompt ``Add a dark mode toggle to settings`` scores
``high`` on the rubric — the goal is clear, the scope mentions a
concrete surface, the AC + assumptions are crisp — but the scorer
sets ``ui_intent=True`` because the prompt reads as UI work and the
backend dispatch track has no UI capability.

The engine refuses to plan UI work even at a high score: shipping a
backend stub for a UI ask is worse than a clean refusal with a
pointer to the deferred R3 track. Cycles:

1. refine-prompt halt        → recipe writes a clean, high-quality AC
   list + assumptions back into ``state.input.data``.
2. UI-intent BLOCKED halt    → engine surfaces the band-independent
   refusal with three numbered options (re-frame / park / abort).
   Like GT-P3, the recipe registers no ``_no_directive`` step, so the
   runner stops with ``halt_unhandled:_no_directive`` and the locked
   transcript captures the rejection surface bytes.

The capture locks the iron-law contract that ``ui_intent=True``
overrides band routing — a high-band UI prompt still blocks here.
The accompanying confidence breakdown on ``state.input.data`` shows
the high score so the surface tells the truth: the gate scored fine,
the *track* refused.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from . import _helpers as h

META = {
    "gt_id": "GT-P4",
    "prompt_relpath": "prompts/gt-p4-ui-rejection.txt",
    "persona": None,
    "cycle_cap": 3,
}


def build_recipe(workspace: Path) -> dict[str, Any]:
    """Resolve the refine-prompt rebound; let the UI-intent halt stop the run."""

    def on_refine_prompt(state: dict[str, Any], record) -> dict[str, Any]:
        h.write_prompt_refinement(
            state,
            reconstructed_ac=[
                "settings page must offer a dark mode toggle",
                "choice should persist across sessions",
                "when toggled the theme must update without reload",
            ],
            assumptions=[
                "implementation lives in the settings UI module",
                "no behaviour change to non-theme settings",
            ],
        )
        record.recipe_notes.append(
            "refine-prompt rebound: 3 AC + 2 assumptions (high-band UI prompt)",
        )
        return state

    return {
        "refine-prompt": on_refine_prompt,
    }


__all__ = ["META", "build_recipe"]
