"""Step handlers for the ``/implement-ticket`` dispatcher.

Each module exposes a single ``run`` callable that matches the
``Step`` protocol defined in ``..delivery_state``. The dispatcher
wires them into the ``STEP_ORDER`` mapping at call time; nothing in
this package imports handlers eagerly, so a partial wiring during
development is caught by the dispatcher's missing-step check rather
than by an import-time failure.

Phase 2 ships all eight step handlers. The deterministic gates
(``refine``, ``memory``, ``analyze``) validate upstream state; the
delegation gates (``plan``, ``implement``, ``test``, ``verify``)
halt with ``@agent-directive:`` markers so the orchestrator can
invoke the matching skill and resume. ``report`` renders the
delivery Markdown once everything else has succeeded. See
``agents/roadmaps/road-to-implement-ticket.md`` for the shipping
order and ``agents/contexts/implement-ticket-flow.md`` for the
slice contracts each handler writes to.
"""
from __future__ import annotations

from . import analyze, implement, memory, plan, refine, report, test, verify

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


__all__ = [
    "all_ambiguities",
    "analyze",
    "implement",
    "memory",
    "plan",
    "refine",
    "report",
    "test",
    "verify",
]
