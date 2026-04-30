"""Tests for the ``/implement-ticket`` linear dispatcher.

Phase 1 scope: the dispatcher and ``DeliveryState`` contract. Real
step handlers arrive in Phase 2 — these tests inject minimal fakes so
each of the three terminal outcomes is exercised against the real
control flow, not against a mock of the dispatcher itself.
"""
from __future__ import annotations

import pytest

from work_engine import (
    STEP_ORDER,
    DeliveryState,
    Outcome,
    StepResult,
    dispatch,
)


def _always_success(_state: DeliveryState) -> StepResult:
    return StepResult(outcome=Outcome.SUCCESS)


def _all_success_steps() -> dict[str, object]:
    return {name: _always_success for name in STEP_ORDER}


def _state(**ticket_overrides) -> DeliveryState:
    ticket = {
        "id": "TICKET-1",
        "title": "fixture ticket",
        "acceptance_criteria": ["one concrete AC"],
        **ticket_overrides,
    }
    return DeliveryState(ticket=ticket)


def test_dispatch_success_runs_every_step_in_order() -> None:
    state = _state()

    final, halting_step = dispatch(state, _all_success_steps())

    assert final is Outcome.SUCCESS
    assert halting_step is None
    assert tuple(state.outcomes) == STEP_ORDER
    assert all(value == "success" for value in state.outcomes.values())
    assert state.questions == []


def test_dispatch_blocked_halts_at_first_blocking_step() -> None:
    blocking_questions = [
        "> 1. Define a measurable performance target.",
        "> 2. Drop the ticket — too vague to execute.",
    ]

    def _block_at_refine(_state: DeliveryState) -> StepResult:
        return StepResult(outcome=Outcome.BLOCKED, questions=blocking_questions)

    steps = _all_success_steps()
    steps["refine"] = _block_at_refine

    state = _state(acceptance_criteria=[])

    final, halting_step = dispatch(state, steps)

    assert final is Outcome.BLOCKED
    assert halting_step == "refine"
    assert state.outcomes == {"refine": "blocked"}
    assert state.questions == blocking_questions
    # No later step may run once refine blocks.
    assert "memory" not in state.outcomes
    assert "report" not in state.outcomes


def test_dispatch_partial_halts_and_surfaces_questions() -> None:
    partial_questions = ["> 1. Continue with the partial plan.", "> 2. Abort."]

    def _partial_at_plan(state: DeliveryState) -> StepResult:
        state.plan = {"sketch": "only the happy path"}
        return StepResult(outcome=Outcome.PARTIAL, questions=partial_questions)

    steps = _all_success_steps()
    steps["plan"] = _partial_at_plan

    state = _state()

    final, halting_step = dispatch(state, steps)

    assert final is Outcome.PARTIAL
    assert halting_step == "plan"
    assert state.outcomes == {
        "refine": "success",
        "memory": "success",
        "analyze": "success",
        "plan": "partial",
    }
    assert state.plan == {"sketch": "only the happy path"}
    assert state.questions == partial_questions


def test_dispatch_rejects_missing_step_handlers() -> None:
    steps = _all_success_steps()
    del steps["verify"]
    del steps["report"]

    with pytest.raises(KeyError) as excinfo:
        dispatch(_state(), steps)

    message = str(excinfo.value)
    assert "verify" in message
    assert "report" in message


def test_dispatch_rejects_blocked_without_questions() -> None:
    def _silent_block(_state: DeliveryState) -> StepResult:
        return StepResult(outcome=Outcome.BLOCKED)

    steps = _all_success_steps()
    steps["refine"] = _silent_block

    with pytest.raises(ValueError, match="refine"):
        dispatch(_state(), steps)


def test_dispatch_rejects_partial_without_questions() -> None:
    def _silent_partial(_state: DeliveryState) -> StepResult:
        return StepResult(outcome=Outcome.PARTIAL)

    steps = _all_success_steps()
    steps["plan"] = _silent_partial

    with pytest.raises(ValueError, match="plan"):
        dispatch(_state(), steps)


def test_delivery_state_defaults_isolate_between_instances() -> None:
    one = DeliveryState(ticket={"id": "A"})
    two = DeliveryState(ticket={"id": "B"})

    one.memory.append({"id": "inv-1"})
    one.outcomes["refine"] = "success"

    assert two.memory == []
    assert two.outcomes == {}


