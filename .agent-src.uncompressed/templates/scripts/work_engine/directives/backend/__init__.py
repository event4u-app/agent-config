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
from types import ModuleType

from . import analyze, implement, memory, plan, refine, report, test, verify

DIRECTIVE_SET_NAME = "backend"
"""External name carried in ``state.directive_set`` for this set."""

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


def get_steps() -> Mapping[str, ModuleType]:
    """Return the ``{step_name: handler}`` mapping the dispatcher walks.

    Order of insertion matches the canonical backend flow
    (refine → memory → analyze → plan → implement → test → verify
    → report); the dispatcher's own ``STEP_ORDER`` is the single
    source of truth for *which* steps exist, but the directive set
    is the single source of truth for *how* each one runs.
    """
    return {step.__name__.rsplit(".", 1)[-1]: step for step in _STEPS}


__all__ = [
    "DIRECTIVE_SET_NAME",
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
