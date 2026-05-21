"""``apply`` step — single-file edit path for the ``ui-trivial`` set.

Phase 2 Step 6 of ``agents/roadmaps/road-to-product-ui-track.md``: the
short-circuit path for micro UI edits that provably cannot warrant the
full audit / design / review / polish loop. Hard preconditions enforced
on every rebound:

- edit surface **≤ 1 file**
- **≤ 5 changed lines**
- **no new component**
- **no new state** (no new Livewire props, React hooks, Vue refs)
- **no new dependency** (no Composer/npm package added)

Any precondition violation BLOCKS with an ``@agent-directive:
reclassify-to-ui-improve`` halt; the orchestrator promotes
``state.directive_set`` to ``"ui-improve"`` (the audit-gated path) and
re-invokes the engine. The audit gate is **not** weakened — it is
bypassed only for cases that mathematically cannot need it.

On first pass ``state.ticket["trivial_edit"]`` is unset; the step
delegates to the agent via ``@agent-directive: trivial-apply``. The
agent inspects the request, performs the edit, and writes the envelope
back so the rebound runs the deterministic checks.
"""
from __future__ import annotations

from typing import Any

from ...delivery_state import (
    DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
)

MAX_FILES: int = 1
"""Edit-surface ceiling — single-file edits only."""

MAX_LINES_CHANGED: int = 5
"""Changed-line ceiling — anything larger is structural, not trivial."""

AMBIGUITIES: tuple[dict[str, str], ...] = (
    {
        "code": "trivial_envelope_missing",
        "trigger": "state.ticket['trivial_edit'] unset — first pass",
        "resolution": "agent directive `trivial-apply` → agent performs "
        "the single-file edit and writes the envelope back",
    },
    {
        "code": "trivial_preconditions_violated",
        "trigger": "edit touches >1 file, >5 lines, adds component/state/dependency",
        "resolution": "agent directive `reclassify-to-ui-improve` → "
        "orchestrator promotes directive_set='ui-improve' and re-runs "
        "through the full audit gate",
    },
)


def run(state: DeliveryState) -> StepResult:
    """Apply the trivial-edit gate."""
    envelope = _trivial_envelope(state)
    if envelope is None:
        return _delegate_to_agent(state)

    violations = _check_preconditions(envelope)
    if violations:
        return _halt_reclassify(state, violations)

    _record_change(state, envelope)
    return StepResult(outcome=Outcome.SUCCESS)


def _trivial_envelope(state: DeliveryState) -> dict[str, Any] | None:
    """Return the agent-written ``trivial_edit`` envelope, or ``None``."""
    data = state.ticket or {}
    envelope = data.get("trivial_edit")
    if isinstance(envelope, dict) and envelope:
        return envelope
    return None


def _check_preconditions(envelope: dict[str, Any]) -> list[str]:
    """Return a list of violation codes; empty when all preconditions pass."""
    violations: list[str] = []

    files = envelope.get("files")
    if not isinstance(files, list) or len(files) == 0:
        violations.append("files_missing")
    elif len(files) > MAX_FILES:
        violations.append(f"files_exceeded:{len(files)}>{MAX_FILES}")

    lines = envelope.get("lines_changed")
    try:
        lines_int = int(lines)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        violations.append("lines_changed_missing")
    else:
        if lines_int > MAX_LINES_CHANGED:
            violations.append(f"lines_exceeded:{lines_int}>{MAX_LINES_CHANGED}")
        if lines_int < 0:
            violations.append("lines_changed_negative")

    if envelope.get("new_component"):
        violations.append("new_component")
    if envelope.get("new_state"):
        violations.append("new_state")
    if envelope.get("new_dependency"):
        violations.append("new_dependency")

    return violations


def _delegate_to_agent(state: DeliveryState) -> StepResult:
    """First-pass halt — delegate to the agent for the single-file edit."""
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            agent_directive("trivial-apply"),
            "> Trivial UI edit path \u2014 audit / design / review skipped.",
            "> 1. Continue \u2014 perform the single-file edit, then "
            "write a `trivial_edit` envelope back into state.ticket "
            "(files, lines_changed, new_component, new_state, new_dependency)",
            "> 2. Abort \u2014 drop this trivial edit",
        ],
        message="Trivial UI edit pending; delegating to agent for single-file edit.",
    )


def _halt_reclassify(state: DeliveryState, violations: list[str]) -> StepResult:
    """BLOCKED halt \u2014 orchestrator must reclassify to ``ui-improve``."""
    state.ticket["__reclassify_to__"] = "ui-improve"
    state.ticket.pop("trivial_edit", None)
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            agent_directive("reclassify-to-ui-improve"),
            "> Trivial-edit preconditions violated; this work needs the "
            "full audit gate.",
            f"> Violations: {', '.join(violations)}.",
            "> 1. Reclassify \u2014 orchestrator sets "
            "`state.directive_set = \"ui-improve\"` and re-runs the engine",
            "> 2. Abort \u2014 drop this UI request",
        ],
        message=(
            "Trivial-edit preconditions failed "
            f"({', '.join(violations)}); reclassification required."
        ),
    )


def _record_change(state: DeliveryState, envelope: dict[str, Any]) -> None:
    """Write a single ``state.changes`` entry summarising the trivial edit."""
    files = envelope.get("files") or []
    lines = envelope.get("lines_changed", 0)
    state.changes.append(
        {
            "kind": "ui-trivial",
            "files": list(files),
            "lines_changed": lines,
            "summary": envelope.get("summary") or "trivial UI edit",
        },
    )


__all__ = ["AMBIGUITIES", "MAX_FILES", "MAX_LINES_CHANGED", "run"]
