"""End-to-end integration of the eight-step dispatcher.

Drives the full Option-A resume loop with real step handlers and a
scripted fake orchestrator. The fake is responsible for exactly
what a real orchestrator would do on each BLOCKED with an
``@agent-directive:`` marker:

1. Parse the directive verb.
2. Execute the matching "work" (here: write the expected slice).
3. Mark the step success.
4. Re-invoke ``dispatch``.

The point is to lock down the full interaction shape — that the
state threads cleanly through all eight steps, that skipping
already-successful steps works in combination with real handlers,
and that the delivery report is produced exactly once at the end.
"""
from __future__ import annotations

from typing import Any

import pytest

from implement_ticket import (
    AGENT_DIRECTIVE_PREFIX,
    DeliveryState,
    Outcome,
    STEP_ORDER,
    dispatch,
    is_agent_directive,
)
from implement_ticket.steps import (
    analyze,
    implement,
    memory,
    plan,
    refine,
    report,
    test as test_step,
    verify,
)


REAL_STEPS = {
    "refine": refine.run,
    "memory": memory.run,
    "analyze": analyze.run,
    "plan": plan.run,
    "implement": implement.run,
    "test": test_step.run,
    "verify": verify.run,
    "report": report.run,
}


@pytest.fixture()
def fake_memory_lookup(monkeypatch):
    """Force ``memory_lookup.retrieve`` to return a single influential hit.

    The production ``memory_lookup`` module reads real YAML files from
    disk. For an integration test we want reproducible output without
    I/O, so we install a stub module and point the step's lazy import
    at it.
    """
    import sys
    import types

    stub = types.ModuleType("memory_lookup")

    def retrieve(types_, keys, limit):  # noqa: ARG001 — contract parity
        return [
            {
                "id": "dec-option-a",
                "type": "architecture-decisions",
                "note": "Option A delegation chosen for implement/test/verify",
                "changed_outcome": True,
            },
        ]

    stub.retrieve = retrieve
    monkeypatch.setitem(sys.modules, "memory_lookup", stub)
    return stub


def _extract_directive_verb(questions: list[str]) -> str:
    assert questions and is_agent_directive(questions[0])
    # Shape: "@agent-directive: <verb> key=value key=value"
    payload = questions[0].split(":", 1)[1].strip()
    return payload.split(" ", 1)[0]


def _resume_as_agent(state: DeliveryState, verb: str) -> None:
    """Apply the deterministic slice a real agent would produce for ``verb``."""
    if verb == "create-plan":
        state.plan = [
            {"title": "Add export endpoint", "detail": "GET /api/exports"},
            {"title": "Wire frontend download button"},
        ]
        state.outcomes["plan"] = Outcome.SUCCESS.value
    elif verb == "apply-plan":
        state.changes = [
            {"path": "app/Http/Controllers/Export.php", "purpose": "new endpoint"},
            {"path": "resources/views/exports.blade.php", "purpose": "download button"},
        ]
        state.outcomes["implement"] = Outcome.SUCCESS.value
    elif verb == "run-tests":
        state.tests = {"verdict": "success", "targeted": "all green", "duration_ms": 1420}
        state.outcomes["test"] = Outcome.SUCCESS.value
    elif verb == "review-changes":
        state.verify = {"verdict": "success", "confidence": "high", "findings": []}
        state.outcomes["verify"] = Outcome.SUCCESS.value
    else:  # pragma: no cover — a new verb means the contract changed
        raise AssertionError(f"unknown directive verb: {verb!r}")


def _drive_loop(state: DeliveryState, *, max_iterations: int = 10) -> list[str]:
    """Run dispatch+resume until SUCCESS, returning the verbs seen in order."""
    seen: list[str] = []
    for _ in range(max_iterations):
        final, halting_step = dispatch(state, REAL_STEPS)
        if final is Outcome.SUCCESS:
            return seen
        assert final is Outcome.BLOCKED, (
            f"unexpected halt at {halting_step}: outcome={final}"
        )
        verb = _extract_directive_verb(state.questions)
        seen.append(verb)
        _resume_as_agent(state, verb)
    raise AssertionError("dispatch did not converge within max_iterations")


def _well_formed_ticket() -> dict[str, Any]:
    return {
        "id": "TICKET-42",
        "title": "Add export button",
        "acceptance_criteria": [
            "Users can trigger a CSV export from the dashboard within two clicks.",
            "The exported file includes every visible column.",
        ],
    }



