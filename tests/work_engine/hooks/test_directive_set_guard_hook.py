"""Tests for :class:`work_engine.hooks.builtin.DirectiveSetGuardHook`."""
from __future__ import annotations

import pytest

from work_engine.hooks import (
    DirectiveSetGuardHook,
    HookContext,
    HookEvent,
    HookRegistry,
    HookRunner,
)
from work_engine.state import (
    DEFAULT_DIRECTIVE_SET,
    DEFAULT_INTENT,
    Input,
    WorkState,
)


def _build_state(directive_set: str = DEFAULT_DIRECTIVE_SET) -> WorkState:
    return WorkState(
        input=Input(kind="ticket", data={"id": "GT-1"}),
        intent=DEFAULT_INTENT,
        directive_set=directive_set,
    )


def _registry() -> HookRegistry:
    registry = HookRegistry()
    DirectiveSetGuardHook().register(registry)
    return registry


def test_registers_only_on_before_dispatch() -> None:
    registry = _registry()
    assert registry.for_event(HookEvent.BEFORE_DISPATCH)
    assert not registry.for_event(HookEvent.AFTER_LOAD)
    assert not registry.for_event(HookEvent.AFTER_DISPATCH)


def test_matching_set_passes() -> None:
    runner = HookRunner(_registry())
    runner.emit(
        HookEvent.BEFORE_DISPATCH,
        HookContext(
            work=_build_state(directive_set="backend"),
            set_name="backend",
        ),
    )


def test_drift_warns() -> None:
    runner = HookRunner(_registry())

    with pytest.warns(UserWarning, match="directive-set drift"):
        runner.emit(
            HookEvent.BEFORE_DISPATCH,
            HookContext(
                work=_build_state(directive_set="ui"),
                set_name="backend",
            ),
        )


def test_missing_set_name_warns() -> None:
    runner = HookRunner(_registry())

    with pytest.warns(UserWarning, match="missing set_name or work"):
        runner.emit(
            HookEvent.BEFORE_DISPATCH,
            HookContext(work=_build_state()),
        )


def test_missing_work_warns() -> None:
    runner = HookRunner(_registry())

    with pytest.warns(UserWarning, match="missing set_name or work"):
        runner.emit(
            HookEvent.BEFORE_DISPATCH,
            HookContext(set_name="backend"),
        )


def test_legacy_state_without_directive_set_field_is_no_op() -> None:
    """Stand-in for v0 envelopes: a work object with no directive_set attr."""

    class Legacy:
        pass

    runner = HookRunner(_registry())
    runner.emit(
        HookEvent.BEFORE_DISPATCH,
        HookContext(work=Legacy(), set_name="backend"),
    )
