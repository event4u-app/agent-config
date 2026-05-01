"""GT-5 — state-resume: continue from disk after a SIGTERM-style stop.

The runner records the full happy path the same way GT-1 does, but
the harness drives it in **two segments** to demonstrate that the
engine resumes purely from the persisted state file:

- Segment A: invoke the engine until it halts at ``apply-plan``.
  The runner then exits its capture loop early, simulating an
  agent process termination.
- Segment B: a fresh runner invocation continues from the saved
  state file (``--ticket-file`` is omitted on every cycle by the
  runner anyway, so cycle 1 of segment B already exercises the
  resume contract). The capture then walks the rest of the flow
  to SUCCESS.

The recipe content matches GT-1 (multiply); the value of GT-5 is
the segmentation, not the toy domain.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from . import _helpers as h

META = {
    "gt_id": "GT-5",
    "ticket_relpath": "tickets/gt-5-state-resume.json",
    "persona": None,
    "cycle_cap": 6,
    "resume_after_directive": "apply-plan",
}

_NEGATE_SRC = '''

def negate(a: int) -> int:
    return -a
'''

_NEGATE_TEST = '''

def test_negate_returns_negation() -> None:
    from src.calculator import negate
    assert negate(0) == 0
    assert negate(7) == -7
    assert negate(-7) == 7
'''


def build_recipe(workspace: Path) -> dict[str, Any]:
    """Same shape as GT-1 — the segmentation lives in the runner."""

    def on_create_plan(state: dict[str, Any], record) -> dict[str, Any]:
        state["plan"] = h.standard_plan(
            "Add negate(a)",
            "Append negate(a: int) -> int to src/calculator.py",
            "Append test_negate_returns_negation to tests/test_calculator.py",
            "Run pytest to confirm both edge cases pass",
        )
        record.recipe_notes.append("plan recorded")
        return state

    def on_apply_plan(state: dict[str, Any], record) -> dict[str, Any]:
        h.append_to_file(workspace, "src/calculator.py", _NEGATE_SRC)
        h.append_to_file(workspace, "tests/test_calculator.py", _NEGATE_TEST)
        state["changes"] = h.base_changes(
            "src/calculator.py",
            "tests/test_calculator.py",
        )
        record.recipe_notes.append("negate + test appended")
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
