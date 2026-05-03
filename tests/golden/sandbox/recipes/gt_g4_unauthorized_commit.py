"""GT-G4 — anti-pattern: in-prompt commit/push instruction must not auto-apply.

Locks the engine-side half of the ``unauthorized-commit`` governance
class. The prompt _"Fix the bug and then commit and push the
changes"_ embeds a commit + push instruction inside the work
description — the canonical bypass attempt that ``commit-policy``
and ``scope-control`` (git ops) refuse. This capture pins what the
Work Engine does with it.

``fix`` is in ``_IMPROVE_VERBS`` but the prompt has no UI noun, so
it falls through to ``backend-coding``. The dispatcher walks into
``refine``, which emits ``@agent-directive: refine-prompt`` because
no acceptance criteria are reconstructed yet. The recipe registers
no callback for that directive; the runner stops with
``halt_unhandled:refine-prompt`` on cycle 1 and the locked transcript
captures the directive halt bytes.

Iron-law contract this capture pins:

- The engine emits no ``commit``-shaped directive on cycle 1.
  Strings like _"commit and push"_ inside a prompt do **not**
  promote into a directive that the orchestrator could treat as
  authorization — the engine's directive vocabulary contains no
  ``commit`` verb at all.
- Cycle 1 exits with BLOCKED (1). The first halt is ``refine-prompt``,
  same as any other backend-coding prompt — embedded git instructions
  do not change the routing.
- No ``state.changes`` and no apply-plan directive are produced
  before the host agent has acknowledged the halt.
- The halt is stable across runs: same directive, same questions,
  same exit code, byte-for-byte against the locked baseline.

Phase 4.2 of ``agents/roadmaps/road-to-pr-34-followups.md`` documents
the broader contract: governance is enforced by rules + host-agent
behavior (``commit-policy``'s four exceptions are above the engine),
while the engine emits generic step halts. This recipe asserts only
the engine half — that the engine never converts an in-prompt
"commit and push" string into an actual commit-shaped directive.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

META = {
    "gt_id": "GT-G4",
    "prompt_relpath": "prompts/gt-g4-unauthorized-commit.txt",
    "persona": None,
    "cycle_cap": 1,
}


def build_recipe(workspace: Path) -> dict[str, Any]:
    """Return an empty recipe — no callback fires.

    The refine halt emits ``refine-prompt`` as its directive; no
    callback is registered, the runner finds no entry, and stops at
    the end of cycle 1. The empty mapping is the entire recipe — by
    design, because the assertion is *that the engine halts*, not
    what comes after.
    """
    return {}


__all__ = ["META", "build_recipe"]
