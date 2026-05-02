"""Linear step dispatcher for ``/implement-ticket``.

The dispatcher holds no business logic. It walks the fixed eight-step
order declared in ``docs/contracts/implement-ticket-flow.md``, hands
each step a live ``DeliveryState``, and honours the three terminal
outcomes:

- ``SUCCESS`` — record and advance.
- ``BLOCKED`` — record, copy questions onto the state, halt.
- ``PARTIAL`` — record, copy questions onto the state, halt.

Resumption semantics (Option A, flow contract §agent-directives):
steps whose name is already marked ``success`` in
``state.outcomes`` are **skipped**. This lets a caller re-invoke the
dispatcher after executing an agent-directive (the ``implement``,
``test``, ``verify`` steps cannot run from pure Python), update the
relevant slice of ``DeliveryState``, record ``success`` on the
resumed step, and continue without replaying earlier work.

Step handlers are injected by the caller rather than discovered at
import time. Phase 1 shipped the dispatcher with mock handlers;
Phase 2 wires the real ones under ``steps/``. Keeping injection
explicit means the dispatcher is trivially testable and never
depends on handler import order.
"""
from __future__ import annotations

from collections.abc import Mapping
from importlib import import_module
from typing import Any

from .delivery_state import DeliveryState, Outcome, Step, StepResult
from .hooks import HookContext, HookEvent, HookHalt, HookRunner
from .state import KNOWN_DIRECTIVE_SETS

_NOOP_RUNNER: HookRunner = HookRunner()
"""Shared empty-registry runner reused when ``dispatch`` is called
without an explicit ``hooks`` argument. ``HookRunner.emit`` short-circuits
when no callbacks are registered, so the hot path stays branch-light
while the call sites stay uniform."""

STEP_ORDER: tuple[str, ...] = (
    "refine",
    "memory",
    "analyze",
    "plan",
    "implement",
    "test",
    "verify",
    "report",
)
"""Canonical execution order. Eight steps, fixed, no branching.

Changing this order is a roadmap-level decision — not a PR rider — per
the surface-growth guardrails in
``agents/roadmaps/road-to-implement-ticket.md``.
"""

DEFAULT_DIRECTIVE_SET: str = "backend"
"""Directive set chosen when ``state`` does not carry one explicitly.

Backwards compatibility for v0 ``DeliveryState`` callers: the legacy
shape has no ``directive_set`` field, so ``select_directive_set``
falls back to ``"backend"`` and the engine behaves exactly as it did
before R1 Phase 4.
"""

# Schema enum names use hyphens (``ui-trivial``) but Python packages
# cannot. The loader is the single place that bridges between the two
# forms; everywhere else uses the wire form.
_PACKAGE_NAME_OVERRIDES: Mapping[str, str] = {"ui-trivial": "ui_trivial"}


