"""UI directive set — Phase 6 wires every slot to a working handler.

Phase 1 of ``agents/roadmaps/road-to-product-ui-track.md`` landed the
intent classifier; Phase 2 promoted ``refine`` to the real audit gate
(:mod:`.audit`); Phase 3 added the four design / apply / review / polish
handlers; Phase 6 retires the deferral stub by wiring the remaining
``memory``, ``plan``, and ``report`` slots — the first two as
:mod:`._passthrough` (the UI track has no memory retrieval, and the
design brief IS the plan), and the third as a re-export of
:func:`work_engine.directives.backend.report.run` (the renderer is pure
and state-driven, so the same Markdown contract serves both tracks).

The eight-step shape mirrors :mod:`work_engine.directives.backend`:

- ``refine`` → :mod:`.audit` — existing-UI inventory gate.
- ``memory`` → :mod:`._passthrough` — UI track does not consult memory.
- ``analyze`` → :mod:`.design` — produces the locked design brief.
- ``plan`` → :mod:`._passthrough` — design brief is the plan.
- ``implement`` → :mod:`.apply` — stack-dispatched render of the brief.
- ``test`` → :mod:`.review` — design-review pass produces findings.
- ``verify`` → :mod:`.polish` — bounded fix loop (≤ 2 rounds).
- ``report`` → :mod:`work_engine.directives.backend.report` — shared
  delivery-Markdown renderer.
"""
from __future__ import annotations

from collections.abc import Mapping

from ...delivery_state import Step
from ..backend import report
from . import _passthrough, apply, audit, design, polish, review

DIRECTIVE_SET_NAME = "ui"
"""External name carried in ``state.directive_set`` for this set."""

ROADMAP = "agents/roadmaps/road-to-product-ui-track.md"
"""Roadmap that promoted the deferral stub to fully wired handlers."""

SUPPORTED_KINDS: tuple[str, ...] = ("ticket", "prompt", "diff", "file")
"""Input kinds this directive set knows how to handle.

Phase 1 wires every UI-classifiable input shape (ticket prose,
free-form prompt, ``diff`` / ``file`` improve-this-screen envelopes)
through to this set; Phase 3's design / apply / review / polish gates
keep the same tuple so input-routing stays unchanged.
"""


def _build_step_map() -> dict[str, Step]:
    """Wire the eight-step dispatcher slots for the UI set.

    ``refine`` runs audit; ``memory`` and ``plan`` are pass-through
    no-ops; ``analyze`` runs design; ``implement`` runs apply; ``test``
    runs review; ``verify`` runs polish; ``report`` re-uses the shared
    backend renderer. The mapping is rebuilt per call (cheap; the
    dispatcher invokes :func:`get_steps` once per run).
    """
    passthrough = _passthrough.run
    return {
        "refine": audit.run,
        "memory": passthrough,
        "analyze": design.run,
        "plan": passthrough,
        "implement": apply.run,
        "test": review.run,
        "verify": polish.run,
        "report": report.run,
    }


def get_steps() -> Mapping[str, Step]:
    """Return the ``{step_name: handler}`` mapping the dispatcher walks.

    Mirrors :func:`work_engine.directives.backend.get_steps`.
    """
    return _build_step_map()


def all_ambiguities() -> dict[str, tuple[dict[str, str], ...]]:
    """Per-step ambiguity declarations.

    Mirrors :func:`work_engine.directives.backend.all_ambiguities`.
    Each working handler re-exports its own ``AMBIGUITIES`` tuple; the
    pass-through slots re-export :data:`_passthrough.AMBIGUITIES` (an
    empty tuple) so doc generators see a uniform shape across all
    eight steps. ``report`` borrows the backend renderer's surface.
    """
    passthrough = _passthrough.AMBIGUITIES
    return {
        "refine": audit.AMBIGUITIES,
        "memory": passthrough,
        "analyze": design.AMBIGUITIES,
        "plan": passthrough,
        "implement": apply.AMBIGUITIES,
        "test": review.AMBIGUITIES,
        "verify": polish.AMBIGUITIES,
        "report": report.AMBIGUITIES,
    }


__all__ = [
    "DIRECTIVE_SET_NAME",
    "ROADMAP",
    "SUPPORTED_KINDS",
    "all_ambiguities",
    "apply",
    "audit",
    "design",
    "get_steps",
    "polish",
    "report",
    "review",
]
