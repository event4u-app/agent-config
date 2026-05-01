"""Tests for :class:`work_engine.hooks.builtin.ChatHistoryAppendHook`."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

from work_engine.delivery_state import Outcome, StepResult
from work_engine.hooks import (
    ChatHistoryAppendHook,
    HookContext,
    HookEvent,
    HookRegistry,
    HookRunner,
)
from work_engine.state import Input, WorkState


def _make_runner(returncode: int = 0):
    captured: list[list[str]] = []

    def runner(cmd):
        captured.append(list(cmd))
        return subprocess.CompletedProcess(
            args=list(cmd), returncode=returncode, stdout="", stderr="",
        )

    return runner, captured


def _ctx(step: str, outcome: Outcome | None) -> HookContext:
    work = WorkState(input=Input(kind="prompt", data={"raw": "go"}))
    result = StepResult(outcome=outcome) if outcome is not None else None
    return HookContext(step_name=step, work=work, result=result)


def test_append_registers_only_after_step() -> None:
    registry = HookRegistry()
    runner, _ = _make_runner()
    ChatHistoryAppendHook(Path("s.py"), runner=runner).register(registry)
    assert registry.for_event(HookEvent.AFTER_STEP)
    for event in HookEvent:
        if event is HookEvent.AFTER_STEP:
            continue
        assert not registry.for_event(event)


def test_append_skips_when_no_result() -> None:
    runner, captured = _make_runner()
    registry = HookRegistry()
    ChatHistoryAppendHook(Path("s.py"), runner=runner).register(registry)
    HookRunner(registry).emit(HookEvent.AFTER_STEP, _ctx("plan", None))
    assert captured == []


def test_append_skips_blocked_outcome() -> None:
    runner, captured = _make_runner()
    registry = HookRegistry()
    ChatHistoryAppendHook(Path("s.py"), runner=runner).register(registry)
    HookRunner(registry).emit(HookEvent.AFTER_STEP, _ctx("plan", Outcome.BLOCKED))
    assert captured == []


def test_append_skips_partial_outcome() -> None:
    runner, captured = _make_runner()
    registry = HookRegistry()
    ChatHistoryAppendHook(Path("s.py"), runner=runner).register(registry)
    HookRunner(registry).emit(HookEvent.AFTER_STEP, _ctx("plan", Outcome.PARTIAL))
    assert captured == []


def test_append_writes_phase_entry_on_success() -> None:
    runner, captured = _make_runner()
    registry = HookRegistry()
    ChatHistoryAppendHook(Path("s.py"), runner=runner).register(registry)
    HookRunner(registry).emit(HookEvent.AFTER_STEP, _ctx("plan", Outcome.SUCCESS))
    assert len(captured) == 1
    cmd = captured[0]
    assert "append" in cmd
    assert "--type" in cmd
    type_idx = cmd.index("--type")
    assert cmd[type_idx + 1] == "phase"
    json_idx = cmd.index("--json")
    payload = json.loads(cmd[json_idx + 1])
    assert payload == {"step": "plan"}


def test_append_failure_warns() -> None:
    runner, _ = _make_runner(returncode=3)
    registry = HookRegistry()
    ChatHistoryAppendHook(Path("s.py"), runner=runner).register(registry)
    with pytest.warns(UserWarning, match="append failed"):
        HookRunner(registry).emit(
            HookEvent.AFTER_STEP, _ctx("plan", Outcome.SUCCESS)
        )


def test_append_unknown_step_falls_back_to_placeholder() -> None:
    runner, captured = _make_runner()
    registry = HookRegistry()
    ChatHistoryAppendHook(Path("s.py"), runner=runner).register(registry)
    work = WorkState(input=Input(kind="prompt", data={"raw": "go"}))
    ctx = HookContext(work=work, result=StepResult(outcome=Outcome.SUCCESS))
    HookRunner(registry).emit(HookEvent.AFTER_STEP, ctx)
    json_idx = captured[0].index("--json")
    payload = json.loads(captured[0][json_idx + 1])
    assert payload["step"] == "<unknown>"
