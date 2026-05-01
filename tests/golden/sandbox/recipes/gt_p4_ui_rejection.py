"""GT-P4 — UI prompt halts at the existing-UI-audit gate.

The raw prompt ``Add a dark mode toggle to settings`` reads as UI
work. R3 Phase 1's intent classifier sets ``state.directive_set =
"ui"`` while loading; the dispatcher's kind gate accepts the prompt
(the ``ui`` set declares ``SUPPORTED_KINDS=("ticket", "prompt",
"diff", "file")``) and walks into ``ui.refine`` — which Phase 2 of
``agents/roadmaps/road-to-product-ui-track.md`` promoted from a
deferral stub to the real audit gate.

With ``state.ui_audit`` unset on the first pass, the audit handler
emits ``@agent-directive: existing-ui-audit`` and halts cleanly so
the orchestrator can run the matching skill. The recipe registers no
callback for that directive; the runner stops with
``halt_unhandled:existing-ui-audit`` on cycle 1 and the locked
transcript captures the directive halt bytes.

Iron-law contract this capture pins:

- UI-shaped prompts route to ``directive_set="ui"`` even when the
  prompt would score ``high`` on the rubric (the *track* gates the
  work, not the score).
- The audit gate is the **mandatory** first step of the UI directive
  set. Skipping it is impossible — ``ui.refine`` IS the gate.
- The first-pass halt is a clean BLOCKED exit (1) that surfaces the
  ``existing-ui-audit`` directive. The kind gate must accept
  ``prompt`` for ``ui`` so the audit decision surfaces in the halt
  body.
- No rebound, no second cycle: until the orchestrator-side skill is
  wired into the recipe (a later GT-U batch), the directive halt is
  the terminal output.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

META = {
    "gt_id": "GT-P4",
    "prompt_relpath": "prompts/gt-p4-ui-rejection.txt",
    "persona": None,
    "cycle_cap": 1,
}


def build_recipe(workspace: Path) -> dict[str, Any]:
    """Return an empty recipe — no callback fires.

    The audit-gate halt emits ``existing-ui-audit`` as its directive,
    but no callback is registered for it here; the runner keys on
    ``"existing-ui-audit"``, finds no entry, and stops at the end of
    cycle 1. The empty mapping is the entire recipe — Phase 6's
    GT-U batch will introduce recipes that *do* satisfy the
    directive end to end.
    """
    return {}


__all__ = ["META", "build_recipe"]
