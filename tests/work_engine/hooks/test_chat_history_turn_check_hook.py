"""Tests for :class:`work_engine.hooks.builtin.ChatHistoryTurnCheckHook`."""
from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from work_engine.hooks import (
    ChatHistoryTurnCheckHook,
    HookContext,
    HookEvent,
    HookHalt,
    HookRegistry,
    HookRunner,
)
from work_engine.state import Input, WorkState


def _ctx_with_prompt(raw: str = "kick off the work") -> HookContext:
    work = WorkState(input=Input(kind="prompt", data={"raw": raw}))
    return HookContext(work=work, set_name="backend")


def _make_runner(returncode: int, stderr: str = "", stdout: str = ""):
    captured: list[list[str]] = []

    def runner(cmd):
        captured.append(list(cmd))
        return subprocess.CompletedProcess(
            args=list(cmd), returncode=returncode, stdout=stdout, stderr=stderr,
        )

    return runner, captured


def test_turn_check_registers_only_before_dispatch() -> None:
    registry = HookRegistry()
    runner, _ = _make_runner(0)
    ChatHistoryTurnCheckHook(Path("script.py"), runner=runner).register(registry)
    assert registry.for_event(HookEvent.BEFORE_DISPATCH)
    for event in HookEvent:
        if event is HookEvent.BEFORE_DISPATCH:
            continue
        assert not registry.for_event(event)


def test_turn_check_ok_passes_through() -> None:
    runner, captured = _make_runner(0)
    registry = HookRegistry()
    ChatHistoryTurnCheckHook(Path("script.py"), runner=runner).register(registry)
    HookRunner(registry).emit(HookEvent.BEFORE_DISPATCH, _ctx_with_prompt())
    assert len(captured) == 1
    assert "turn-check" in captured[0]
    assert "--first-user-msg" in captured[0]


def test_turn_check_missing_passes_through() -> None:
    runner, _ = _make_runner(10)
    registry = HookRegistry()
    ChatHistoryTurnCheckHook(Path("script.py"), runner=runner).register(registry)
    HookRunner(registry).emit(HookEvent.BEFORE_DISPATCH, _ctx_with_prompt())


def test_turn_check_foreign_returns_halt() -> None:
    runner, _ = _make_runner(11, stderr="ACTION REQUIRED: foreign")
    registry = HookRegistry()
    ChatHistoryTurnCheckHook(Path("script.py"), runner=runner).register(registry)
    halt = HookRunner(registry).emit(HookEvent.BEFORE_DISPATCH, _ctx_with_prompt())
    assert isinstance(halt, HookHalt)
    assert halt.reason == "chat_history_turn_check_foreign"
    assert halt.surface == ["ACTION REQUIRED: foreign"]


def test_turn_check_returning_returns_halt() -> None:
    runner, _ = _make_runner(12, stderr="ACTION REQUIRED: returning")
    registry = HookRegistry()
    ChatHistoryTurnCheckHook(Path("script.py"), runner=runner).register(registry)
    halt = HookRunner(registry).emit(HookEvent.BEFORE_DISPATCH, _ctx_with_prompt())
    assert isinstance(halt, HookHalt)
    assert halt.reason == "chat_history_turn_check_returning"
    assert halt.surface == ["ACTION REQUIRED: returning"]


def test_turn_check_foreign_multiline_surface_preserved() -> None:
    runner, _ = _make_runner(
        11,
        stderr="ACTION REQUIRED: foreign\n> 1. Adopt this session\n> 2. Reset",
    )
    registry = HookRegistry()
    ChatHistoryTurnCheckHook(Path("script.py"), runner=runner).register(registry)
    halt = HookRunner(registry).emit(HookEvent.BEFORE_DISPATCH, _ctx_with_prompt())
    assert isinstance(halt, HookHalt)
    assert halt.surface == [
        "ACTION REQUIRED: foreign",
        "> 1. Adopt this session",
        "> 2. Reset",
    ]


def test_turn_check_foreign_empty_text_falls_back_to_default_surface() -> None:
    runner, _ = _make_runner(11, stderr="", stdout="")
    registry = HookRegistry()
    ChatHistoryTurnCheckHook(Path("script.py"), runner=runner).register(registry)
    halt = HookRunner(registry).emit(HookEvent.BEFORE_DISPATCH, _ctx_with_prompt())
    assert isinstance(halt, HookHalt)
    assert halt.reason == "chat_history_turn_check_foreign"
    assert halt.surface == ["chat-history turn-check: foreign"]


def test_turn_check_unknown_exit_warns() -> None:
    runner, _ = _make_runner(7, stderr="oops")
    registry = HookRegistry()
    ChatHistoryTurnCheckHook(Path("script.py"), runner=runner).register(registry)
    with pytest.warns(UserWarning, match="exit 7"):
        HookRunner(registry).emit(HookEvent.BEFORE_DISPATCH, _ctx_with_prompt())


def test_turn_check_passes_first_user_msg_for_ticket() -> None:
    runner, captured = _make_runner(0)
    registry = HookRegistry()
    ChatHistoryTurnCheckHook(Path("s.py"), runner=runner).register(registry)
    work = WorkState(input=Input(kind="ticket", data={"id": "PROJ-1", "title": "Bug"}))
    HookRunner(registry).emit(HookEvent.BEFORE_DISPATCH, HookContext(work=work))
    msg_idx = captured[0].index("--first-user-msg")
    assert captured[0][msg_idx + 1] == "PROJ-1: Bug"


def test_turn_check_missing_input_warns() -> None:
    runner, _ = _make_runner(0)
    registry = HookRegistry()
    ChatHistoryTurnCheckHook(Path("s.py"), runner=runner).register(registry)
    with pytest.warns(UserWarning, match="cannot derive first-user-msg"):
        HookRunner(registry).emit(HookEvent.BEFORE_DISPATCH, HookContext())


def test_turn_check_fixed_first_user_msg_overrides() -> None:
    runner, captured = _make_runner(0)
    registry = HookRegistry()
    ChatHistoryTurnCheckHook(
        Path("s.py"), runner=runner, first_user_msg="pinned"
    ).register(registry)
    HookRunner(registry).emit(HookEvent.BEFORE_DISPATCH, _ctx_with_prompt())
    msg_idx = captured[0].index("--first-user-msg")
    assert captured[0][msg_idx + 1] == "pinned"
