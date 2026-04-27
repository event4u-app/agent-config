"""Linear step dispatcher for ``/implement-ticket``.

The dispatcher holds no business logic. It walks the fixed eight-step
order declared in ``agents/contexts/implement-ticket-flow.md``, hands
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
from .state import KNOWN_DIRECTIVE_SETS

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

    for name in STEP_ORDER:
        if state.outcomes.get(name) == Outcome.SUCCESS.value:
            # Already completed on an earlier invocation — skip per the
            # resume contract. The caller is responsible for keeping
            # ``state.outcomes`` and the matching slice in sync.
            continue

        handler = steps[name]
        result = handler(state)
        _validate_step_result(name, result)

        state.outcomes[name] = result.outcome.value

        if result.outcome is Outcome.BLOCKED:
            state.questions = list(result.questions)
            return Outcome.BLOCKED, name

        if result.outcome is Outcome.PARTIAL:
            state.questions = list(result.questions)
            return Outcome.PARTIAL, name

    return Outcome.SUCCESS, None


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
    if name not in KNOWN_DIRECTIVE_SETS:
        raise ValueError(
            f"unknown directive_set {name!r}; "
            f"known sets: {sorted(KNOWN_DIRECTIVE_SETS)}",
        )

    package_name = _PACKAGE_NAME_OVERRIDES.get(name, name)
    module = import_module(f"work_engine.directives.{package_name}")
    get_steps = getattr(module, "get_steps", None)
    if not callable(get_steps):
        raise AttributeError(
            f"work_engine.directives.{package_name} does not expose a "
            "callable get_steps()",
        )
    steps = get_steps()
    if not isinstance(steps, Mapping):
        raise TypeError(
            f"work_engine.directives.{package_name}.get_steps() must "
            f"return a Mapping; got {type(steps).__name__}",
        )
    return steps