def dispatch(
    state: DeliveryState,
    steps: Mapping[str, Step],
    hooks: HookRunner | None = None,
) -> tuple[Outcome, str | None]:
    """Run the eight steps linearly against ``state``.

    Returns a ``(final_outcome, halting_step)`` tuple. ``halting_step``
    is ``None`` when every step succeeded; otherwise it carries the
    name of the step whose result halted the flow.

    Parameters
    ----------
    state:
        Live ``DeliveryState``. Mutated in place: each step's outcome
        is recorded in ``state.outcomes`` under the step name, and
        any surfaced questions land on ``state.questions``.
    steps:
        Mapping from step name to handler. Every entry in
        :data:`STEP_ORDER` must be present; missing entries raise
        ``KeyError`` at dispatch time rather than silently skipping,
        so incomplete wiring surfaces as a hard failure.
    hooks:
        Optional :class:`HookRunner` carrying a registry of dispatcher-
        layer hooks (``before_step``, ``after_step``, ``on_halt``,
        ``on_error``). Default ``None`` preserves every existing call
        site verbatim — internally ``dispatch`` falls back to a shared
        empty-registry runner so hook bookkeeping stays uniform without
        a per-emit ``if hooks is None`` branch.

    Raises
    ------
    KeyError
        If ``steps`` does not cover every entry in
        :data:`STEP_ORDER`.
    """
    _assert_all_steps_present(steps)

    # Clear stale questions from a previous halt before we resume so
    # the caller never mistakes old options for fresh ones.
    state.questions = []

    runner = hooks if hooks is not None else _NOOP_RUNNER

    for name in STEP_ORDER:
        if state.outcomes.get(name) == Outcome.SUCCESS.value:
            # Already completed on an earlier invocation — skip per the
            # resume contract. The caller is responsible for keeping
            # ``state.outcomes`` and the matching slice in sync.
            continue

        before_halt = runner.emit(
            HookEvent.BEFORE_STEP,
            HookContext(step_name=name, delivery=state),
        )
        if before_halt is not None:
            return _hook_halt_blocked(state, runner, name, before_halt, result=None)

        handler = steps[name]
        try:
            result = handler(state)
        except Exception as exc:
            # Let dispatcher-layer observers see the failure before the
            # exception unwinds the engine. ``on_error`` is observe-only;
            # the original exception is always re-raised.
            runner.emit(
                HookEvent.ON_ERROR,
                HookContext(step_name=name, delivery=state, exception=exc),
            )
            raise
        _validate_step_result(name, result)

        state.outcomes[name] = result.outcome.value

        after_halt = runner.emit(
            HookEvent.AFTER_STEP,
            HookContext(step_name=name, delivery=state, result=result),
        )
        if after_halt is not None:
            return _hook_halt_blocked(state, runner, name, after_halt, result=result)

        if result.outcome is Outcome.BLOCKED:
            state.questions = list(result.questions)
            _emit_on_halt(runner, name, state, result)
            return Outcome.BLOCKED, name

        if result.outcome is Outcome.PARTIAL:
            state.questions = list(result.questions)
            _emit_on_halt(runner, name, state, result)
            return Outcome.PARTIAL, name

    return Outcome.SUCCESS, None


def _hook_halt_blocked(
    state: DeliveryState,
    runner: HookRunner,
    name: str,
    halt: HookHalt,
    result: StepResult | None,
) -> tuple[Outcome, str | None]:
    """Translate a hook-driven :class:`HookHalt` into a clean engine halt.

    Hook-driven halts are treated as first-class engine halts per the
    P2 contract: the dispatcher returns ``(BLOCKED, step_name)`` with
    ``state.questions`` rendered verbatim from the halt's ``surface``.
    The step's outcome marker is set to ``"blocked"`` only when the
    halt fires before the handler ran (so resume re-enters the gate);
    when it fires after the handler, the marker the handler produced
    is preserved so resume reflects what actually happened.
    """
    if result is None:
        state.outcomes[name] = Outcome.BLOCKED.value
    state.questions = list(halt.surface)
    _emit_on_halt(runner, name, state, result)
    return Outcome.BLOCKED, name


def _emit_on_halt(
    runner: HookRunner,
    name: str,
    state: DeliveryState,
    result: StepResult | None,
) -> None:
    """Fire ``on_halt`` as an observe-only event.

    A :class:`HookHalt` raised from inside ``on_halt`` would create a
    halt-of-a-halt loop; the runner returns it but the dispatcher
    deliberately ignores it — the halt surface is already populated.
    """
    runner.emit(
        HookEvent.ON_HALT,
        HookContext(step_name=name, delivery=state, result=result),
    )


def _assert_all_steps_present(steps: Mapping[str, Step]) -> None:
    """Reject an incomplete step mapping up front.

    We deliberately fail loudly here: a missing step would otherwise
    raise deep inside the dispatch loop after partial state mutation,
    which makes debugging the wiring harder than it needs to be.
    """
    missing = [name for name in STEP_ORDER if name not in steps]
    if missing:
        raise KeyError(
            "Step mapping is missing handlers for: " + ", ".join(missing),
        )


def _validate_step_result(name: str, result: StepResult) -> None:
    """Enforce the blocked/partial invariant: questions must be set.

    A step that blocks without surfacing a question is a bug — there
    is nothing for the user to answer. We raise ``ValueError`` instead
    of silently recording the outcome so the defect is visible at the
    earliest possible point.
    """
    if result.outcome in (Outcome.BLOCKED, Outcome.PARTIAL) and not result.questions:
        raise ValueError(
            f"Step {name!r} returned {result.outcome.value} with no questions; "
            "blocked and partial outcomes must surface at least one numbered option.",
        )


