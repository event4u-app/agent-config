"""Step handlers for the ``/implement-ticket`` dispatcher.

Each module exposes a single ``run`` callable that matches the
``Step`` protocol defined in ``..delivery_state``. The dispatcher
wires them into the ``STEP_ORDER`` mapping at call time; nothing in
this package imports handlers eagerly, so a partial wiring during
development is caught by the dispatcher's missing-step check rather
than by an import-time failure.

Phase 2 ships the deterministic gates (``refine``, ``memory``,
``analyze``, ``plan``) and the Markdown renderer (``report``). The
remaining agent-driven steps (``implement``, ``test``, ``verify``)
halt via ``@agent-directive:`` markers and are wired in Phase 3 —
see ``agents/roadmaps/road-to-implement-ticket.md``.
"""
from __future__ import annotations

from . import analyze, memory, plan, refine, report

__all__ = ["analyze", "memory", "plan", "refine", "report"]
