"""Tests for :class:`work_engine.hooks.builtin.HaltSurfaceAuditHook`."""
from __future__ import annotations

import pytest

from work_engine.delivery_state import DeliveryState, Outcome, StepResult
from work_engine.hooks import (
    HaltSurfaceAuditHook,
    HookContext,
    HookEvent,
    HookRegistry,
    HookRunner,
)


def _registry_with_audit() -> HookRegistry:
    registry = HookRegistry()
    HaltSurfaceAuditHook().register(registry)
    return registry


def test_audit_passes_when_step_result_carries_questions() -> None:
    runner = HookRunner(_registry_with_audit())

    runner.emit(
        HookEvent.ON_HALT,
        HookContext(
            step_name="plan",
            result=StepResult(outcome=Outcome.BLOCKED, questions=["1. why?"]),
        ),
    )


def test_audit_warns_on_empty_step_result_questions() -> None:
    runner = HookRunner(_registry_with_audit())

    with pytest.warns(UserWarning, match="surfaced no questions"):
        runner.emit(
            HookEvent.ON_HALT,
            HookContext(
                step_name="plan",
                result=StepResult(outcome=Outcome.BLOCKED, questions=[]),
            ),
        )


def test_audit_falls_back_to_state_questions_when_result_is_none() -> None:
    """Hook-driven halts have no StepResult; surface lives on state.questions."""
    delivery = DeliveryState(ticket={}, questions=["1. via hook?"])
    runner = HookRunner(_registry_with_audit())

    runner.emit(
        HookEvent.ON_HALT,
        HookContext(step_name="plan", delivery=delivery),
    )


def test_audit_warns_when_neither_result_nor_state_carry_questions() -> None:
    delivery = DeliveryState(ticket={}, questions=[])
    runner = HookRunner(_registry_with_audit())

    with pytest.warns(UserWarning, match="hook-driven halt"):
        runner.emit(
            HookEvent.ON_HALT,
            HookContext(step_name="plan", delivery=delivery),
        )


def test_audit_only_registers_on_halt_event() -> None:
    registry = _registry_with_audit()
    assert registry.for_event(HookEvent.ON_HALT)
    assert not registry.for_event(HookEvent.BEFORE_STEP)
    assert not registry.for_event(HookEvent.AFTER_STEP)