def test_full_flow_converges_with_four_agent_rebounds(fake_memory_lookup) -> None:
    """Happy path — all eight steps reach SUCCESS.

    The four agent-driven steps (``plan``, ``implement``, ``test``,
    ``verify``) each cause exactly one rebound, in that order. The
    deterministic gates (``refine``, ``memory``, ``analyze``) and the
    pure renderer (``report``) run without delegation.
    """
    state = DeliveryState(ticket=_well_formed_ticket())

    verbs = _drive_loop(state)

    assert verbs == ["create-plan", "apply-plan", "run-tests", "review-changes"]
    assert all(
        state.outcomes.get(name) == Outcome.SUCCESS.value for name in STEP_ORDER
    ), state.outcomes


def test_full_flow_produces_delivery_report(fake_memory_lookup) -> None:
    """The ``report`` step is the final producer of Markdown output."""
    state = DeliveryState(ticket=_well_formed_ticket())

    _drive_loop(state)

    assert isinstance(state.report, str)
    assert state.report.strip().startswith("#")
    # Ticket identifier is mandatory in the delivery report header.
    assert "TICKET-42" in state.report


def test_full_flow_keeps_memory_section_when_hit_changed_outcome(
    fake_memory_lookup,
) -> None:
    """A hit with ``changed_outcome=True`` must surface in the report."""
    state = DeliveryState(ticket=_well_formed_ticket())

    _drive_loop(state)

    assert "Memory that mattered" in state.report
    assert "dec-option-a" in state.report


def test_full_flow_drops_memory_section_when_no_hit_changed_outcome(
    monkeypatch,
) -> None:
    """Zero-impact memory must not pad the report (decision-change rule)."""
    import sys
    import types

    stub = types.ModuleType("memory_lookup")
    stub.retrieve = lambda types_, keys, limit: [
        {
            "id": "dec-irrelevant",
            "type": "historical-patterns",
            "note": "not applied",
            "changed_outcome": False,
        },
    ]
    monkeypatch.setitem(sys.modules, "memory_lookup", stub)

    state = DeliveryState(ticket=_well_formed_ticket())
    _drive_loop(state)

    assert "Memory that mattered" not in state.report


def test_resume_skips_already_successful_steps(fake_memory_lookup) -> None:
    """Pre-seeded ``outcomes`` short-circuit the deterministic gates.

    Simulates the case where the caller already ran ``refine`` and
    ``memory`` in a prior session and resumes with ``analyze`` at
    the front of the work queue.
    """
    state = DeliveryState(ticket=_well_formed_ticket())
    state.outcomes["refine"] = Outcome.SUCCESS.value
    state.outcomes["memory"] = Outcome.SUCCESS.value
    state.memory = []

    verbs = _drive_loop(state)

    assert verbs == ["create-plan", "apply-plan", "run-tests", "review-changes"]


def test_loop_halts_when_test_verdict_is_failed(fake_memory_lookup) -> None:
    """A ``failed`` test verdict must surface as BLOCKED and stop the flow.

    The agent only records ``state.tests`` and re-invokes the
    dispatcher. It does **not** mark the step success — that is the
    gate's job. ``test.py`` inspects the verdict on the rebound and
    halts, which is exactly what ``verify-before-complete`` demands.
    """
    state = DeliveryState(ticket=_well_formed_ticket())

    # Resume through plan + implement, then populate a failed test verdict.
    for expected_verb in ("create-plan", "apply-plan"):
        final, _ = dispatch(state, REAL_STEPS)
        assert final is Outcome.BLOCKED
        assert _extract_directive_verb(state.questions) == expected_verb
        _resume_as_agent(state, expected_verb)

    final, _ = dispatch(state, REAL_STEPS)
    assert final is Outcome.BLOCKED
    assert _extract_directive_verb(state.questions) == "run-tests"
    # Agent ran the tests, captured the verdict, re-dispatches. It does
    # NOT forge outcomes["test"] = success — the gate decides that.
    state.tests = {"verdict": "failed", "targeted": "3 failures in ExportTest"}

    final, halting_step = dispatch(state, REAL_STEPS)
    assert final is Outcome.BLOCKED
    assert halting_step == "test"
    assert state.outcomes["test"] == Outcome.BLOCKED.value
    assert state.outcomes.get("verify") is None
    assert state.outcomes.get("report") is None
