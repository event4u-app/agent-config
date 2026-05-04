"""Tests for :class:`work_engine.hooks.builtin.DecisionTraceHook`."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from work_engine.delivery_state import DeliveryState, Outcome, StepResult
from work_engine.hooks import (
    DecisionTraceHook,
    HookContext,
    HookEvent,
    HookRegistry,
    HookRunner,
)


def _registry() -> tuple[HookRegistry, DecisionTraceHook]:
    registry = HookRegistry()
    hook = DecisionTraceHook()
    hook.register(registry)
    return registry, hook


def test_emits_one_trace_per_step(tmp_path: Path) -> None:
    state_file = tmp_path / "work" / "ABCD-1234" / "state.json"
    state_file.parent.mkdir(parents=True)

    registry, _ = _registry()
    runner = HookRunner(registry)

    runner.emit(HookEvent.BEFORE_LOAD, HookContext(state_file=state_file))
    runner.emit(
        HookEvent.AFTER_LOAD,
        HookContext(state_file=state_file, work={}),
    )
    runner.emit(
        HookEvent.BEFORE_STEP,
        HookContext(step_name="plan", delivery=DeliveryState(ticket={})),
    )
    runner.emit(
        HookEvent.AFTER_STEP,
        HookContext(
            step_name="plan",
            delivery=DeliveryState(ticket={}),
            result=StepResult(outcome=Outcome.SUCCESS),
        ),
    )

    target = state_file.parent / "decision-trace-plan.json"
    assert target.exists(), f"missing trace at {target}"

    payload = json.loads(target.read_text(encoding="utf-8"))
    assert payload["schema_version"] == 1
    assert payload["work_id"] == "ABCD-1234"
    assert payload["phase"] == "plan"
    assert payload["confidence_band"] in {"low", "medium", "high"}
    assert payload["risk_class"] in {"low", "medium", "high"}
    assert payload["rules"] == []
    assert payload["memory"] == {"asks": 0, "hits": 0, "ids": []}
    assert payload["verify"] == {"claims": 0, "first_try_passes": 0}


def test_falls_back_to_state_stem_when_path_is_unconventional(
    tmp_path: Path,
) -> None:
    state_file = tmp_path / "loose-state.json"
    state_file.write_text("{}", encoding="utf-8")

    registry, _ = _registry()
    runner = HookRunner(registry)

    runner.emit(HookEvent.BEFORE_LOAD, HookContext(state_file=state_file))
    runner.emit(
        HookEvent.BEFORE_STEP,
        HookContext(step_name="memory", delivery=DeliveryState(ticket={})),
    )
    runner.emit(
        HookEvent.AFTER_STEP,
        HookContext(step_name="memory", delivery=DeliveryState(ticket={})),
    )

    target = tmp_path / "loose-state.decision-trace-memory.json"
    assert target.exists()
    payload = json.loads(target.read_text(encoding="utf-8"))
    assert payload["work_id"] == "loose-state"
    assert payload["phase"] == "memory"


def test_band_high_when_memory_and_verify_agree(tmp_path: Path) -> None:
    state_file = tmp_path / "work" / "X" / "state.json"
    state_file.parent.mkdir(parents=True)

    delivery = DeliveryState(
        ticket={},
        memory=[
            {"id": "m1", "hit": True},
            {"id": "m2", "hit": True},
        ],
        verify={"claims": 2, "first_try_passes": 2},
    )

    registry, _ = _registry()
    runner = HookRunner(registry)
    runner.emit(HookEvent.BEFORE_LOAD, HookContext(state_file=state_file))
    runner.emit(
        HookEvent.BEFORE_STEP,
        HookContext(step_name="verify", delivery=delivery),
    )
    runner.emit(
        HookEvent.AFTER_STEP,
        HookContext(step_name="verify", delivery=delivery),
    )

    payload = json.loads(
        (state_file.parent / "decision-trace-verify.json").read_text()
    )
    assert payload["confidence_band"] == "high"
    assert payload["memory"]["hits"] == 2
    assert payload["memory"]["ids"] == ["m1", "m2"]
    assert payload["verify"] == {"claims": 2, "first_try_passes": 2}


def test_band_low_when_no_signal(tmp_path: Path) -> None:
    state_file = tmp_path / "work" / "Y" / "state.json"
    state_file.parent.mkdir(parents=True)

    registry, _ = _registry()
    runner = HookRunner(registry)
    runner.emit(HookEvent.BEFORE_LOAD, HookContext(state_file=state_file))
    runner.emit(
        HookEvent.BEFORE_STEP,
        HookContext(step_name="refine", delivery=DeliveryState(ticket={})),
    )
    runner.emit(
        HookEvent.AFTER_STEP,
        HookContext(step_name="refine", delivery=DeliveryState(ticket={})),
    )

    payload = json.loads(
        (state_file.parent / "decision-trace-refine.json").read_text()
    )
    assert payload["confidence_band"] == "low"
    assert payload["risk_class"] == "low"


def test_risk_medium_when_changes_present(tmp_path: Path) -> None:
    state_file = tmp_path / "work" / "Z" / "state.json"
    state_file.parent.mkdir(parents=True)

    delivery = DeliveryState(
        ticket={},
        changes=[{"path": "src/a.py"}, {"path": "src/b.py"}],
    )

    registry, _ = _registry()
    runner = HookRunner(registry)
    runner.emit(HookEvent.BEFORE_LOAD, HookContext(state_file=state_file))
    runner.emit(
        HookEvent.AFTER_STEP,
        HookContext(step_name="implement", delivery=delivery),
    )

    payload = json.loads(
        (state_file.parent / "decision-trace-implement.json").read_text()
    )
    assert payload["risk_class"] == "medium"


def test_explicit_output_dir_overrides_state_file_layout(tmp_path: Path) -> None:
    state_file = tmp_path / "work" / "W" / "state.json"
    state_file.parent.mkdir(parents=True)
    custom = tmp_path / "traces"

    registry = HookRegistry()
    DecisionTraceHook(output_dir=custom).register(registry)
    runner = HookRunner(registry)

    runner.emit(HookEvent.BEFORE_LOAD, HookContext(state_file=state_file))
    runner.emit(
        HookEvent.AFTER_STEP,
        HookContext(step_name="report", delivery=DeliveryState(ticket={})),
    )

    assert (custom / "decision-trace-report.json").exists()


def test_only_registers_on_listed_events() -> None:
    registry, _ = _registry()
    assert registry.for_event(HookEvent.BEFORE_LOAD)
    assert registry.for_event(HookEvent.AFTER_LOAD)
    assert registry.for_event(HookEvent.BEFORE_STEP)
    assert registry.for_event(HookEvent.AFTER_STEP)
    assert not registry.for_event(HookEvent.ON_HALT)
    assert not registry.for_event(HookEvent.ON_ERROR)
