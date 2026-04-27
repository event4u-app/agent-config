"""Persona-policy integration across the step handlers.

The ``test_integration_full_flow`` suite covers the default
``senior-engineer`` persona end-to-end. This file exercises the
two remaining shipped personas — ``qa`` and ``advisory`` — under
the same scripted-orchestrator pattern.
"""
from __future__ import annotations

import sys
import types

import pytest

from work_engine import (
    AGENT_DIRECTIVE_PREFIX,
    DeliveryState,
    Outcome,
    STEP_ORDER,
    dispatch,
    is_agent_directive,
)
from work_engine.steps import (
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
    stub = types.ModuleType("memory_lookup")
    stub.retrieve = lambda types_, keys, limit: []
    monkeypatch.setitem(sys.modules, "memory_lookup", stub)
    return stub


def _ticket() -> dict:
    return {
        "id": "TICKET-9001",
        "title": "Add invoice export",
        "acceptance_criteria": [
            "User can download invoices as CSV from the invoices page.",
            "Filename includes the selected date range.",
        ],
    }


def _directive_verb(questions: list[str]) -> str:
    assert questions and is_agent_directive(questions[0])
    payload = questions[0].split(":", 1)[1].strip()
    return payload.split(" ", 1)[0]


def test_qa_persona_widens_run_tests_directive(fake_memory_lookup) -> None:
    """QA persona emits ``scope=full`` instead of ``scope=targeted``."""
    state = DeliveryState(ticket=_ticket(), persona="qa")

    # Walk to the test step — plan + implement still delegate normally.
    dispatch(state, REAL_STEPS)
    state.plan = [{"title": "Add export button"}]
    state.outcomes["plan"] = Outcome.SUCCESS.value

    dispatch(state, REAL_STEPS)
    state.changes = [{"path": "app/Exports/InvoiceCsvExport.php"}]
    state.outcomes["implement"] = Outcome.SUCCESS.value

    final, halting = dispatch(state, REAL_STEPS)
    assert final is Outcome.BLOCKED
    assert halting == "test"
    directive = state.questions[0]
    assert directive.startswith(AGENT_DIRECTIVE_PREFIX)
    assert "scope=full" in directive
    # Human-facing option line mirrors the widened scope so the user
    # sees the same verb as the orchestrator receives.
    assert any("run full tests" in q for q in state.questions)


def test_advisory_persona_converges_without_rebounds_after_plan(
    fake_memory_lookup,
) -> None:
    """Advisory skips implement/test/verify; only ``create-plan`` rebounds."""
    state = DeliveryState(ticket=_ticket(), persona="advisory")
    verbs_seen: list[str] = []

    for _ in range(6):
        final, _halting = dispatch(state, REAL_STEPS)
        if final is Outcome.SUCCESS:
            break
        assert final is Outcome.BLOCKED
        verb = _directive_verb(state.questions)
        verbs_seen.append(verb)
        # Advisory only rebounds on ``create-plan``; implement/test/verify
        # auto-succeed so no other directive should ever appear.
        assert verb == "create-plan"
        state.plan = [{"title": "Propose a CSV export on the invoice page"}]
        state.outcomes["plan"] = Outcome.SUCCESS.value
    else:  # pragma: no cover
        raise AssertionError("advisory flow did not converge")

    assert verbs_seen == ["create-plan"]
    # Implement/test/verify must have been visited and marked success
    # (the dispatcher skips already-successful steps on subsequent runs
    # only; their auto-success is what keeps the single dispatch cycle
    # from halting at them).
    for name in ("implement", "test", "verify", "report"):
        assert state.outcomes[name] == Outcome.SUCCESS.value


def test_advisory_report_drops_next_commands_section(fake_memory_lookup) -> None:
    """Advisory reports must not suggest ``/commit`` — nothing was changed."""
    state = DeliveryState(ticket=_ticket(), persona="advisory")

    # Drive to convergence with one plan rebound.
    for _ in range(4):
        final, _ = dispatch(state, REAL_STEPS)
        if final is Outcome.SUCCESS:
            break
        state.plan = [{"title": "Advisory-only outline"}]
        state.outcomes["plan"] = Outcome.SUCCESS.value

    assert "Suggested next commands" not in state.report
    assert "/commit" not in state.report
    # But the persona itself shows up in the report header.
    assert "advisory" in state.report


def test_advisory_report_still_renders_core_sections(fake_memory_lookup) -> None:
    """Dropping commands must not strip Ticket/Plan/Persona sections."""
    state = DeliveryState(ticket=_ticket(), persona="advisory")
    for _ in range(4):
        final, _ = dispatch(state, REAL_STEPS)
        if final is Outcome.SUCCESS:
            break
        state.plan = "Outline only"
        state.outcomes["plan"] = Outcome.SUCCESS.value

    for heading in ("## Ticket", "## Persona", "## Plan"):
        assert heading in state.report
