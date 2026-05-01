"""GT-U7 — ui-trivial happy path: exactly 2 halts.

Pins the contract for the audit-bypass micro-edit path: when intent
classification lands ``ui-trivial`` and the edit honours the hard
preconditions (≤ 1 file, ≤ 5 lines, no new component / state /
dependency), the engine runs ``refine → implement → test → report``
with no audit, no design brief, no review, no polish.

Halt budget — locked by this golden:

- **2 halts total** —
  1. ``trivial-apply`` on cycle 1 (apply step delegates the edit).
  2. ``run-tests scope=smoke`` on cycle 2 (test step delegates the
     smoke run).
- No ``existing-ui-audit`` halt (audit step is wired to ``_skipped``).
- No ``ui-design-brief`` halt (design step is wired to ``_skipped``).
- No ``ui-design-review`` / polish halt (both wired to ``_skipped``).
- No ``review-changes`` halt (verify step is wired to ``_skipped``).

Cycle map (cap = 4):

1. ``trivial-apply``           — refine SUCCESS (intent=ui-trivial),
                                 memory / analyze / plan skipped,
                                 implement halts because
                                 ``state.ticket['trivial_edit']`` is
                                 unset. Recipe writes a 3-line edit
                                 envelope into ``input.data``.
2. ``run-tests scope=smoke``   — implement re-runs with the envelope,
                                 records the change, returns SUCCESS;
                                 test halts because ``state.tests`` is
                                 empty. Recipe writes a ``success``
                                 smoke verdict.
3. ``report`` runs             — test re-runs, verdict ``success``
                                 returns SUCCESS; verify skipped;
                                 report renders the one-line trivial
                                 summary; engine exits 0.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from ._helpers import simulated_smoke_verdict, trivial_envelope

META = {
    "gt_id": "GT-U7",
    "prompt_relpath": "prompts/gt-u7-trivial-happy.txt",
    "persona": None,
    "cycle_cap": 4,
}


def seed_state(workspace: Path) -> dict[str, Any]:
    """Pre-populate the state file so cycle 1 starts inside ``ui-trivial``.

    Carries the v1 envelope (``version`` / ``input`` / ``intent`` /
    ``directive_set``) with ``directive_set='ui-trivial'`` pinned so the
    engine bypasses the prose classifier and routes straight into the
    trivial directive set. ``input.data`` is the canonical prompt
    envelope (``raw`` / ``reconstructed_ac`` / ``assumptions``) plus an
    explicit ``intent`` field so ``ui_trivial.refine`` records SUCCESS
    on the first cycle.
    """
    return {
        "version": 1,
        "input": {
            "kind": "prompt",
            "data": {
                "raw": (
                    "Change the primary button color from blue to "
                    "brand-red in `resources/views/components/"
                    "button.blade.php`.\n"
                ),
                "reconstructed_ac": [
                    "Primary button uses brand-red token instead of blue",
                    "Edit limited to the existing button component",
                ],
                "assumptions": [
                    "brand-red token already exists in the design system",
                ],
                "confidence": {
                    "band": "high",
                    "score": 0.95,
                },
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
            files=["resources/views/components/button.blade.php"],
            lines_changed=3,
            summary="primary button color blue → brand-red",
        )
        record.recipe_notes.append(
            "trivial_edit envelope written into input.data "
            "(1 file, 3 lines, no new component/state/dependency)",
        )
        return state

    def on_run_tests(state: dict[str, Any], record) -> dict[str, Any]:
        state["tests"] = simulated_smoke_verdict()
        record.recipe_notes.append(
            "smoke verdict recorded: success at scope=smoke",
        )
        return state

    return {
        "trivial-apply": on_trivial_apply,
        "run-tests": on_run_tests,
    }


__all__ = ["META", "build_recipe", "seed_state"]