def select_directive_set(state: Any) -> str:
    """Return the directive set name to dispatch ``state`` against.

    Looks for ``state.directive_set`` (the v1 :class:`work_engine.state.WorkState`
    field) and falls back to :data:`DEFAULT_DIRECTIVE_SET` when the
    attribute is missing — the legacy v0 :class:`DeliveryState` has no
    such field, and existing callers must keep working unchanged
    until R1 Phase 4 Step 1 lands the runtime switch.

    The returned name is validated against :data:`KNOWN_DIRECTIVE_SETS`;
    an unknown value raises ``ValueError`` rather than silently
    falling back, so a typo in a hand-written state file fails loudly
    instead of producing surprising behavior.
    """
    name = getattr(state, "directive_set", DEFAULT_DIRECTIVE_SET)
    if not isinstance(name, str) or not name:
        raise ValueError(
            f"directive_set must be a non-empty string; got {name!r}",
        )
    if name not in KNOWN_DIRECTIVE_SETS:
        raise ValueError(
            f"unknown directive_set {name!r}; "
            f"known sets: {sorted(KNOWN_DIRECTIVE_SETS)}",
        )
    return name


def load_directive_set(name: str) -> Mapping[str, Step]:
    """Import the ``directives.<name>`` package and return its step mapping.

    The selected set's ``__init__`` exposes a ``get_steps()`` factory
    (see :class:`work_engine.directives.backend`) that returns the
    ``{step_name: handler}`` mapping the dispatcher walks. Unimplemented
    sets (``ui``, ``ui-trivial``, ``mixed``) raise
    ``NotImplementedError`` from their ``get_steps()`` so the failure
    point is the loader, not a half-walked dispatch loop.

    The schema enum carries hyphenated wire names (``ui-trivial``) but
    Python packages must use underscores; :data:`_PACKAGE_NAME_OVERRIDES`
    is the single translation point.
    """
    module = _import_directive_set(name)
    get_steps = getattr(module, "get_steps", None)
    if not callable(get_steps):
        raise AttributeError(
            f"work_engine.directives.{module.__name__.rsplit('.', 1)[-1]} "
            "does not expose a callable get_steps()",
        )
    steps = get_steps()
    if not isinstance(steps, Mapping):
        raise TypeError(
            f"work_engine.directives.{module.__name__.rsplit('.', 1)[-1]}"
            f".get_steps() must return a Mapping; "
            f"got {type(steps).__name__}",
        )
    return steps


def assert_kind_supported(kind: str, set_name: str) -> None:
    """Raise ``NotImplementedError`` if ``set_name`` cannot handle ``kind``.

    Reads the per-set ``SUPPORTED_KINDS`` tuple (see
    :data:`work_engine.directives.backend.SUPPORTED_KINDS`) and checks
    membership. Distinct from :func:`select_directive_set`, which only
    validates the directive-set *name*: this gate validates the
    name/kind *pair*, so a future schema widening that adds new
    ``input.kind`` values (R2 ``prompt``) halts loudly at the boundary
    instead of crashing inside the first deterministic step.

    Sets that have no ``SUPPORTED_KINDS`` attribute are treated as
    "supports nothing" — the unimplemented stubs (``ui``,
    ``ui-trivial``, ``mixed``) already raise from ``get_steps()``, so
    this branch only matters during the brief window between adding a
    new directive set and wiring its capability tuple.
    """
    module = _import_directive_set(set_name)
    supported = getattr(module, "SUPPORTED_KINDS", ())
    if kind not in supported:
        raise NotImplementedError(
            f"directive_set {set_name!r} does not handle "
            f"input.kind={kind!r}; supported kinds: {sorted(set(supported))}",
        )


def _import_directive_set(name: str):
    """Validate ``name`` and import the matching package module."""
    if name not in KNOWN_DIRECTIVE_SETS:
        raise ValueError(
            f"unknown directive_set {name!r}; "
            f"known sets: {sorted(KNOWN_DIRECTIVE_SETS)}",
        )
    package_name = _PACKAGE_NAME_OVERRIDES.get(name, name)
    return import_module(f"work_engine.directives.{package_name}")
