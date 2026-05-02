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
from work_engine.hooks import (
    HookContext,
    HookError,
    HookEvent,
    HookHalt,
    HookRegistry,
    HookRunner,
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
# enforcement in ``.agent-src.uncompressed/rules/ui-audit-gate.md``.


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


# --- dispatcher hook instrumentation (P2 of road-to-work-engine-hooks) ------
#
# Hook events fire from inside ``dispatch()`` and operate on
# ``DeliveryState``. The four dispatcher-layer events (``before_step``,
# ``after_step``, ``on_halt``, ``on_error``) round-trip through a real
# ``HookRunner`` so the tests exercise the actual emit path, not a mock.


def _runner_with(events: dict[HookEvent, list]) -> HookRunner:
    registry = HookRegistry()
    for event, callbacks in events.items():
        for cb in callbacks:
            registry.register(event, cb)
    return HookRunner(registry)


def test_dispatch_emits_before_and_after_step_in_order() -> None:
    """Every step yields one ``before_step`` then one ``after_step`` event."""
    trace: list[tuple[str, str]] = []

    def _record(event_label: str):
        def _cb(ctx: HookContext) -> None:
            trace.append((event_label, ctx.step_name or ""))

        return _cb

    runner = _runner_with(
        {
            HookEvent.BEFORE_STEP: [_record("before")],
            HookEvent.AFTER_STEP: [_record("after")],
        }
    )

    final, halting = dispatch(_state(), _all_success_steps(), hooks=runner)

    assert final is Outcome.SUCCESS
    assert halting is None
    expected = []
    for name in STEP_ORDER:
        expected.append(("before", name))
        expected.append(("after", name))
    assert trace == expected


def test_dispatch_emits_on_halt_for_natural_blocked_outcome() -> None:
    """A handler-driven BLOCKED still fires ``on_halt`` once, observe-only."""
    halt_events: list[str] = []

    def _record_halt(ctx: HookContext) -> None:
        halt_events.append(ctx.step_name or "")

    def _block_at_plan(_state: DeliveryState) -> StepResult:
        return StepResult(
            outcome=Outcome.BLOCKED,
            questions=["> 1. Continue.", "> 2. Abort."],
        )

    steps = _all_success_steps()
    steps["plan"] = _block_at_plan

    runner = _runner_with({HookEvent.ON_HALT: [_record_halt]})

    final, halting = dispatch(_state(), steps, hooks=runner)

    assert final is Outcome.BLOCKED
    assert halting == "plan"
    # Exactly one on_halt fires, for the halting step only.
    assert halt_events == ["plan"]


def test_dispatch_emits_on_error_then_propagates_handler_exception() -> None:
    """A handler raising ``Exception`` fires ``on_error`` and re-raises."""
    seen: list[BaseException] = []

    def _record_error(ctx: HookContext) -> None:
        if ctx.exception is not None:
            seen.append(ctx.exception)

    boom = RuntimeError("handler exploded")

    def _explode(_state: DeliveryState) -> StepResult:
        raise boom

    steps = _all_success_steps()
    steps["analyze"] = _explode

    runner = _runner_with({HookEvent.ON_ERROR: [_record_error]})

    with pytest.raises(RuntimeError, match="handler exploded"):
        dispatch(_state(), steps, hooks=runner)

    assert seen == [boom]


def test_dispatch_before_step_hook_halt_blocks_engine_before_handler_runs() -> None:
    """``HookHalt`` from ``before_step`` halts the engine without the handler."""
    handler_calls: list[str] = []

    def _record_handler(name: str):
        def _h(_state: DeliveryState) -> StepResult:
            handler_calls.append(name)
            return StepResult(outcome=Outcome.SUCCESS)

        return _h

    surface = ["> 1. Resolve foreign session.", "> 2. Reset chat-history."]

    def _halt_on_analyze(ctx: HookContext) -> None:
        if ctx.step_name == "analyze":
            raise HookHalt(reason="foreign", surface=surface)

    steps = {name: _record_handler(name) for name in STEP_ORDER}
    runner = _runner_with({HookEvent.BEFORE_STEP: [_halt_on_analyze]})

    state = _state()
    final, halting = dispatch(state, steps, hooks=runner)

    assert final is Outcome.BLOCKED
    assert halting == "analyze"
    assert state.questions == surface
    # The handler for ``analyze`` must not have run.
    assert handler_calls == ["refine", "memory"]
    # The halted step gets a ``blocked`` marker so resume re-enters the gate.
    assert state.outcomes["analyze"] == "blocked"


def test_dispatch_after_step_hook_halt_blocks_engine_after_handler_runs() -> None:
    """``HookHalt`` from ``after_step`` halts but preserves the handler outcome."""
    surface = ["> 1. Acknowledge.", "> 2. Skip the step."]

    def _halt_on_memory(ctx: HookContext) -> None:
        if ctx.step_name == "memory":
            raise HookHalt(reason="validation_failed", surface=surface)

    runner = _runner_with({HookEvent.AFTER_STEP: [_halt_on_memory]})

    state = _state()
    final, halting = dispatch(state, _all_success_steps(), hooks=runner)

    assert final is Outcome.BLOCKED
    assert halting == "memory"
    assert state.questions == surface
    # Handler ran and recorded ``success`` before the hook halted; the
    # marker the handler produced is preserved.
    assert state.outcomes["memory"] == "success"
    # No later step ran.
    for downstream in ("analyze", "plan", "implement", "test", "verify", "report"):
        assert downstream not in state.outcomes


def test_dispatch_hook_error_is_swallowed_and_dispatch_continues() -> None:
    """``HookError`` from a callback is non-fatal — runner warns, engine proceeds."""
    import warnings  # noqa: PLC0415 — local keeps top-level imports tight

    def _flaky(_ctx: HookContext) -> None:
        raise HookError("trace sink unavailable")

    runner = _runner_with({HookEvent.BEFORE_STEP: [_flaky]})

    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        final, halting = dispatch(_state(), _all_success_steps(), hooks=runner)

    assert final is Outcome.SUCCESS
    assert halting is None
    # One warning per before_step emission across STEP_ORDER.
    assert len(caught) == len(STEP_ORDER)


def test_dispatch_without_hooks_is_byte_compatible() -> None:
    """Calling ``dispatch`` without ``hooks`` mirrors the pre-P2 contract.

    Defensive golden: every step still runs, outcomes still record, and
    no spurious questions appear when the hooks parameter is omitted.
    """
    state = _state()

    final, halting = dispatch(state, _all_success_steps())

    assert final is Outcome.SUCCESS
    assert halting is None
    assert tuple(state.outcomes) == STEP_ORDER
    assert state.questions == []
