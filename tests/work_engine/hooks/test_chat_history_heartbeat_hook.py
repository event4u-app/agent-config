"""Tests for :class:`work_engine.hooks.builtin.ChatHistoryHeartbeatHook`."""
from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from work_engine.hooks import (
    ChatHistoryHeartbeatHook,
    HookContext,
    HookEvent,
    HookRegistry,
    HookRunner,
)
from work_engine.state import Input, WorkState


def _make_runner(returncode: int = 0, stdout: str = ""):
    captured: list[list[str]] = []

    def runner(cmd):
        captured.append(list(cmd))
        return subprocess.CompletedProcess(
            args=list(cmd), returncode=returncode, stdout=stdout, stderr="",
        )

    return runner, captured


def _ctx(report: str = "") -> HookContext:
    work = WorkState(input=Input(kind="prompt", data={"raw": "go"}))
    work.report = report
    return HookContext(work=work)


def test_heartbeat_registers_only_after_dispatch() -> None:
    registry = HookRegistry()
    runner, _ = _make_runner()
    ChatHistoryHeartbeatHook(Path("s.py"), runner=runner).register(registry)
    assert registry.for_event(HookEvent.AFTER_DISPATCH)
    for event in HookEvent:
        if event is HookEvent.AFTER_DISPATCH:
            continue
        assert not registry.for_event(event)


def test_heartbeat_threads_marker_into_empty_report() -> None:
    runner, _ = _make_runner(stdout="📒 chat-history: ok · per_phase\n")
    registry = HookRegistry()
    ChatHistoryHeartbeatHook(Path("s.py"), runner=runner).register(registry)
    ctx = _ctx()
    HookRunner(registry).emit(HookEvent.AFTER_DISPATCH, ctx)
    assert ctx.work.report == "📒 chat-history: ok · per_phase"


def test_heartbeat_appends_marker_to_existing_report() -> None:
    runner, _ = _make_runner(stdout="📒 chat-history: ok\n")
    registry = HookRegistry()
    ChatHistoryHeartbeatHook(Path("s.py"), runner=runner).register(registry)
    ctx = _ctx(report="Done.")
    HookRunner(registry).emit(HookEvent.AFTER_DISPATCH, ctx)
    assert ctx.work.report == "Done.\n\n📒 chat-history: ok"


def test_heartbeat_idempotent_when_marker_already_present() -> None:
    runner, _ = _make_runner(stdout="📒 chat-history: ok\n")
    registry = HookRegistry()
    ChatHistoryHeartbeatHook(Path("s.py"), runner=runner).register(registry)
    ctx = _ctx(report="📒 chat-history: ok")
    HookRunner(registry).emit(HookEvent.AFTER_DISPATCH, ctx)
    assert ctx.work.report == "📒 chat-history: ok"


def test_heartbeat_silent_marker_does_nothing() -> None:
    runner, _ = _make_runner(stdout="")
    registry = HookRegistry()
    ChatHistoryHeartbeatHook(Path("s.py"), runner=runner).register(registry)
    ctx = _ctx(report="Done.")
    HookRunner(registry).emit(HookEvent.AFTER_DISPATCH, ctx)
    assert ctx.work.report == "Done."


def test_heartbeat_failure_warns_without_touching_report() -> None:
    runner, _ = _make_runner(returncode=3)
    registry = HookRegistry()
    ChatHistoryHeartbeatHook(Path("s.py"), runner=runner).register(registry)
    ctx = _ctx(report="Done.")
    with pytest.warns(UserWarning, match="heartbeat failed"):
        HookRunner(registry).emit(HookEvent.AFTER_DISPATCH, ctx)
    assert ctx.work.report == "Done."


def test_heartbeat_no_work_state_skips_silently() -> None:
    runner, _ = _make_runner(stdout="📒 ok\n")
    registry = HookRegistry()
    ChatHistoryHeartbeatHook(
        Path("s.py"), runner=runner, first_user_msg="pinned",
    ).register(registry)
    HookRunner(registry).emit(HookEvent.AFTER_DISPATCH, HookContext())
