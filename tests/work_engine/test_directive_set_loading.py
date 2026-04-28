"""Contract tests for directive-set selection and loading.

R1 Phase 4 Step 2 introduced :func:`work_engine.dispatcher.select_directive_set`
and :func:`work_engine.dispatcher.load_directive_set` so the dispatcher can
route between multiple directive bundles (``backend``, future ``ui``,
``ui-trivial``, ``mixed``). These tests pin the contract:

- ``select_directive_set`` defaults to ``"backend"`` for v0 state objects
  that do not carry a ``directive_set`` attribute, and round-trips a v1
  ``WorkState`` value untouched;
- ``load_directive_set("backend")`` returns the canonical
  ``{step_name: handler}`` mapping the dispatcher walks (every entry in
  ``STEP_ORDER`` present);
- the unimplemented sets (``ui``, ``ui-trivial``, ``mixed``) raise
  ``NotImplementedError`` from their ``get_steps()`` so the failure point
  is the loader, not a half-walked dispatch loop;
- unknown set names and malformed ``directive_set`` values raise
  ``ValueError`` immediately rather than producing surprising behavior.
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from work_engine.delivery_state import DeliveryState
from work_engine.dispatcher import (
    DEFAULT_DIRECTIVE_SET,
    STEP_ORDER,
    load_directive_set,
    select_directive_set,
)


def test_select_defaults_to_backend_for_v0_state() -> None:
    """A v0 :class:`DeliveryState` has no ``directive_set`` field."""
    state = DeliveryState(ticket={"id": "T-1", "title": "x", "acceptance_criteria": []})
    assert select_directive_set(state) == DEFAULT_DIRECTIVE_SET == "backend"


def test_select_round_trips_explicit_value() -> None:
    """A v1-shaped state with ``directive_set`` carries through unchanged."""
    state = SimpleNamespace(directive_set="backend")
    assert select_directive_set(state) == "backend"


def test_select_rejects_unknown_value() -> None:
    state = SimpleNamespace(directive_set="not-a-real-set")
    with pytest.raises(ValueError, match="unknown directive_set"):
        select_directive_set(state)


def test_select_rejects_non_string() -> None:
    state = SimpleNamespace(directive_set=123)
    with pytest.raises(ValueError, match="must be a non-empty string"):
        select_directive_set(state)


def test_select_rejects_empty_string() -> None:
    state = SimpleNamespace(directive_set="")
    with pytest.raises(ValueError, match="must be a non-empty string"):
        select_directive_set(state)


def test_load_backend_returns_full_step_mapping() -> None:
    steps = load_directive_set("backend")
    assert set(steps.keys()) == set(STEP_ORDER)
    for name, handler in steps.items():
        assert callable(handler), (
            f"handler for {name!r} must be callable per the Step protocol"
        )


@pytest.mark.parametrize("set_name", ["ui", "ui-trivial", "mixed"])
def test_load_unimplemented_sets_raise(set_name: str) -> None:
    with pytest.raises(NotImplementedError, match="not implemented in R1"):
        load_directive_set(set_name)


def test_load_rejects_unknown_set_name() -> None:
    with pytest.raises(ValueError, match="unknown directive_set"):
        load_directive_set("not-a-real-set")


def test_load_translates_hyphenated_wire_name_to_underscore_package() -> None:
    """``ui-trivial`` (schema) maps to ``ui_trivial`` (Python module)."""
    # The loader translates correctly even though the underlying module
    # raises NotImplementedError; we expect that exception type, not
    # ModuleNotFoundError, which would mean the translation broke.
    with pytest.raises(NotImplementedError):
        load_directive_set("ui-trivial")
