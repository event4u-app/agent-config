"""Intent classification for the universal engine (R3 Phase 1 Step 2).

The :mod:`work_engine.intent.classify` module turns a raw user prompt
(or a ticket's title + body) into one of the five labels the dispatcher
routes against:

- ``ui-build`` — new screen, page, or component.
- ``ui-improve`` — change to an existing screen / component.
- ``ui-trivial`` — single-file, single-concern micro-edit (color, copy,
  one class, one prop). Hard preconditions are enforced again at apply
  time; the classifier only labels the *intent*, not the safety floor.
- ``mixed`` — both UI and backend signals; routes to the mixed track.
- ``backend-coding`` — default; no UI signal.

The classifier is intentionally heuristic-only — it consumes nothing
beyond the prompt text and optional ticket title. Confidence-band
gating, AC reconstruction, and assumption surfacing all stay in
``directives/backend/refine.py`` (R2). This module only owns the
*label*; the dispatcher owns the routing.
"""
from __future__ import annotations

from . import classify
from .classify import (
    INTENT_BACKEND,
    INTENT_MIXED,
    INTENT_UI_BUILD,
    INTENT_UI_IMPROVE,
    INTENT_UI_TRIVIAL,
    KNOWN_INTENTS,
    classify_intent,
    directive_set_for,
    populate_routing,
)

__all__ = [
    "INTENT_BACKEND",
    "INTENT_MIXED",
    "INTENT_UI_BUILD",
    "INTENT_UI_IMPROVE",
    "INTENT_UI_TRIVIAL",
    "KNOWN_INTENTS",
    "classify",
    "classify_intent",
    "directive_set_for",
    "populate_routing",
]
