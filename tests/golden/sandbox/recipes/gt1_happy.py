"""GT-1 — happy path: add ``multiply`` to the toy calculator.

Five cycles total:

1. plan halt              → recipe sets ``state.plan``
2. apply-plan halt        → recipe writes source + test, sets ``state.changes``
3. run-tests halt         → recipe runs pytest, sets ``state.tests`` (success)
4. review-changes halt    → recipe sets ``state.verify`` (success)
5. report runs            → engine exits 0 with the delivery report
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from . import _helpers as h

META = {
    "gt_id": "GT-1",
    "ticket_relpath": "tickets/gt-1-happy.json",
    "persona": None,
    "cycle_cap": 6,
}

_MULTIPLY_SRC = '''

def multiply(a: int, b: int) -> int:
    return a * b
'''

_MULTIPLY_TEST = '''

def test_multiply_returns_product() -> None:
    from src.calculator import multiply
    assert multiply(3, 4) == 12
    assert multiply(0, 5) == 0
    assert multiply(-2, 3) == -6
'''


def build_recipe(workspace: Path) -> dict[str, Any]:
    """Return the directive→step mapping with ``workspace`` bound in."""

    def on_create_plan(state: dict[str, Any], record) -> dict[str, Any]:
        state["plan"] = h.standard_plan(
            "Add multiply(a, b)",
            "Append multiply(a: int, b: int) -> int to src/calculator.py",
            "Append test_multiply_returns_product to tests/test_calculator.py",
            "Run pytest to confirm the new test passes",
        )
        record.recipe_notes.append("plan recorded with 3 steps")
        return state

    def on_apply_plan(state: dict[str, Any], record) -> dict[str, Any]:
        h.append_to_file(workspace, "src/calculator.py", _MULTIPLY_SRC)
        h.append_to_file(workspace, "tests/test_calculator.py", _MULTIPLY_TEST)
        state["changes"] = h.base_changes(
            "src/calculator.py",
            "tests/test_calculator.py",
        )
        record.recipe_notes.append("appended multiply + test_multiply_returns_product")
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
        "create-plan": on_create_plan,
        "apply-plan": on_apply_plan,
        "run-tests": on_run_tests,
        "review-changes": on_review_changes,
    }


__all__ = ["META", "build_recipe"]
