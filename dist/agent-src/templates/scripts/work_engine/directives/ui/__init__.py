"""UI directive set — every dispatcher slot wired to a working handler.

Phase 1 of ``agents/roadmaps/road-to-product-ui-track.md`` landed the
intent classifier; Phase 2 promoted ``refine`` to the real audit gate
(:mod:`.audit`); Phase 3 added the design / apply / review / polish
handlers; Phase 6 wired the ``report`` slot. The greenfield-scaffold
roadmap then promoted the two former pass-through slots into real
greenfield gates: ``memory`` → :mod:`.app_spec` (the app-spec grounding
gate) and ``plan`` → :mod:`.scaffold` (the Zero-to-One skeleton gate).
Both are no-op ``SUCCESS`` for every non-greenfield-scaffold flow, so the
improve-existing / ``bare`` / ``external_reference`` paths are unchanged.

The eight-step shape mirrors :mod:`work_engine.directives.backend`:

- ``refine`` → :mod:`.audit` — existing-UI inventory + greenfield gate.
- ``memory`` → :mod:`.app_spec` — greenfield app-spec grounding gate.
- ``analyze`` → :mod:`.design` — produces the locked design brief.
- ``plan`` → :mod:`.scaffold` — greenfield Zero-to-One skeleton gate.
- ``implement`` → :mod:`.apply` — stack-dispatched render of the brief.
- ``test`` → :mod:`.review` — design-review pass produces findings.
- ``verify`` → :mod:`.polish` — bounded fix loop (≤ 2 rounds).
- ``report`` → :mod:`work_engine.directives.backend.report` — shared
  delivery-Markdown renderer.

The greenfield order is audit → app-spec → design → scaffold → apply →
review → polish (Phases 2-4 council, Option A): ``design`` fixes the
abstract visual language, ``scaffold`` maps it onto concrete structure.
"""
from __future__ import annotations

from collections.abc import Mapping

from ...delivery_state import Step
from ..backend import report
from . import app_spec, apply, audit, design, polish, review, scaffold

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

    ``refine`` runs audit; ``memory`` runs the greenfield app-spec gate;
    ``analyze`` runs design; ``plan`` runs the greenfield scaffold gate;
    ``implement`` runs apply; ``test`` runs review; ``verify`` runs
    polish; ``report`` re-uses the shared backend renderer. The app-spec
    and scaffold gates are no-ops outside the greenfield-scaffold path.
    The mapping is rebuilt per call (cheap; the dispatcher invokes
    :func:`get_steps` once per run).
    """
    return {
        "refine": audit.run,
        "memory": app_spec.run,
        "analyze": design.run,
        "plan": scaffold.run,
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
    Each handler re-exports its own ``AMBIGUITIES`` tuple so doc
    generators see a uniform shape across all eight steps. ``report``
    borrows the backend renderer's surface.
    """
    return {
        "refine": audit.AMBIGUITIES,
        "memory": app_spec.AMBIGUITIES,
        "analyze": design.AMBIGUITIES,
        "plan": scaffold.AMBIGUITIES,
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
    "app_spec",
    "apply",
    "audit",
    "design",
    "get_steps",
    "polish",
    "report",
    "review",
    "scaffold",
]
