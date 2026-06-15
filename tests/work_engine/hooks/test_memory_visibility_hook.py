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
    """Stand-in for :class:`WorkState` exposing the fields we read."""

    memory: list[dict[str, Any]] = field(default_factory=list)
    report: str = ""
    verify: Any = None
    questions: Any = None
    changes: Any = None
    applied_rules: Any = None
    test_plan: Any = None


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
    assert work.report.startswith("\U0001F9E0 Memory: 2/3 \u00b7 ids=[mem_1, mem_2]")


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


def test_auto_cadence_suppresses_below_threshold() -> None:
    runner, work = _runner(
        MemoryVisibilityHook(memory_cadence="auto", asked_types=("domain-invariants",))
    )
    work.memory = [{"id": "mem_1", "type": "domain-invariants"}]
    runner.emit(HookEvent.BEFORE_SAVE, HookContext(work=work))
    assert work.report == ""


def test_auto_cadence_emits_at_threshold() -> None:
    runner, work = _runner(MemoryVisibilityHook(memory_cadence="auto"))
    work.memory = [{"id": "mem_1", "type": "domain-invariants"}]
    runner.emit(HookEvent.BEFORE_SAVE, HookContext(work=work))
    assert "\U0001F9E0 Memory: 1/3 \u00b7 ids=[mem_1]" in work.report


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


# -- affected segment (P2.1b) -----------------------------------------


def test_affected_segment_surfaces_band_flip() -> None:
    runner, work = _runner(MemoryVisibilityHook())
    work.memory = [
        {"id": "mem_1", "type": "domain-invariants"},
        {"id": "mem_2", "type": "incident-learnings"},
    ]
    runner.emit(HookEvent.BEFORE_SAVE, HookContext(work=work))
    assert "\u00b7 affected: confidence_band" in work.report


def test_affected_segment_renders_none_when_consulted_but_no_divergence() -> None:
    runner, work = _runner(MemoryVisibilityHook())
    # One hit but verify already passes → band="medium" with-and-without
    work.memory = [{"id": "mem_1", "type": "domain-invariants"}]
    work.verify = {"claims": 1, "first_try_passes": 1}
    runner.emit(HookEvent.BEFORE_SAVE, HookContext(work=work))
    assert work.report.endswith("\u00b7 affected: none")


def test_affected_segment_omitted_when_no_memory_hits() -> None:
    runner, work = _runner(MemoryVisibilityHook())
    # Entry returned by retrieval but explicitly flagged hit=False —
    # the visibility summariser still sees a typed entry (asks > 0)
    # so the line emits, but trace-level memory_hits == 0 so the
    # `· affected: …` trailing segment is absent.
    work.memory = [
        {"id": "mem_1", "type": "domain-invariants", "hit": False},
    ]
    runner.emit(HookEvent.BEFORE_SAVE, HookContext(work=work))
    assert work.report
    assert "affected" not in work.report


def test_changed_decisions_block_appended_when_keys_diverged() -> None:
    runner, work = _runner(MemoryVisibilityHook())
    work.memory = [
        {"id": "mem_1", "type": "domain-invariants"},
        {"id": "mem_2", "type": "incident-learnings"},
    ]
    runner.emit(HookEvent.BEFORE_SAVE, HookContext(work=work))
    assert "Memory changed decisions:" in work.report
    assert "- mem_1 \u2192 confidence_band" in work.report
    assert "- mem_2 \u2192 confidence_band" in work.report


def test_changed_decisions_block_suppressed_when_no_divergence() -> None:
    runner, work = _runner(MemoryVisibilityHook())
    work.memory = [{"id": "mem_1", "type": "domain-invariants"}]
    work.verify = {"claims": 1, "first_try_passes": 1}
    runner.emit(HookEvent.BEFORE_SAVE, HookContext(work=work))
    assert "Memory changed decisions:" not in work.report


def test_changed_decisions_block_idempotent() -> None:
    runner, work = _runner(MemoryVisibilityHook())
    work.memory = [{"id": "mem_1", "type": "domain-invariants"}]
    ctx = HookContext(work=work)
    runner.emit(HookEvent.BEFORE_SAVE, ctx)
    once = work.report
    runner.emit(HookEvent.BEFORE_SAVE, ctx)
    assert work.report == once
