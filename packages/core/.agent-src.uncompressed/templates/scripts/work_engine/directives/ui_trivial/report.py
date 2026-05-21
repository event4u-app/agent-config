"""``report`` step — one-line delivery summary for the trivial path.

Phase 2 Step 6 of ``agents/roadmaps/road-to-product-ui-track.md``:
"Trivial path emits a one-line delivery summary, not the full report."

Rationale: the full backend report has nine sections — overkill for a
single-file, ≤5-line edit. The trivial summary captures what the
operator needs to see: which file, how many lines, what the edit did,
and the smoke verdict. Anything richer means the work was not
trivial, in which case ``apply`` should have reclassified to
``ui-improve`` and run the full UI track instead.

The step is pure and deterministic: reads :class:`DeliveryState`,
writes ``state.report``, always returns ``SUCCESS``.
"""
from __future__ import annotations

from typing import Any

from ...delivery_state import DeliveryState, Outcome, StepResult

AMBIGUITIES: tuple[dict[str, str], ...] = ()
"""Pure render \u2014 no blocked paths."""


def run(state: DeliveryState) -> StepResult:
    """Render the one-line trivial summary into ``state.report``."""
    state.report = _render(state)
    return StepResult(outcome=Outcome.SUCCESS)


def _render(state: DeliveryState) -> str:
    change = _last_trivial_change(state)
    if change is None:
        return "_(trivial UI edit \u2014 no change recorded)_"

    files = change.get("files") or []
    lines = change.get("lines_changed", 0)
    summary = (change.get("summary") or "trivial UI edit").strip()
    file_str = files[0] if len(files) == 1 else f"{len(files)} files"
    verdict = _smoke_verdict(state)
    verdict_str = f" \u2014 smoke: **{verdict}**" if verdict else ""
    return f"**Trivial edit:** {summary} (`{file_str}`, {lines} lines){verdict_str}"


def _last_trivial_change(state: DeliveryState) -> dict[str, Any] | None:
    for change in reversed(state.changes or []):
        if isinstance(change, dict) and change.get("kind") == "ui-trivial":
            return change
    return None


def _smoke_verdict(state: DeliveryState) -> str:
    tests = state.tests
    if isinstance(tests, dict):
        verdict = tests.get("verdict")
        if isinstance(verdict, str):
            return verdict
    return ""


__all__ = ["AMBIGUITIES", "run"]
