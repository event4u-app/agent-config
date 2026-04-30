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
- the still-unimplemented set (``mixed``) raises ``NotImplementedError``
  from its ``get_steps()`` so the failure point is the loader, not a
  half-walked dispatch loop;
- ``ui`` is a Phase 1 routing-stub (R3) — ``get_steps()`` returns a step
  mapping whose ``refine`` handler emits a clean ``BLOCKED`` halt
  pointing at the deferred audit/design/apply track, and the set
  declares ``SUPPORTED_KINDS`` for every UI-classifiable input shape;
- ``ui-trivial`` is the R3 Phase 2 Step 6 short-circuit set —
  ``get_steps()`` returns a complete eight-step mapping whose
  ``implement`` slot enforces the trivial-edit hard preconditions and
  reclassifies to ``ui-improve`` on violation;
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
    assert_kind_supported,
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


def test_load_unimplemented_mixed_raises() -> None:
    """``mixed`` is still Phase 4 work in R3.

    ``ui`` was promoted to a Phase 1 routing-stub by R3 Phase 1 — see
    :func:`test_load_ui_returns_phase1_stub_steps`. ``ui-trivial`` was
    promoted to a complete directive set by R3 Phase 2 Step 6 — see
    :func:`test_load_ui_trivial_returns_full_step_mapping`.
    """
    with pytest.raises(NotImplementedError, match="not implemented in R1"):
        load_directive_set("mixed")


def test_load_ui_returns_phase1_stub_steps() -> None:
    """R3 Phase 1: ``ui.get_steps()`` returns a complete step mapping.

    The ``refine`` handler emits the clean ``BLOCKED`` halt; the
    seven downstream handlers are raise-on-call placeholders that
    only satisfy the dispatcher's completeness check.
    """
    steps = load_directive_set("ui")
    assert set(steps.keys()) == set(STEP_ORDER)
    for name, handler in steps.items():
        assert callable(handler), (
            f"handler for {name!r} must be callable per the Step protocol"
        )


def test_load_ui_trivial_returns_full_step_mapping() -> None:
    """R3 Phase 2 Step 6: ``ui-trivial.get_steps()`` returns the full mapping.

    The trivial path fills all eight slots: ``refine`` gates the intent,
    ``implement`` enforces the hard preconditions and reclassifies on
    violation, ``test`` delegates to a smoke run, ``report`` renders the
    one-line summary; the four bypassed slots delegate to a no-op
    handler that returns ``SUCCESS`` without touching state.
    """
    steps = load_directive_set("ui-trivial")
    assert set(steps.keys()) == set(STEP_ORDER)
    for name, handler in steps.items():
        assert callable(handler), (
            f"handler for {name!r} must be callable per the Step protocol"
        )


def test_load_rejects_unknown_set_name() -> None:
    with pytest.raises(ValueError, match="unknown directive_set"):
        load_directive_set("not-a-real-set")


def test_load_translates_hyphenated_wire_name_to_underscore_package() -> None:
    """``ui-trivial`` (schema) maps to ``ui_trivial`` (Python module).

    R3 Phase 2 Step 6 promoted ``ui-trivial`` from raise-stub to a
    complete directive set, so the loader now returns a real step
    mapping rather than raising — the assertion is that the wire-form
    name resolves to the underscore-named Python package without a
    ``ModuleNotFoundError`` (which would mean the translation broke).
    """
    steps = load_directive_set("ui-trivial")
    assert set(steps.keys()) == set(STEP_ORDER)


def test_assert_kind_supported_accepts_backend_ticket() -> None:
    """Backend declares ``ticket`` in ``SUPPORTED_KINDS`` — no raise."""
    assert_kind_supported("ticket", "backend") is None


def test_assert_kind_supported_accepts_backend_prompt() -> None:
    """R2 Phase 3 Step 3 wires ``prompt`` into backend's capability tuple."""
    assert_kind_supported("prompt", "backend") is None


def test_assert_kind_supported_rejects_backend_unknown_kind() -> None:
    """Kinds outside the schema whitelist (e.g. R3 ``diff``) still halt."""
    with pytest.raises(NotImplementedError, match="does not handle input.kind='design'"):
        assert_kind_supported("design", "backend")


def test_assert_kind_supported_message_lists_supported_kinds() -> None:
    with pytest.raises(NotImplementedError, match=r"supported kinds: \['prompt', 'ticket'\]"):
        assert_kind_supported("design", "backend")


def test_assert_kind_supported_rejects_unknown_set_name() -> None:
    """The kind gate validates the set name before importing."""
    with pytest.raises(ValueError, match="unknown directive_set"):
        assert_kind_supported("ticket", "not-a-real-set")


def test_assert_kind_supported_rejects_mixed_stub() -> None:
    """``mixed`` declares no ``SUPPORTED_KINDS``, so every kind is
    unsupported. The dispatcher halts here rather than advancing to
    ``load_directive_set`` and the stub's NotImplementedError.

    ``ui`` is no longer a raise-stub — see
    :func:`test_assert_kind_supported_accepts_ui_phase1_kinds`.
    ``ui-trivial`` is no longer a raise-stub — see
    :func:`test_assert_kind_supported_accepts_ui_trivial_kinds`.
    """
    with pytest.raises(NotImplementedError, match="does not handle input.kind"):
        assert_kind_supported("ticket", "mixed")


@pytest.mark.parametrize("kind", ["ticket", "prompt", "diff", "file"])
def test_assert_kind_supported_accepts_ui_phase1_kinds(kind: str) -> None:
    """R3 Phase 1: ``ui`` accepts every UI-classifiable input shape.

    The Phase 1 stub's ``refine`` handler then emits the clean refusal
    halt — but the kind gate must pass first so the routing decision
    surfaces in the halt, not in a config-error exit.
    """
    assert assert_kind_supported(kind, "ui") is None


@pytest.mark.parametrize("kind", ["ticket", "prompt", "diff", "file"])
def test_assert_kind_supported_accepts_ui_trivial_kinds(kind: str) -> None:
    """R3 Phase 2 Step 6: ``ui-trivial`` accepts every UI-classifiable kind.

    The trivial set inherits the same kind tuple as the full ``ui``
    set; the Phase 1 intent classifier reaches ``ui-trivial`` from any
    of the four input kinds and the trivial path's safety floor lives
    at ``implement``, not at the kind gate.
    """
    assert assert_kind_supported(kind, "ui-trivial") is None
