"""UI directive set — Phase 3 design / apply / review / polish wired in.

Phase 1 of ``agents/roadmaps/road-to-product-ui-track.md`` landed the
intent classifier; Phase 2 promoted ``refine`` to the real audit gate
(:mod:`.audit`); Phase 3 replaces the deferral stub with the four
working handlers — :mod:`.design` (analyze), :mod:`.apply` (implement),
:mod:`.review` (test), :mod:`.polish` (verify). The remaining slots
(``memory``, ``plan``, ``report``) keep the Phase 3 stub until the
post-Phase-3 work picks them up.

The eight-step shape mirrors :mod:`work_engine.directives.backend`:

- ``refine`` → :mod:`.audit` — existing-UI inventory gate.
- ``memory`` → :mod:`._phase3_stub` — deferred to a later track.
- ``analyze`` → :mod:`.design` — produces the locked design brief.
- ``plan`` → :mod:`._phase3_stub` — deferred (planning lives inside
  the design brief for now).
- ``implement`` → :mod:`.apply` — stack-dispatched render of the brief.
- ``test`` → :mod:`.review` — design-review pass produces findings.
- ``verify`` → :mod:`.polish` — bounded fix loop (≤ 2 rounds).
- ``report`` → :mod:`._phase3_stub` — deferred to a later track.
"""
from __future__ import annotations

from collections.abc import Mapping

from ...delivery_state import Step
from . import _phase3_stub, apply, audit, design, polish, review

DIRECTIVE_SET_NAME = "ui"
"""External name carried in ``state.directive_set`` for this set."""

ROADMAP = "agents/roadmaps/road-to-product-ui-track.md"
"""Roadmap that promoted the Phase 3 stubs to working handlers."""

SUPPORTED_KINDS: tuple[str, ...] = ("ticket", "prompt", "diff", "file")
"""Input kinds this directive set knows how to handle.

Phase 1 wires every UI-classifiable input shape (ticket prose,
free-form prompt, ``diff`` / ``file`` improve-this-screen envelopes)
through to this set; Phase 3's design / apply / review / polish gates
keep the same tuple so input-routing stays unchanged.
"""


def _build_step_map() -> dict[str, Step]:
    """Wire the eight-step dispatcher slots for the UI set.

    ``refine`` runs audit; ``analyze`` runs design; ``implement`` runs
    apply; ``test`` runs review; ``verify`` runs polish. ``memory``,
    ``plan``, and ``report`` keep the deferral stub. The mapping is
    rebuilt per call (cheap; the dispatcher invokes :func:`get_steps`
    once per run).
    """
    phase3 = _phase3_stub.run
    return {
        "refine": audit.run,
        "memory": phase3,
        "analyze": design.run,
        "plan": phase3,
        "implement": apply.run,
        "test": review.run,
        "verify": polish.run,
        "report": phase3,
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
    deferred slots re-export :data:`_phase3_stub.AMBIGUITIES` so doc
    generators see a uniform shape across all eight steps.
    """
    stub = _phase3_stub.AMBIGUITIES
    return {
        "refine": audit.AMBIGUITIES,
        "memory": stub,
        "analyze": design.AMBIGUITIES,
        "plan": stub,
        "implement": apply.AMBIGUITIES,
        "test": review.AMBIGUITIES,
        "verify": polish.AMBIGUITIES,
        "report": stub,
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
    "review",
]
