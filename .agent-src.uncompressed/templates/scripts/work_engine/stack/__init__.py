"""Stack detection for the UI directive set (R3 Phase 1).

The :mod:`work_engine.stack.detect` module sniffs the project root for
manifest signals (``composer.json``, ``package.json``, ``components.json``)
and labels the frontend stack one of:

- ``blade-livewire-flux`` — Laravel + Livewire + Flux UI components
- ``react-shadcn`` — React + Radix-based shadcn/ui primitives
- ``vue`` — Vue.js (3.x or 2.x)
- ``plain`` — none of the above; Tailwind + raw HTML/Blade fallback

The label feeds the dispatcher's UI directive set (``directives/ui/apply.py``)
to pick the right implementation skill.

Detection is **manifest-only** by design — we do not read JS/PHP source
files because:

1. Manifests are deterministic and cheap to parse.
2. Source-level signals (e.g. counting ``<x-flux::*`` calls) are noisy
   on greenfield repos where audit will already emit ``greenfield=true``.
3. Re-detect on manifest mtime change is sufficient — adding a stack
   means editing a manifest, and we cache against that.

See ``agents/roadmaps/road-to-product-ui-track.md`` Phase 1 Step 1 for
the full heuristic table and the ``state.stack`` schema slice it feeds.
"""
from __future__ import annotations

from . import detect

__all__ = ["detect"]
