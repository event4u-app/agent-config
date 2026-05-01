"""GT-P3 — prompt-driven low band: one targeted clarifying question.

The raw prompt ``should we drop the table?`` is too thin for the
deterministic gate to plan against — the scorer lands it firmly in
the low band (score 0.1, weakest dimension ``goal_clarity``).
Cycles:

1. refine-prompt halt        → recipe writes a thin AC list (and no
   assumptions) back into ``state.input.data`` to mirror what the
   ``refine-prompt`` skill would produce against an under-specified
   prompt.
2. low BLOCKED halt          → engine emits the iron-law one-question
   halt. The recipe deliberately does NOT register a ``_no_directive``
   step so the runner stops here with ``halt_unhandled:_no_directive``
   — exactly the same pattern GT-2 uses to lock the refine-ambiguity
   surface for tickets.

The capture locks two contracts at once:

- Low-band halts emit **exactly one** ``?`` and **exactly one**
  numbered options block (enforced upstream by
  ``test_refine_prompt_dispatch.TestLowBandSingleQuestion``; the
  Golden locks the surface bytes).
- The clarifying question targets the weakest dimension; for this
  prompt that is ``goal_clarity`` and the question is
  "What is the single observable outcome you want?".
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from . import _helpers as h

META = {
    "gt_id": "GT-P3",
    "prompt_relpath": "prompts/gt-p3-low.txt",
    "persona": None,
    "cycle_cap": 3,
}


def build_recipe(workspace: Path) -> dict[str, Any]:
    """Resolve the refine-prompt rebound; let the low-band halt stop the run."""

    def on_refine_prompt(state: dict[str, Any], record) -> dict[str, Any]:
        h.write_prompt_refinement(
            state,
            reconstructed_ac=[
                "needs a clarifying answer about which table is meant",
            ],
            assumptions=[],
        )
        record.recipe_notes.append(
            "refine-prompt rebound: 1 AC + 0 assumptions (deliberately thin)",
        )
        return state

    return {
        "refine-prompt": on_refine_prompt,
    }


__all__ = ["META", "build_recipe"]
