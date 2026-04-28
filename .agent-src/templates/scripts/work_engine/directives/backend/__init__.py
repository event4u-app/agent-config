"""Backend directive set — step handlers for the backend-coding flow.

Each module exposes a single ``run`` callable that matches the
``Step`` protocol defined in ``...delivery_state``. The dispatcher
wires them into the ``STEP_ORDER`` mapping at call time; nothing in
this package imports handlers eagerly, so a partial wiring during
development is caught by the dispatcher's missing-step check rather
than by an import-time failure.

This is the first concrete entry in the
:mod:`work_engine.directives` package. R1 Phase 4 Step 3 moved the
handlers here from the original ``work_engine.steps`` location so
the upcoming generalized dispatcher (Step 2) can select between
multiple directive sets uniformly via :func:`get_steps`. The
external behavior — flow order, ambiguity surfaces, halt-points —
is unchanged.

The deterministic gates (``refine``, ``memory``, ``analyze``)
validate upstream state; the delegation gates (``plan``,
``implement``, ``test``, ``verify``) halt with
``@agent-directive:`` markers so the orchestrator can invoke the
matching skill and resume. ``report`` renders the delivery Markdown
once everything else has succeeded. See
``agents/roadmaps/road-to-implement-ticket.md`` for the shipping
order and ``agents/contexts/implement-ticket-flow.md`` for the
slice contracts each handler writes to.
"""
from __future__ import annotations

from collections.abc import Mapping

from ...delivery_state import Step
from . import analyze, implement, memory, plan, refine, report, test, verify

DIRECTIVE_SET_NAME = "backend"
"""External name carried in ``state.directive_set`` for this set."""

SUPPORTED_KINDS: tuple[str, ...] = ("ticket",)
"""Input kinds this directive set knows how to handle.

Read by :func:`work_engine.dispatcher.assert_kind_supported` before the
loop starts. The schema's :data:`work_engine.state.KNOWN_INPUT_KINDS` is
the *envelope* whitelist (what is accepted on disk); ``SUPPORTED_KINDS``
is the *capability* whitelist (what this set can actually drive end to
end). They happen to match in R1 because ``ticket`` is the only kind
defined; R2 widens the schema with ``prompt`` while backend keeps the
narrower capability tuple, so unsupported kinds halt loudly at the
dispatcher boundary instead of crashing inside ``refine``."""

_STEPS = (refine, memory, analyze, plan, implement, test, verify, report)


def all_ambiguities() -> dict[str, tuple[dict[str, str], ...]]:
    """Return `{step_name: AMBIGUITIES}` for every step in flow order.

    Used by documentation generators and the ``test_ambiguity_coverage``
    suite to prove every step explicitly declares what can surface a
    ``BLOCKED`` outcome. Steps that always succeed (``memory``,
    ``report``) return an empty tuple — declared intent, not an
    omission.
    """
    return {step.__name__.rsplit(".", 1)[-1]: step.AMBIGUITIES for step in _STEPS}


def get_steps() -> Mapping[str, Step]:
    """Return the ``{step_name: handler}`` mapping the dispatcher walks.

    Each value is the module-level ``run`` callable matching the
    :data:`work_engine.delivery_state.Step` protocol —
    ``Callable[[DeliveryState], StepResult]`` — exactly what
    :func:`work_engine.dispatcher.dispatch` calls. Order of insertion
    matches the canonical backend flow (refine → memory → analyze →
    plan → implement → test → verify → report); the dispatcher's own
    ``STEP_ORDER`` is the single source of truth for *which* steps
    exist, but the directive set is the single source of truth for
    *how* each one runs.
    """
    return {step.__name__.rsplit(".", 1)[-1]: step.run for step in _STEPS}


__all__ = [
    "DIRECTIVE_SET_NAME",
    "SUPPORTED_KINDS",
    "all_ambiguities",
    "analyze",
    "get_steps",
    "implement",
    "memory",
    "plan",
    "refine",
    "report",
    "test",
    "verify",
]
