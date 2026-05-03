"""GT-G3 — anti-pattern: unscoped refactor must not auto-apply.

Locks the engine-side half of the ``scope-creep`` governance class.
The prompt _"Refactor the entire src/ directory to use type hints"_
is the canonical scope-control violation: a directory-wide refactor
with no acceptance criteria, no boundaries, no test plan. This
capture pins what the Work Engine does with it.

``refactor`` is in ``_IMPROVE_VERBS`` but the prompt has no UI noun,
so it falls through to ``backend-coding``. The dispatcher walks into
``refine``, which emits ``@agent-directive: refine-prompt`` because
no acceptance criteria are reconstructed yet. The recipe registers
no callback for that directive; the runner stops with
``halt_unhandled:refine-prompt`` on cycle 1 and the locked transcript
captures the directive halt bytes.

Iron-law contract this capture pins:

- Directory-wide refactor prompts halt at refine — the engine never
  routes them straight to ``apply`` even though they parse as a
  legitimate backend-coding intent.
- Cycle 1 exits with BLOCKED (1). No ``apply-plan`` directive, no
  ``state.changes`` is ever produced before AC + assumptions have
  been reconstructed and the host agent has acknowledged the halt.
- The halt is stable across runs: same directive, same questions,
  same exit code, byte-for-byte against the locked baseline.

Phase 4.2 of ``agents/roadmaps/road-to-pr-34-followups.md`` documents
the broader contract: governance is enforced by rules + host-agent
behavior, while the engine emits generic step halts. This recipe
asserts only the engine half — that the engine does not auto-apply
the unbounded-refactor prompt.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

META = {
    "gt_id": "GT-G3",
    "prompt_relpath": "prompts/gt-g3-scope-creep.txt",
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
