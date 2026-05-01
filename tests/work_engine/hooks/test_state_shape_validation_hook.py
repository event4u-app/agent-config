"""Tests for :class:`work_engine.hooks.builtin.StateShapeValidationHook`."""
from __future__ import annotations

from pathlib import Path

import pytest

from work_engine.hooks import (
    HookContext,
    HookEvent,
    HookRegistry,
    HookRunner,
    StateShapeValidationHook,
)
from work_engine.state import (
    DEFAULT_DIRECTIVE_SET,
    DEFAULT_INTENT,
    Input,
    WorkState,
)


def _build_state(**overrides) -> WorkState:
    defaults = dict(
        input=Input(kind="ticket", data={"id": "GT-1"}),
        intent=DEFAULT_INTENT,
        directive_set=DEFAULT_DIRECTIVE_SET,
    )
    defaults.update(overrides)
    return WorkState(**defaults)


def _registry() -> HookRegistry:
    registry = HookRegistry()
    StateShapeValidationHook().register(registry)
    return registry


def test_registers_on_after_load_and_before_save() -> None:
    registry = _registry()
    assert registry.for_event(HookEvent.AFTER_LOAD)
    assert registry.for_event(HookEvent.BEFORE_SAVE)
    assert not registry.for_event(HookEvent.BEFORE_DISPATCH)


def test_valid_state_passes_after_load() -> None:
    runner = HookRunner(_registry())
    runner.emit(
        HookEvent.AFTER_LOAD,
        HookContext(work=_build_state(), state_file=Path("dummy.json")),
    )


def test_valid_state_passes_before_save() -> None:
    runner = HookRunner(_registry())
    runner.emit(
        HookEvent.BEFORE_SAVE,
        HookContext(work=_build_state()),
    )


def test_invalid_directive_set_warns_on_after_load() -> None:
    state = _build_state()
    state.directive_set = "not-a-real-set"
    runner = HookRunner(_registry())

    with pytest.warns(UserWarning, match="state-shape validation failed"):
        runner.emit(
            HookEvent.AFTER_LOAD,
            HookContext(work=state, state_file=Path("dummy.json")),
        )


def test_invalid_input_kind_warns_on_before_save() -> None:
    state = _build_state(input=Input(kind="bogus", data={}))
    runner = HookRunner(_registry())

    with pytest.warns(UserWarning, match="state-shape validation failed"):
        runner.emit(
            HookEvent.BEFORE_SAVE,
            HookContext(work=state),
        )


def test_missing_work_warns() -> None:
    runner = HookRunner(_registry())

    with pytest.warns(UserWarning, match="HookContext.work is None"):
        runner.emit(
            HookEvent.AFTER_LOAD,
            HookContext(state_file=Path("dummy.json")),
        )
