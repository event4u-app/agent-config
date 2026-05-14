"""Integration tests for :class:`work_engine.hooks.builtin.DecisionGateHook`.

The hook bridges the gate evaluator into the dispatcher hook bus on
``AFTER_STEP``. These tests assert:

- default-off semantics (no gates active → no callback fires);
- ``stop`` action raises :class:`HookHalt` with the surface contract;
- ``warn`` action raises :class:`HookError` (non-fatal);
- ``ask_timeout`` action falls back to ``stop`` / ``warn`` per
  ``on_block_fallback``;
- gate fires only for its owning phase.

Contract: ``docs/contracts/decision-engine-gates.md``.
"""
from __future__ import annotations

import pytest

from work_engine.delivery_state import DeliveryState, Outcome, StepResult
from work_engine.hooks import HookContext, HookEvent, HookRegistry, HookRunner
from work_engine.hooks.builtin.decision_gate import (
    DecisionGateHook,
    build_decision_gate_hook,
)
from work_engine.hooks.exceptions import HookError, HookHalt
from work_engine.scoring.decision_engine import DecisionEngineSettings


def _runner_with(settings: DecisionEngineSettings) -> HookRunner:
    registry = HookRegistry()
    hook = DecisionGateHook(settings)
    hook.register(registry)
    return HookRunner(registry)


def _ctx(phase: str, **delivery_kwargs) -> HookContext:
    delivery = DeliveryState(ticket={}, **delivery_kwargs)
    return HookContext(
        step_name=phase,
        delivery=delivery,
        result=StepResult(outcome=Outcome.SUCCESS),
    )


# -- factory ------------------------------------------------------------

def test_factory_returns_none_for_default_settings() -> None:
    assert build_decision_gate_hook(DecisionEngineSettings()) is None


def test_factory_returns_none_for_non_settings_input() -> None:
    assert build_decision_gate_hook(None) is None
    assert build_decision_gate_hook({"min_confidence": "high"}) is None


def test_factory_returns_hook_when_any_gate_active() -> None:
    s = DecisionEngineSettings(min_confidence="medium")
    hook = build_decision_gate_hook(s)
    assert isinstance(hook, DecisionGateHook)


# -- inactive paths -----------------------------------------------------

def test_no_gates_active_is_a_noop() -> None:
    runner = _runner_with(DecisionEngineSettings())
    # No exception raised; HookRunner.emit returns None on a clean pass.
    assert runner.emit(HookEvent.AFTER_STEP, _ctx("plan")) is None


def test_gate_silent_when_signal_above_floor() -> None:
    """memory_hits=2 → memory + verify push confidence into high band."""
    runner = _runner_with(DecisionEngineSettings(min_confidence="medium"))
    ctx = _ctx(
        "plan",
        memory=[{"id": "m1", "hit": True}, {"id": "m2", "hit": True}],
        verify={"claims": 1, "first_try_passes": 1},
    )
    assert runner.emit(HookEvent.AFTER_STEP, ctx) is None


def test_gate_does_not_fire_outside_owning_phase() -> None:
    """min_confidence owns Plan; other phases must pass through."""
    runner = _runner_with(DecisionEngineSettings(min_confidence="high"))
    for phase in ("refine", "memory", "analyze", "implement", "test"):
        # No memory + no verify → band would be 'low', but only Plan
        # has the floor wired.
        assert runner.emit(HookEvent.AFTER_STEP, _ctx(phase)) is None


# -- stop action --------------------------------------------------------

def test_stop_action_returns_halt_with_surface() -> None:
    runner = _runner_with(
        DecisionEngineSettings(min_confidence="high", on_block="stop"),
    )
    halt = runner.emit(HookEvent.AFTER_STEP, _ctx("plan"))
    assert isinstance(halt, HookHalt)
    assert halt.reason.startswith("decision_gate:min_confidence")
    assert any("min_confidence" in line for line in halt.surface)
    # surface follows the three-option numbered template.
    numbered = [line for line in halt.surface if line[:2] in ("1)", "2)", "3)")]
    assert len(numbered) == 3


# -- warn action --------------------------------------------------------

def test_warn_action_logs_via_hook_error(
    recwarn: pytest.WarningsRecorder,
) -> None:
    runner = _runner_with(
        DecisionEngineSettings(min_confidence="high", on_block="warn"),
    )
    # warn collapses to HookError → runner converts it to a warnings.warn
    # and returns None (work proceeds).
    result = runner.emit(HookEvent.AFTER_STEP, _ctx("plan"))
    assert result is None
    assert any(
        "decision_gate:min_confidence" in str(w.message)
        for w in recwarn.list
    )


# -- ask_timeout fallback ----------------------------------------------

def test_ask_timeout_falls_back_to_stop_when_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CI", "true")
    runner = _runner_with(DecisionEngineSettings(
        min_confidence="high",
        on_block="ask",
        on_block_fallback="stop",
    ))
    halt = runner.emit(HookEvent.AFTER_STEP, _ctx("plan"))
    assert isinstance(halt, HookHalt)
    assert "ask_timeout" in halt.reason


def test_ask_timeout_falls_back_to_warn_when_configured(
    monkeypatch: pytest.MonkeyPatch,
    recwarn: pytest.WarningsRecorder,
) -> None:
    monkeypatch.setenv("CI", "true")
    runner = _runner_with(DecisionEngineSettings(
        min_confidence="high",
        on_block="ask",
        on_block_fallback="warn",
    ))
    result = runner.emit(HookEvent.AFTER_STEP, _ctx("plan"))
    assert result is None
    assert any(
        "ask_timeout" in str(w.message) for w in recwarn.list
    )


# -- phase routing for risk + memory gates -----------------------------

def test_block_on_risk_fires_only_on_implement() -> None:
    runner = _runner_with(
        DecisionEngineSettings(block_on_risk="low", on_block="stop"),
    )
    # Plan / refine: gate dormant, no risk evaluation.
    assert runner.emit(HookEvent.AFTER_STEP, _ctx("plan")) is None
    assert runner.emit(HookEvent.AFTER_STEP, _ctx("refine")) is None
    # Implement with a change set → derive_risk_class returns 'medium'
    # → above 'low' ceiling → halt.
    ctx = _ctx("implement", changes=[{"path": "a.py"}])
    halt = runner.emit(HookEvent.AFTER_STEP, ctx)
    assert isinstance(halt, HookHalt)
    assert "block_on_risk" in halt.reason


def test_require_memory_hits_fires_only_on_refine() -> None:
    runner = _runner_with(
        DecisionEngineSettings(require_memory_hits=True, on_block="stop"),
    )
    # No memory on refine → halt.
    halt = runner.emit(HookEvent.AFTER_STEP, _ctx("refine"))
    assert isinstance(halt, HookHalt)
    assert "require_memory_hits" in halt.reason
    # With memory hit → silent.
    ctx = _ctx("refine", memory=[{"id": "m1", "hit": True}])
    assert runner.emit(HookEvent.AFTER_STEP, ctx) is None