def test_dispatch_resumes_by_skipping_steps_already_marked_success() -> None:
    """Resume semantics: a step already flagged ``success`` must not rerun.

    Models the Option-A flow where the agent executes a directive
    (e.g. ``implement-plan``), records ``success`` on that step, and
    re-invokes the dispatcher to continue.
    """
    calls: list[str] = []

    def _record(name: str):
        def _step(_state: DeliveryState) -> StepResult:
            calls.append(name)
            return StepResult(outcome=Outcome.SUCCESS)

        return _step

    steps = {name: _record(name) for name in STEP_ORDER}

    state = _state()
    # Mark the first four steps as already done — dispatcher should
    # skip them and resume at ``implement``.
    for done in ("refine", "memory", "analyze", "plan"):
        state.outcomes[done] = "success"

    final, halting_step = dispatch(state, steps)

    assert final is Outcome.SUCCESS
    assert halting_step is None
    # Only the remaining four steps ran, in order.
    assert calls == ["implement", "test", "verify", "report"]
    # The skipped steps keep their prior "success" marker.
    assert state.outcomes["refine"] == "success"
    assert state.outcomes["report"] == "success"


def test_dispatch_clears_stale_questions_before_resuming() -> None:
    """A fresh invocation must not carry forward questions from a prior halt."""
    steps = _all_success_steps()

    state = _state()
    state.questions = [
        "@agent-directive: implement-plan",
        "> 1. Continue",
        "> 2. Abort",
    ]
    for done in STEP_ORDER[:4]:
        state.outcomes[done] = "success"

    final, _ = dispatch(state, steps)

    assert final is Outcome.SUCCESS
    assert state.questions == []


def test_dispatch_does_not_skip_steps_marked_blocked_or_partial() -> None:
    """Only ``success`` triggers the skip; other markers must rerun the step."""
    calls: list[str] = []

    def _success(_state: DeliveryState) -> StepResult:
        calls.append("refine")
        return StepResult(outcome=Outcome.SUCCESS)

    steps = _all_success_steps()
    steps["refine"] = _success

    state = _state()
    # A prior run ended BLOCKED on refine — a resume must rerun it, not
    # trust the stale marker.
    state.outcomes["refine"] = "blocked"

    dispatch(state, steps)

    assert calls == ["refine"]
    assert state.outcomes["refine"] == "success"



# --- ui directive set rejection (R3 Phase 2 Step 5) -------------------------
#
# Defense-in-depth golden: when a caller skips the audit and runs the
# UI directive set with no ``state.ui_audit``, the dispatcher must
# halt at ``refine`` (the audit handler), not silently pass through to
# ``analyze`` and start writing components. Pairs with the rule-layer
# enforcement in ``.agent-src.uncompressed/rules/ui-audit-before-build.md``.


def test_dispatch_ui_set_halts_on_refine_when_audit_skipped() -> None:
    """Real UI step map: missing ``state.ui_audit`` blocks at refine."""
    from work_engine.dispatcher import (  # noqa: PLC0415 — local keeps top scope clean
        load_directive_set,
    )

    steps = dict(load_directive_set("ui"))
    state = _state()
    # No state.ui_audit assignment — the audit gate must catch this.

    final, halting_step = dispatch(state, steps)

    assert final is Outcome.BLOCKED
    assert halting_step == "refine"
    assert state.outcomes == {"refine": "blocked"}
    body = "\n".join(state.questions)
    assert "existing-ui-audit" in body
    # No later step may have run.
    for downstream in ("memory", "analyze", "implement", "test", "verify", "report"):
        assert downstream not in state.outcomes


def test_dispatch_ui_set_halts_on_refine_when_audit_findings_empty() -> None:
    """An empty dict counts as 'audit has not run' — same halt as None."""
    from work_engine.dispatcher import load_directive_set  # noqa: PLC0415

    steps = dict(load_directive_set("ui"))
    state = _state()
    state.ui_audit = {}  # type: ignore[attr-defined]

    final, halting_step = dispatch(state, steps)

    assert final is Outcome.BLOCKED
    assert halting_step == "refine"
