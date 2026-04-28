"""GT-P1 — prompt-driven happy path: high confidence, silent proceed.

Six cycles total — the prompt-mode equivalent of GT-1:

1. refine-prompt halt        → recipe writes ``reconstructed_ac`` +
   ``assumptions`` back into ``state.input.data`` (the rebound the
   ``refine-prompt`` skill would normally produce).
2. plan halt                 → recipe sets ``state.plan``.
3. apply-plan halt           → recipe writes ``modulo`` + a passing
   test, sets ``state.changes``.
4. run-tests halt            → recipe runs pytest, sets ``state.tests``.
5. review-changes halt       → recipe sets ``state.verify``.
6. report runs               → engine exits 0 with the delivery report
   (``confidence`` block included since the band was scored ``high``).

The capture locks the silent-proceed contract: a high-band prompt must
neither halt for assumptions confirmation nor surface a clarifying
question — the only refine-time interaction is the agent directive
that drives the reconstruction.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from . import _helpers as h

META = {
    "gt_id": "GT-P1",
    "prompt_relpath": "prompts/gt-p1-high.txt",
    "persona": None,
    "cycle_cap": 7,
}

_MODULO_SRC = '''

def modulo(a: int, b: int) -> int:
    return a % b
'''

_MODULO_TEST = '''

def test_modulo_returns_remainder() -> None:
    from src.calculator import modulo
    assert modulo(7, 3) == 1
    assert modulo(10, 4) == 2
    assert modulo(-2, 3) == 1
'''


def build_recipe(workspace: Path) -> dict[str, Any]:
    """Return the directive→step mapping with ``workspace`` bound in."""

    def on_refine_prompt(state: dict[str, Any], record) -> dict[str, Any]:
        h.write_prompt_refinement(
            state,
            reconstructed_ac=[
                "modulo(a, b) should return the integer remainder a % b",
                "when called with modulo(7, 3) it must return 1",
                "when called with modulo(-2, 3) it must return 1 (Python semantics)",
            ],
            assumptions=[
                "function lives in src/calculator.py next to add/subtract/power",
                "no behaviour change to existing functions",
            ],
        )
        record.recipe_notes.append("refine-prompt rebound: 3 AC + 2 assumptions")
        return state

    def on_create_plan(state: dict[str, Any], record) -> dict[str, Any]:
        state["plan"] = h.standard_plan(
            "Add modulo(a, b)",
            "Append modulo(a: int, b: int) -> int to src/calculator.py",
            "Append test_modulo_returns_remainder to tests/test_calculator.py",
            "Run pytest to confirm the new test passes",
        )
        record.recipe_notes.append("plan recorded with 3 steps")
        return state

    def on_apply_plan(state: dict[str, Any], record) -> dict[str, Any]:
        h.append_to_file(workspace, "src/calculator.py", _MODULO_SRC)
        h.append_to_file(workspace, "tests/test_calculator.py", _MODULO_TEST)
        state["changes"] = h.base_changes(
            "src/calculator.py",
            "tests/test_calculator.py",
        )
        record.recipe_notes.append("appended modulo + test_modulo_returns_remainder")
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
        "create-plan": on_create_plan,
        "apply-plan": on_apply_plan,
        "run-tests": on_run_tests,
        "review-changes": on_review_changes,
    }


__all__ = ["META", "build_recipe"]
