"""Tests for :class:`work_engine.hooks.registry.HookRegistry`.

Phase 1 scope: insertion-ordered registration, per-event isolation,
empty-registry behaviour. The registry is a plain container — no
callback invocation, no error handling. Those concerns belong to
:class:`work_engine.hooks.runner.HookRunner` and live in
``test_runner.py``.
"""
from __future__ import annotations

from work_engine.hooks import HookContext, HookEvent, HookRegistry


def _noop(_ctx: HookContext) -> None:
    return None


def test_empty_registry_returns_empty_tuple() -> None:
    registry = HookRegistry()
    assert registry.for_event(HookEvent.BEFORE_STEP) == ()


def test_register_single_callback() -> None:
    registry = HookRegistry()
    registry.register(HookEvent.BEFORE_STEP, _noop)
    callbacks = registry.for_event(HookEvent.BEFORE_STEP)
    assert callbacks == (_noop,)


def test_register_preserves_insertion_order() -> None:
    registry = HookRegistry()

    def first(_ctx: HookContext) -> None:
        return None

    def second(_ctx: HookContext) -> None:
        return None

    def third(_ctx: HookContext) -> None:
        return None

    registry.register(HookEvent.AFTER_STEP, first)
    registry.register(HookEvent.AFTER_STEP, second)
    registry.register(HookEvent.AFTER_STEP, third)

    assert registry.for_event(HookEvent.AFTER_STEP) == (first, second, third)


def test_per_event_isolation() -> None:
    registry = HookRegistry()
    registry.register(HookEvent.BEFORE_STEP, _noop)
    assert registry.for_event(HookEvent.AFTER_STEP) == ()
    assert registry.for_event(HookEvent.ON_HALT) == ()


def test_for_event_returns_tuple_not_list() -> None:
    """Defensive copy: callers must not be able to mutate the registry
    by appending to the return value of ``for_event``.
    """
    registry = HookRegistry()
    registry.register(HookEvent.BEFORE_STEP, _noop)
    result = registry.for_event(HookEvent.BEFORE_STEP)
    assert isinstance(result, tuple)


def test_events_iter_lists_registered_events_only() -> None:
    registry = HookRegistry()
    registry.register(HookEvent.BEFORE_STEP, _noop)
    registry.register(HookEvent.AFTER_SAVE, _noop)
    events = set(registry.events())
    assert events == {HookEvent.BEFORE_STEP, HookEvent.AFTER_SAVE}
