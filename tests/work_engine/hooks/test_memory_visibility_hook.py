"""Tests for :class:`work_engine.hooks.builtin.MemoryVisibilityHook`."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from work_engine.hooks import (
    HookContext,
    HookEvent,
    HookRegistry,
    HookRunner,
    MemoryVisibilityHook,
)


@dataclass
class _FakeWork:
    """Stand-in for :class:`WorkState` exposing the two fields we read."""

    memory: list[dict[str, Any]] = field(default_factory=list)
    report: str = ""


def _runner(hook: MemoryVisibilityHook) -> tuple[HookRunner, _FakeWork]:
    registry = HookRegistry()
    hook.register(registry)
    return HookRunner(registry), _FakeWork()


def test_emits_visibility_line_on_before_save() -> None:
    runner, work = _runner(MemoryVisibilityHook())
    work.memory = [
        {"id": "mem_1", "type": "domain-invariants"},
        {"id": "mem_2", "type": "incident-learnings"},
    ]
    runner.emit(HookEvent.BEFORE_SAVE, HookContext(work=work))
    assert work.report.startswith("\U0001F9E0 Memory: 2/4 \u00b7 ids=[mem_1, mem_2]")


def test_appends_after_existing_report_with_blank_line() -> None:
    runner, work = _runner(MemoryVisibilityHook())
    work.memory = [{"id": "mem_1", "type": "domain-invariants"}]
    work.report = "## Existing report\n\nbody"
    runner.emit(HookEvent.BEFORE_SAVE, HookContext(work=work))
    assert work.report.startswith("## Existing report")
    assert "\n\n\U0001F9E0 Memory:" in work.report


def test_idempotent_when_line_already_present() -> None:
    runner, work = _runner(MemoryVisibilityHook())
    work.memory = [{"id": "mem_1", "type": "domain-invariants"}]
    ctx = HookContext(work=work)
    runner.emit(HookEvent.BEFORE_SAVE, ctx)
    once = work.report
    runner.emit(HookEvent.BEFORE_SAVE, ctx)
    assert work.report == once


def test_silent_when_memory_empty() -> None:
    runner, work = _runner(MemoryVisibilityHook())
    runner.emit(HookEvent.BEFORE_SAVE, HookContext(work=work))
    assert work.report == ""


def test_silent_when_visibility_off() -> None:
    runner, work = _runner(MemoryVisibilityHook(visibility_off=True))
    work.memory = [{"id": "mem_1", "type": "domain-invariants"}]
    runner.emit(HookEvent.BEFORE_SAVE, HookContext(work=work))
    assert work.report == ""


def test_lean_profile_suppresses_below_threshold() -> None:
    runner, work = _runner(
        MemoryVisibilityHook(cost_profile="lean", asked_types=("domain-invariants",))
    )
    work.memory = [{"id": "mem_1", "type": "domain-invariants"}]
    runner.emit(HookEvent.BEFORE_SAVE, HookContext(work=work))
    assert work.report == ""


def test_lean_profile_emits_at_threshold() -> None:
    runner, work = _runner(MemoryVisibilityHook(cost_profile="lean"))
    work.memory = [{"id": "mem_1", "type": "domain-invariants"}]
    runner.emit(HookEvent.BEFORE_SAVE, HookContext(work=work))
    assert "\U0001F9E0 Memory: 1/4 \u00b7 ids=[mem_1]" in work.report


def test_silent_when_work_is_none() -> None:
    runner, _ = _runner(MemoryVisibilityHook())
    runner.emit(HookEvent.BEFORE_SAVE, HookContext(work=None))


def test_only_registers_on_before_save() -> None:
    registry = HookRegistry()
    MemoryVisibilityHook().register(registry)
    assert registry.for_event(HookEvent.BEFORE_SAVE)
    assert not registry.for_event(HookEvent.AFTER_DISPATCH)
    assert not registry.for_event(HookEvent.AFTER_STEP)
    assert not registry.for_event(HookEvent.ON_HALT)
