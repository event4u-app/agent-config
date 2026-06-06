"""Directive-set bundles consumed by the dispatcher.

A *directive set* is a coherent group of step handlers (refine,
memory, analyze, plan, implement, test, verify, report) tuned for a
particular kind of work — backend coding, UI work, mixed front+back
work, and so on. The dispatcher selects exactly one set per cycle
(see ``dispatcher.select_directive_set``) and walks its eight steps
in the canonical order.

Each set is a Python sub-package exposing a single function::

    def get_steps() -> Mapping[str, Step]:
        '''Return the {step_name: handler} mapping the dispatcher walks.'''

The mapping must cover every entry in :data:`dispatcher.STEP_ORDER`;
incomplete bundles raise ``KeyError`` at dispatch time.

Roadmap status (R1 Phase 4):

- ``backend`` — fully implemented; landing in Step 3 of this phase.
- ``ui`` — stub; lands in Roadmap 3 (``road-to-product-ui-track.md``).
- ``ui_trivial`` — stub; lands in Roadmap 3 V2.
- ``mixed`` — stub; lands in Roadmap 3.

The schema (``state.KNOWN_DIRECTIVE_SETS``) carries the *external*
names ``ui``, ``ui-trivial``, ``mixed``; the directory layout uses
underscores (``ui_trivial``) because Python packages cannot contain
hyphens. The dispatcher's loader is the single place that translates
between the two.
"""
from __future__ import annotations

__all__: list[str] = []
