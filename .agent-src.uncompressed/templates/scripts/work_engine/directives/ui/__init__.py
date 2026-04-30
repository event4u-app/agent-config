"""UI directive set — Phase 2 audit gate wired in.

Phase 1 of ``agents/roadmaps/road-to-product-ui-track.md`` landed the
intent classifier and routed UI-shaped inputs (``ui-build``,
``ui-improve``) to ``directive_set="ui"``. Phase 2 promotes the
``refine`` slot from a deferral stub to the real existing-UI-audit
gate (:mod:`.audit`). Design / apply / review / polish are still
Phase 3 work — the dispatcher hits :mod:`._phase3_stub` once audit
returns ``SUCCESS`` and halts cleanly with the deferred-track refusal.

The eight-step shape mirrors :mod:`work_engine.directives.backend`:

- ``refine`` → :mod:`.audit` — mandatory pre-step; emits
  ``@agent-directive: existing-ui-audit`` on first pass, halts on
  greenfield without a decision, succeeds when populated.
- ``memory`` … ``report`` → :mod:`._phase3_stub` — clean BLOCKED halt
  pointing at Phase 3. Once the design / apply / review / polish
  handlers land, those slots are replaced one-for-one without
  touching the dispatcher.

Keeping the audit success path live *now* (instead of waiting for
the full bundle) lets Phase 2 goldens prove the gate enforces the
contract on its own — see ``tests/golden/baseline/GT-P4*`` and the
new GT-U* batch landing in Phase 6.
"""
from __future__ import annotations

from collections.abc import Mapping

from ...delivery_state import Step
from . import _phase3_stub, audit

DIRECTIVE_SET_NAME = "ui"
"""External name carried in ``state.directive_set`` for this set."""

ROADMAP = "agents/roadmaps/road-to-product-ui-track.md"
"""Roadmap that promotes the Phase 3 stubs to working handlers."""

SUPPORTED_KINDS: tuple[str, ...] = ("ticket", "prompt", "diff", "file")
"""Input kinds this directive set knows how to handle.

Phase 1 wires every UI-classifiable input shape (ticket prose,
free-form prompt, ``diff`` / ``file`` improve-this-screen envelopes)
through to this set; Phase 2's audit gate keeps the same tuple so
input-routing stays unchanged.
"""


def _build_step_map() -> dict[str, Step]:
    """Wire the eight-step dispatcher slots for the UI set.

    ``refine`` runs the real audit handler. ``memory`` … ``report``
    share the Phase 3 deferral handler so the dispatcher's
    completeness check is satisfied and the halt surface stays
    consistent. The mapping is rebuilt per call (cheap; the
    dispatcher invokes :func:`get_steps` once per run).
    """
    phase3 = _phase3_stub.run
    return {
        "refine": audit.run,
        "memory": phase3,
        "analyze": phase3,
        "plan": phase3,
        "implement": phase3,
        "test": phase3,
        "verify": phase3,
        "report": phase3,
    }


def get_steps() -> Mapping[str, Step]:
    """Return the ``{step_name: handler}`` mapping the dispatcher walks.

    Mirrors :func:`work_engine.directives.backend.get_steps`. ``refine``
    is the only slot carrying Phase 2 behavior; the rest delegate to
    the Phase 3 stub until those handlers ship.
    """
    return _build_step_map()


def all_ambiguities() -> dict[str, tuple[dict[str, str], ...]]:
    """Per-step ambiguity declarations.

    Mirrors :func:`work_engine.directives.backend.all_ambiguities`.
    ``refine`` re-exports :data:`audit.AMBIGUITIES`; the Phase 3 slots
    re-export :data:`_phase3_stub.AMBIGUITIES` so doc generators see
    a uniform shape across all eight steps.
    """
    stub = _phase3_stub.AMBIGUITIES
    return {
        "refine": audit.AMBIGUITIES,
        "memory": stub,
        "analyze": stub,
        "plan": stub,
        "implement": stub,
        "test": stub,
        "verify": stub,
        "report": stub,
    }


__all__ = [
    "DIRECTIVE_SET_NAME",
    "ROADMAP",
    "SUPPORTED_KINDS",
    "all_ambiguities",
    "audit",
    "get_steps",
]
