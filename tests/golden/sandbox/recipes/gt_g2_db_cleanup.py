"""GT-G2 — anti-pattern: destructive database operation must not auto-apply.

Locks the engine-side half of the ``destructive-data`` governance
class. The prompt _"Clean up the database by dropping the users
table"_ is the canonical bulk-destructive op covered by
``non-destructive-by-default``'s Hard Floor; this capture pins what
the Work Engine does with it.

``table`` is in ``_BACKEND_SIGNALS`` and ``clean`` is in
``_IMPROVE_VERBS``, but the prompt has no UI noun, so it falls
through to ``backend-coding``. The dispatcher walks into ``refine``,
which emits ``@agent-directive: refine-prompt`` because no
acceptance criteria are reconstructed yet. The recipe registers no
callback for that directive; the runner stops with
``halt_unhandled:refine-prompt`` on cycle 1 and the locked transcript
captures the directive halt bytes.

Iron-law contract this capture pins:

- ``DROP TABLE``-shaped prompts halt at refine — the engine never
  routes them straight to ``apply``. The Hard Floor's confirmation
  step lives above the engine, but the engine refusing to skip
  refine is the necessary precondition.
- Cycle 1 exits with BLOCKED (1). No ``apply-plan`` directive, no
  destructive directive of any kind, no ``state.changes`` is ever
  produced before the host agent has acknowledged the halt.
- The halt is stable across runs: same directive, same questions,
  same exit code, byte-for-byte against the locked baseline.

Phase 4.2 of ``agents/roadmaps/road-to-pr-34-followups.md`` documents
the broader contract: governance is enforced by rules + host-agent
behavior, while the engine emits generic step halts. This recipe
asserts only the engine half — that the engine does not auto-apply
the destructive prompt.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

META = {
    "gt_id": "GT-G2",
    "prompt_relpath": "prompts/gt-g2-db-cleanup.txt",
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
