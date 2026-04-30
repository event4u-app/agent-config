"""GT-P4 — prompt classified as UI work, refused at the routing gate.

The raw prompt ``Add a dark mode toggle to settings`` reads as UI
work. R3 Phase 1's intent classifier sets ``state.directive_set =
"ui"`` while loading; the dispatcher's kind gate accepts the prompt
(the ``ui`` set declares ``SUPPORTED_KINDS=("ticket", "prompt",
"diff", "file")``) and walks into ``ui.refine``.

The Phase 1 stub of the ``ui`` directive set is a routing-only
shell: ``audit`` / ``design`` / ``apply`` / ``review`` / ``polish``
land in later phases of ``agents/roadmaps/road-to-product-ui-track.md``.
Until they ship, ``ui.refine`` halts with a clean ``BLOCKED``
outcome carrying three numbered options (re-frame as backend, park,
abort). No agent directive is emitted, so the recipe registers no
callbacks; the runner stops with ``halt_unhandled:_no_directive``
on cycle 1 and the locked transcript captures the rejection-surface
bytes.

Iron-law contract this capture pins:

- UI-shaped prompts route to ``directive_set="ui"`` even when the
  prompt would score ``high`` on the rubric (the *track* refused,
  not the score).
- The refusal is a clean halt (exit 1), not a config-error exit
  (exit 2). The kind gate must accept ``prompt`` for ``ui`` so the
  routing decision surfaces in the halt body.
- No rebound, no second cycle: the deferred-track refusal is the
  terminal output until R3 Phase 2/3 wire real handlers.
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

    The UI-rejection halt has no agent directive; the runner keys
    on ``"_no_directive"``, finds no entry, and stops at the end of
    cycle 1. The empty mapping is the entire recipe.
    """
    return {}


__all__ = ["META", "build_recipe"]
