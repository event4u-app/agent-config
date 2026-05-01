"""Tests for :class:`work_engine.hooks.builtin.ChatHistoryHaltAppendHook`."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

from work_engine.delivery_state import Outcome, StepResult
from work_engine.hooks import (
    ChatHistoryHaltAppendHook,
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


def _make_ctx(*, questions_on_result=None, questions_on_work=None) -> HookContext:
    work = WorkState(input=Input(kind="prompt", data={"raw": "go"}))
    if questions_on_work is not None:
        work.questions = list(questions_on_work)
    result = StepResult(outcome=Outcome.BLOCKED, questions=questions_on_result or [])
    return HookContext(step_name="refine", work=work, result=result)


def test_halt_append_registers_only_on_halt() -> None:
    registry = HookRegistry()
    runner, _ = _make_runner()
    ChatHistoryHaltAppendHook(Path("s.py"), runner=runner).register(registry)
    assert registry.for_event(HookEvent.ON_HALT)
    for event in HookEvent:
        if event is HookEvent.ON_HALT:
            continue
        assert not registry.for_event(event)


def test_halt_append_writes_decision_entry() -> None:
    runner, captured = _make_runner()
    registry = HookRegistry()
    ChatHistoryHaltAppendHook(Path("s.py"), runner=runner).register(registry)
    ctx = _make_ctx(questions_on_result=["1. yes", "2. no"])
    HookRunner(registry).emit(HookEvent.ON_HALT, ctx)
    assert len(captured) == 1
    cmd = captured[0]
    type_idx = cmd.index("--type")
    assert cmd[type_idx + 1] == "decision"
    json_idx = cmd.index("--json")
    payload = json.loads(cmd[json_idx + 1])
    assert payload == {"step": "refine", "questions": ["1. yes", "2. no"]}


def test_halt_append_pulls_questions_from_work_when_result_empty() -> None:
    runner, captured = _make_runner()
    registry = HookRegistry()
    ChatHistoryHaltAppendHook(Path("s.py"), runner=runner).register(registry)
    work = WorkState(input=Input(kind="prompt", data={"raw": "go"}))
    work.questions = ["1. fallback"]
    ctx = HookContext(step_name="refine", work=work, delivery=work, result=None)
    HookRunner(registry).emit(HookEvent.ON_HALT, ctx)
    json_idx = captured[0].index("--json")
    payload = json.loads(captured[0][json_idx + 1])
    assert payload["questions"] == ["1. fallback"]


def test_halt_append_handles_no_questions() -> None:
    runner, captured = _make_runner()
    registry = HookRegistry()
    ChatHistoryHaltAppendHook(Path("s.py"), runner=runner).register(registry)
    HookRunner(registry).emit(HookEvent.ON_HALT, _make_ctx())
    json_idx = captured[0].index("--json")
    payload = json.loads(captured[0][json_idx + 1])
    assert payload["questions"] == []


def test_halt_append_failure_warns() -> None:
    runner, _ = _make_runner(returncode=3)
    registry = HookRegistry()
    ChatHistoryHaltAppendHook(Path("s.py"), runner=runner).register(registry)
    with pytest.warns(UserWarning, match="halt-append failed"):
        HookRunner(registry).emit(HookEvent.ON_HALT, _make_ctx())
