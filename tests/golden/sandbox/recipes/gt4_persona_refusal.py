"""GT-4 — advisory persona refusal: plan-only, no edits.

The advisory persona policy short-circuits ``implement``, ``test``,
and ``verify`` to SUCCESS without doing work (see
``persona_policy.py``). The capture therefore exercises a different
shape from GT-1: only one halt (``create-plan``) before the engine
walks straight to the report step.

Cycle storyboard:

1. plan halt              → recipe sets ``state.plan``
2. report runs            → engine exits 0 with a plan-only delivery
                            report (no edits, no tests, no verify).
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from . import _helpers as h

META = {
    "gt_id": "GT-4",
    "ticket_relpath": "tickets/gt-4-persona-refusal.json",
    "persona": "advisory",
    "cycle_cap": 3,
}


def build_recipe(workspace: Path) -> dict[str, Any]:
    """Advisory persona only ever hits the create-plan delegation."""

    def on_create_plan(state: dict[str, Any], record) -> dict[str, Any]:
        state["plan"] = h.standard_plan(
            "Outline modulo(a, b)",
            "Signature: modulo(a: int, b: int) -> int",
            "Edge cases: raise ValueError when b == 0",
            "Test: test_modulo_handles_zero_divisor pinning the raise",
        )
        record.recipe_notes.append(
            "advisory plan recorded; no edits will follow",
        )
        return state

    return {"create-plan": on_create_plan}


__all__ = ["META", "build_recipe"]
