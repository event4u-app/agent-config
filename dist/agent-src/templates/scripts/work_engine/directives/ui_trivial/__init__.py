"""UI-trivial directive set — single-file ≤5-line micro-edit path.

Phase 2 Step 6 of ``agents/roadmaps/road-to-product-ui-track.md``: the
short-circuit path for changes that provably cannot need the audit /
design / review / polish loop. The dispatcher routes here when Phase
1's intent classifier landed ``ui-trivial`` (color tweak, copy change,
single-class swap, one-prop adjustment).

The eight-step shape mirrors :mod:`work_engine.directives.backend` /
:mod:`work_engine.directives.ui` — eight slots, fixed order, no
branching. The trivial path fills them as follows:

- ``refine``    → :mod:`.refine`     — confirm intent gate.
- ``memory``    → :mod:`._skipped`   — bypassed.
- ``analyze``   → :mod:`._skipped`   — bypassed.
- ``plan``      → :mod:`._skipped`   — bypassed.
- ``implement`` → :mod:`.apply`      — hard preconditions; reclassify
  to ``ui-improve`` (full audit gate) when violated.
- ``test``      → :mod:`.test`       — smoke-test delegate.
- ``verify``    → :mod:`._skipped`   — bypassed.
- ``report``    → :mod:`.report`     — one-line delivery summary.

The directory uses an underscore (``ui_trivial``) because Python
packages cannot contain hyphens. The schema carries the external
hyphenated name ``"ui-trivial"``; the dispatcher's loader is the
single place that translates between them.
"""
from __future__ import annotations

from collections.abc import Mapping

from ...delivery_state import Step
from . import _skipped, apply, refine, report, test

DIRECTIVE_SET_NAME = "ui-trivial"
"""External name carried in ``state.directive_set`` for this set.

Note the hyphen \u2014 this is the schema/wire form, not the Python
module name. The module name (``ui_trivial``) is an implementation
detail of the loader.
"""

ROADMAP = "agents/roadmaps/road-to-product-ui-track.md"
"""Roadmap that defines this directive bundle (Phase 2 Step 6)."""

SUPPORTED_KINDS: tuple[str, ...] = ("ticket", "prompt", "diff", "file")
"""Input kinds this directive set knows how to handle.

Phase 1's intent classifier reaches ``ui-trivial`` from any of the
four input kinds; the trivial set keeps the same tuple so input
routing stays unchanged once the intent label has landed.
"""


def _build_step_map() -> dict[str, Step]:
    """Wire the eight-step dispatcher slots for the trivial set.

    ``refine`` validates the intent gate; ``implement``, ``test``,
    and ``report`` carry the trivial-path behavior; the four bypassed
    slots share :mod:`._skipped` so the dispatcher's completeness
    check is satisfied without inventing per-slot stubs. The mapping
    is rebuilt per call (cheap; the dispatcher invokes
    :func:`get_steps` once per run).
    """
    skipped = _skipped.run
    return {
        "refine": refine.run,
        "memory": skipped,
        "analyze": skipped,
        "plan": skipped,
        "implement": apply.run,
        "test": test.run,
        "verify": skipped,
        "report": report.run,
    }


def get_steps() -> Mapping[str, Step]:
    """Return the ``{step_name: handler}`` mapping the dispatcher walks.

    Mirrors :func:`work_engine.directives.backend.get_steps`. ``refine``,
    ``implement``, ``test``, and ``report`` carry trivial-path behavior;
    the four bypassed slots delegate to :mod:`._skipped`.
    """
    return _build_step_map()


def all_ambiguities() -> dict[str, tuple[dict[str, str], ...]]:
    """Per-step ambiguity declarations.

    Mirrors :func:`work_engine.directives.backend.all_ambiguities`.
    The four bypassed slots re-export :data:`_skipped.AMBIGUITIES`
    (an empty tuple) so doc generators see a uniform shape across all
    eight steps.
    """
    skipped = _skipped.AMBIGUITIES
    return {
        "refine": refine.AMBIGUITIES,
        "memory": skipped,
        "analyze": skipped,
        "plan": skipped,
        "implement": apply.AMBIGUITIES,
        "test": test.AMBIGUITIES,
        "verify": skipped,
        "report": report.AMBIGUITIES,
    }


__all__ = [
    "DIRECTIVE_SET_NAME",
    "ROADMAP",
    "SUPPORTED_KINDS",
    "all_ambiguities",
    "apply",
    "get_steps",
    "refine",
    "report",
    "test",
]
