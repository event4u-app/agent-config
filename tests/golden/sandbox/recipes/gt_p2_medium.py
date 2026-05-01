"""GT-P2 — prompt-driven medium band: assumptions confirmation halt.

The raw prompt ``Refactor power`` is concrete enough to act on but
under-specified on goal length and scope, so the deterministic gate
scores it ``medium`` and halts ``PARTIAL`` with the assumptions
report. Cycles:

1. refine-prompt halt        → recipe writes a small AC list +
   assumptions into ``state.input.data``.
2. medium PARTIAL halt       → engine surfaces the assumptions report
   (no agent directive). Recipe routes via ``_no_directive`` and flips
   ``confidence_confirmed=True`` on ``state.input.data`` to release
   the medium gate, mirroring the user picking option ``1``.
3. plan halt                 → recipe sets ``state.plan``.
4. apply-plan halt           → recipe rewrites the ``power`` docstring
   (no behaviour change) and records ``state.changes``.
5. run-tests halt            → recipe runs pytest. Existing
   ``test_power_positive_base`` stays green because the body is
   untouched.
6. review-changes halt       → recipe sets ``state.verify``.
7. report runs               → engine exits 0.

The capture locks the contract that medium-band halts (a) emit the
assumptions report exactly once and (b) release on
``confidence_confirmed=True`` without a re-score.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from . import _helpers as h

META = {
    "gt_id": "GT-P2",
    "prompt_relpath": "prompts/gt-p2-medium.txt",
    "persona": None,
    "cycle_cap": 8,
}

_OLD_DOCSTRING = (
    '    """Buggy stub — see ``recipes/gt-3-recovery.md`` for the fix."""'
)
_NEW_DOCSTRING = (
    '    """Return ``a`` raised to ``b``. Note: this stub uses ``abs(a)`` '
    'and is sign-incomplete for odd exponents (tracked by GT-3)."""'
)


def build_recipe(workspace: Path) -> dict[str, Any]:
    """Return the directive→step mapping with ``workspace`` bound in.

    ``_no_directive`` doubles as the medium-band release gate: the only
    no-directive halt this recipe encounters is the assumptions
    report, so flipping ``confidence_confirmed`` there is safe — any
    other no-directive halt would be a contract drift the capture must
    surface as a diff.
    """

    def on_refine_prompt(state: dict[str, Any], record) -> dict[str, Any]:
        h.write_prompt_refinement(
            state,
            reconstructed_ac=[
                "should preserve the public signature of power(a, b)",
                "must keep test_power_positive_base green after the edit",
            ],
            assumptions=[
                "touches src/calculator.py only",
                "no behaviour change intended; docstring tightening",
            ],
        )
        record.recipe_notes.append("refine-prompt rebound: 2 AC + 2 assumptions")
        return state

    def on_no_directive(state: dict[str, Any], record) -> dict[str, Any]:
        # Medium-band assumptions-report halt — release the gate.
        data = state.setdefault("input", {}).setdefault("data", {})
        data["confidence_confirmed"] = True
        record.recipe_notes.append(
            "medium gate released: confidence_confirmed=True",
        )
        return state

    def on_create_plan(state: dict[str, Any], record) -> dict[str, Any]:
        state["plan"] = h.standard_plan(
            "Tighten power() docstring",
            "Replace the placeholder docstring on src/calculator.py::power",
            "Re-run pytest to confirm test_power_positive_base stays green",
        )
        record.recipe_notes.append("plan recorded with 2 steps")
        return state

    def on_apply_plan(state: dict[str, Any], record) -> dict[str, Any]:
        h.replace_in_file(
            workspace, "src/calculator.py",
            _OLD_DOCSTRING, _NEW_DOCSTRING,
        )
        state["changes"] = h.base_changes("src/calculator.py")
        record.recipe_notes.append("rewrote power() docstring (no behaviour change)")
        return state

    def on_run_tests(state: dict[str, Any], record) -> dict[str, Any]:
        state["tests"] = h.run_pytest(workspace)
        record.recipe_notes.append(
            f"pytest verdict={state['tests']['verdict']}",
        )
        return state

    def on_review_changes(state: dict[str, Any], record) -> dict[str, Any]:
        state["verify"] = h.simulated_review_verdict()
        record.recipe_notes.append("review-changes simulated success")
        return state

    return {
        "refine-prompt": on_refine_prompt,
        "_no_directive": on_no_directive,
        "create-plan": on_create_plan,
        "apply-plan": on_apply_plan,
        "run-tests": on_run_tests,
        "review-changes": on_review_changes,
    }


__all__ = ["META", "build_recipe"]
