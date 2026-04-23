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

__all__ = [
    "analyze",
    "implement",
    "memory",
    "plan",
    "refine",
    "report",
    "test",
    "verify",
]
