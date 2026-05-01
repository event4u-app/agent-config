"""GT-3 — test-failure recovery: fix the buggy ``power`` stub.

Cycle storyboard:

1. plan halt                  → recipe sets ``state.plan``
2. apply-plan halt            → recipe applies a *first* fix that
   handles negative-base + odd exponent, but trips on even exponents.
   ``state.changes`` is recorded.
3. run-tests halt             → recipe runs pytest. The new test
   asserts both odd and even exponents → failed verdict captured.
4. bad-verdict halt           → recipe applies the *real* fix, re-runs
   pytest (success), updates ``state.tests``.
5. review-changes halt        → recipe sets ``state.verify``.
6. report runs                → engine exits 0.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from . import _helpers as h

META = {
    "gt_id": "GT-3",
    "ticket_relpath": "tickets/gt-3-recovery.json",
    "persona": None,
    "cycle_cap": 8,
}

_BUGGY_STUB = "    return abs(a) ** b"

_FIRST_ATTEMPT = (
    "    if a < 0:\n"
    "        return -(abs(a) ** b)\n"
    "    return a ** b"
)

_REAL_FIX = (
    "    if a < 0 and b % 2 == 1:\n"
    "        return -(abs(a) ** b)\n"
    "    return abs(a) ** b"
)

_NEGATIVE_TEST = '''

def test_power_negative_base() -> None:
    from src.calculator import power
    assert power(-2, 3) == -8
    assert power(-2, 4) == 16
'''


def build_recipe(workspace: Path) -> dict[str, Any]:
    """Track the bad-verdict halt by counting how often it fires."""

    state_box = {"bad_verdict_seen": 0}

    def on_create_plan(state: dict[str, Any], record) -> dict[str, Any]:
        state["plan"] = h.standard_plan(
            "Fix power() for negative bases",
            "Replace the abs(a)**b stub with sign-aware logic",
            "Add test_power_negative_base covering odd + even exponents",
            "Re-run pytest to confirm both assertions pass",
        )
        record.recipe_notes.append("plan recorded")
        return state

    def on_apply_plan(state: dict[str, Any], record) -> dict[str, Any]:
        h.replace_in_file(
            workspace, "src/calculator.py",
            _BUGGY_STUB, _FIRST_ATTEMPT,
        )
        h.append_to_file(workspace, "tests/test_calculator.py", _NEGATIVE_TEST)
        state["changes"] = h.base_changes(
            "src/calculator.py",
            "tests/test_calculator.py",
        )
        record.recipe_notes.append("first-attempt fix applied")
        return state

    def on_run_tests(state: dict[str, Any], record) -> dict[str, Any]:
        state["tests"] = h.run_pytest(workspace)
        record.recipe_notes.append(
            f"pytest verdict={state['tests']['verdict']}",
        )
        return state

    def on_no_directive(state: dict[str, Any], record) -> dict[str, Any]:
        # The only no-directive halt in this recipe is the
        # bad_test_verdict surface. Apply the real fix, re-run pytest.
        state_box["bad_verdict_seen"] += 1
        h.replace_in_file(
            workspace, "src/calculator.py",
            _FIRST_ATTEMPT, _REAL_FIX,
        )
        state["tests"] = h.run_pytest(workspace)
        record.recipe_notes.append(
            f"real fix applied; re-run verdict={state['tests']['verdict']}",
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
        "_no_directive": on_no_directive,
    }


__all__ = ["META", "build_recipe"]
