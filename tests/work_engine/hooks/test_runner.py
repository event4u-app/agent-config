"""Tests for :class:`work_engine.hooks.runner.HookRunner`.

Covers the three-tier error contract documented in
``work_engine/hooks/exceptions.py``:

- ``HookError``    \u2192 caught, ``warnings.warn`` issued, next callback fires
- ``HookHalt``     \u2192 caught, returned to caller, no further callbacks fire
- any ``Exception`` \u2192 propagates verbatim
"""
from __future__ import annotations

import warnings

import pytest

from work_engine.hooks import (
    HookContext,
    HookError,
    HookEvent,
    HookHalt,
    HookRegistry,
    HookRunner,
)


def test_emit_no_hooks_registered_returns_none() -> None:
    runner = HookRunner()
    assert runner.emit(HookEvent.BEFORE_STEP, HookContext()) is None


def test_emit_single_hook_fires_once() -> None:
    calls: list[str] = []

    def hook(_ctx: HookContext) -> None:
        calls.append("fired")

    registry = HookRegistry()
    registry.register(HookEvent.BEFORE_STEP, hook)
    runner = HookRunner(registry)

    result = runner.emit(HookEvent.BEFORE_STEP, HookContext())

    assert result is None
    assert calls == ["fired"]


def test_emit_preserves_registration_order() -> None:
    calls: list[str] = []

    def first(_ctx: HookContext) -> None:
        calls.append("first")

    def second(_ctx: HookContext) -> None:
        calls.append("second")

    def third(_ctx: HookContext) -> None:
        calls.append("third")

    registry = HookRegistry()
    for cb in (first, second, third):
        registry.register(HookEvent.AFTER_STEP, cb)
    runner = HookRunner(registry)

    runner.emit(HookEvent.AFTER_STEP, HookContext())
    assert calls == ["first", "second", "third"]


def test_hook_error_is_swallowed_and_warned() -> None:
    calls: list[str] = []

    def failing(_ctx: HookContext) -> None:
        calls.append("failing")
        raise HookError("transient failure")

    def trailing(_ctx: HookContext) -> None:
        calls.append("trailing")

    registry = HookRegistry()
    registry.register(HookEvent.AFTER_STEP, failing)
    registry.register(HookEvent.AFTER_STEP, trailing)
    runner = HookRunner(registry)

    with warnings.catch_warnings(record=True) as captured:
        warnings.simplefilter("always")
        result = runner.emit(HookEvent.AFTER_STEP, HookContext())

    assert result is None
    assert calls == ["failing", "trailing"]
    assert len(captured) == 1
    assert "HookError" in str(captured[0].message)
    assert "transient failure" in str(captured[0].message)


def test_hook_halt_short_circuits_and_returns() -> None:
    calls: list[str] = []

    def first(_ctx: HookContext) -> None:
        calls.append("first")

    def halting(_ctx: HookContext) -> None:
        calls.append("halting")
        raise HookHalt("foreign", surface=["> 1. adopt", "> 2. reset"])

    def trailing(_ctx: HookContext) -> None:
        calls.append("trailing")

    registry = HookRegistry()
    for cb in (first, halting, trailing):
        registry.register(HookEvent.BEFORE_DISPATCH, cb)
    runner = HookRunner(registry)

    result = runner.emit(HookEvent.BEFORE_DISPATCH, HookContext())

    assert isinstance(result, HookHalt)
    assert result.reason == "foreign"
    assert result.surface == ["> 1. adopt", "> 2. reset"]
    assert calls == ["first", "halting"]


def test_unexpected_exception_propagates() -> None:
    def buggy(_ctx: HookContext) -> None:
        raise RuntimeError("hook implementation bug")

    registry = HookRegistry()
    registry.register(HookEvent.ON_ERROR, buggy)
    runner = HookRunner(registry)

    with pytest.raises(RuntimeError, match="hook implementation bug"):
        runner.emit(HookEvent.ON_ERROR, HookContext())


def test_runner_default_constructs_empty_registry() -> None:
    runner = HookRunner()
    assert runner.registry.for_event(HookEvent.BEFORE_STEP) == ()
