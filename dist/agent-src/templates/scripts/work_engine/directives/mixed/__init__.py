"""Mixed (backend + UI) directive set — Phase 4 wiring.

Phase 4 of ``agents/roadmaps/road-to-product-ui-track.md``: ``mixed`` is
the directive set for tickets that touch both layers. Its plan slot
locks the backend contract (data shape + API surface) before any UI
work begins; its implement slot delegates the full UI sub-flow once
the contract is confirmed; its test slot stitches the seam with
end-to-end smoke scenarios.

Slot mapping (mirrors :mod:`work_engine.directives.backend.get_steps`):

- ``refine`` → :mod:`work_engine.directives.backend.refine` — intent
  classification + ticket / prompt gate (shared with backend).
- ``memory`` → :mod:`work_engine.directives.backend.memory` —
  engineering-memory pull (shared with backend).
- ``analyze`` → :mod:`work_engine.directives.backend.analyze` —
  backend analysis precondition for the contract lock.
- ``plan`` → :mod:`.contract` — backend contract lock (Phase 4 Step 1).
- ``implement`` → :mod:`.ui` — delegate to UI sub-flow (Phase 4 Step 2).
- ``test`` → :mod:`.stitch` — integration verification (Phase 4 Step 3).
- ``verify`` → :mod:`work_engine.directives.backend.verify` — four-judge
  review on the merged diff (shared with backend).
- ``report`` → :mod:`work_engine.directives.backend.report` — delivery
  markdown (shared with backend).

The shared steps are reused by reference, not by duplication: the
backend versions already gate on ``test`` / ``verify`` outcomes via
the dispatcher's ``state.outcomes`` dict, so they slot into the mixed
flow without modification.
"""
from __future__ import annotations

from collections.abc import Mapping

from ...delivery_state import Step
from ..backend import analyze as backend_analyze
from ..backend import memory as backend_memory
from ..backend import refine as backend_refine
from ..backend import report as backend_report
from ..backend import verify as backend_verify
from . import contract, stitch, ui

DIRECTIVE_SET_NAME = "mixed"
"""External name carried in ``state.directive_set`` for this set."""

ROADMAP = "agents/roadmaps/road-to-product-ui-track.md"
"""Roadmap that promotes the Phase 4 stub to working handlers."""

SUPPORTED_KINDS: tuple[str, ...] = ("ticket", "prompt")
"""Input kinds this directive set accepts.

``mixed`` accepts the same envelope shapes as ``backend``: ticket
payloads (refined by the ticket flow) and free-form prompts
(refined by ``refine-prompt``). The ``diff`` / ``file`` envelopes
stay UI-only since they describe an existing screen, not a backend
contract surface.
"""


def _build_step_map() -> dict[str, Step]:
    """Wire the eight-step dispatcher slots for the mixed set.

    ``refine`` / ``memory`` / ``analyze`` / ``verify`` / ``report``
    reuse the backend handlers verbatim; ``plan`` / ``implement`` /
    ``test`` are the mixed-specific contract → ui → stitch chain.
    """
    return {
        "refine": backend_refine.run,
        "memory": backend_memory.run,
        "analyze": backend_analyze.run,
        "plan": contract.run,
        "implement": ui.run,
        "test": stitch.run,
        "verify": backend_verify.run,
        "report": backend_report.run,
    }


def get_steps() -> Mapping[str, Step]:
    """Return the ``{step_name: handler}`` mapping the dispatcher walks.

    Mirrors :func:`work_engine.directives.backend.get_steps` and
    :func:`work_engine.directives.ui.get_steps`.
    """
    return _build_step_map()


def all_ambiguities() -> dict[str, tuple[dict[str, str], ...]]:
    """Per-step ambiguity declarations.

    Each handler re-exports its own ``AMBIGUITIES`` tuple. The mapping
    is rebuilt per call (cheap; documentation generators and the
    ``test_ambiguity_coverage`` suite invoke this once per run).
    """
    return {
        "refine": backend_refine.AMBIGUITIES,
        "memory": backend_memory.AMBIGUITIES,
        "analyze": backend_analyze.AMBIGUITIES,
        "plan": contract.AMBIGUITIES,
        "implement": ui.AMBIGUITIES,
        "test": stitch.AMBIGUITIES,
        "verify": backend_verify.AMBIGUITIES,
        "report": backend_report.AMBIGUITIES,
    }


__all__ = [
    "DIRECTIVE_SET_NAME",
    "ROADMAP",
    "SUPPORTED_KINDS",
    "all_ambiguities",
    "contract",
    "get_steps",
    "stitch",
    "ui",
]
