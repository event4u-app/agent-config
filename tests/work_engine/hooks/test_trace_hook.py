"""Tests for :class:`work_engine.hooks.builtin.TraceHook`."""
from __future__ import annotations

import io

import pytest

from work_engine.delivery_state import Outcome, StepResult
from work_engine.hooks import (
    HookContext,
    HookEvent,
    HookRegistry,
    HookRunner,
    TraceHook,
)


def test_trace_registers_on_every_event() -> None:
    registry = HookRegistry()
    TraceHook(stream=io.StringIO()).register(registry)
    for event in HookEvent:
        assert registry.for_event(event), f"no callback for {event}"


def test_trace_emits_one_line_per_event() -> None:
    sink = io.StringIO()
    registry = HookRegistry()
    TraceHook(stream=sink).register(registry)
    runner = HookRunner(registry)

    runner.emit(HookEvent.BEFORE_STEP, HookContext(step_name="plan"))
    runner.emit(
        HookEvent.AFTER_STEP,
        HookContext(
            step_name="plan",
            result=StepResult(outcome=Outcome.SUCCESS),
        ),
    )

    lines = sink.getvalue().strip().splitlines()
    assert len(lines) == 2
    assert "event=before_step" in lines[0]
    assert "step=plan" in lines[0]
    assert "event=after_step" in lines[1]
    assert "outcome=success" in lines[1]


def test_trace_includes_set_name_and_final() -> None:
    sink = io.StringIO()
    registry = HookRegistry()
    TraceHook(stream=sink).register(registry)
    runner = HookRunner(registry)

    runner.emit(
        HookEvent.AFTER_DISPATCH,
        HookContext(set_name="backend", final=Outcome.SUCCESS),
    )

    out = sink.getvalue()
    assert "set=backend" in out
    assert "final=success" in out


def test_trace_includes_exception_type_on_error() -> None:
    sink = io.StringIO()
    registry = HookRegistry()
    TraceHook(stream=sink).register(registry)
    runner = HookRunner(registry)

    runner.emit(
        HookEvent.ON_ERROR,
        HookContext(step_name="plan", exception=RuntimeError("boom")),
    )

    assert "exception=RuntimeError" in sink.getvalue()


def test_trace_custom_prefix() -> None:
    sink = io.StringIO()
    registry = HookRegistry()
    TraceHook(stream=sink, prefix="[dbg]").register(registry)
    runner = HookRunner(registry)

    runner.emit(HookEvent.BEFORE_STEP, HookContext(step_name="plan"))

    assert sink.getvalue().startswith("[dbg]")


def test_trace_broken_stream_surfaces_hook_error() -> None:
    """A closed stream raises HookError, which the runner converts to a warning."""
    closed = io.StringIO()
    closed.close()
    registry = HookRegistry()
    TraceHook(stream=closed).register(registry)
    runner = HookRunner(registry)

    with pytest.warns(UserWarning, match="trace stream unavailable"):
        runner.emit(HookEvent.BEFORE_STEP, HookContext(step_name="plan"))
