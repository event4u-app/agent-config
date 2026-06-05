"""Heuristic intent classifier — see :mod:`work_engine.intent` for context.

The classifier walks a small priority ladder against the lower-cased
prompt + optional ticket title. First match wins; ``backend-coding`` is
the fall-through default so every prompt always lands on a known label.

Priority order (deliberately fixed):

1. **Trivial-UI** — UI signal AND a trivial-edit verb pattern (``change
   color``, ``make … red``, ``rename label``, ``fix copy``) AND no
   structural verb (``add``, ``build``, ``create``, ``introduce``).
2. **Mixed** — UI signal AND a backend signal (``endpoint``, ``API``,
   ``migration``, ``schema``, ``query``, ``job``, ``queue``).
3. **UI-Improve** — UI signal AND an improve/redesign/refactor verb,
   OR explicit "existing" surface markers.
4. **UI-Build** — UI signal AND a build/create/add verb, OR new-screen
   markers (``new page``, ``new screen``, ``new component``).
5. **Backend-Coding** — default.

The label is the dispatcher's *only* input for routing. Confidence
band, ``ui_intent`` flag from the scorer, and AC reconstruction stay
the resolution surface — the classifier does not look at them.
"""
from __future__ import annotations

import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..state import WorkState

INTENT_UI_BUILD = "ui-build"
INTENT_UI_IMPROVE = "ui-improve"
INTENT_UI_TRIVIAL = "ui-trivial"
INTENT_MIXED = "mixed"
INTENT_BACKEND = "backend-coding"

KNOWN_INTENTS: frozenset[str] = frozenset(
    {
        INTENT_UI_BUILD,
        INTENT_UI_IMPROVE,
        INTENT_UI_TRIVIAL,
        INTENT_MIXED,
        INTENT_BACKEND,
    },
)
"""All labels the classifier can return.

Locked here so the dispatcher's mapping table and the test suite share
one source of truth."""

_UI_NOUNS: frozenset[str] = frozenset(
    {
        "ui", "screen", "page", "view", "form", "modal", "dialog",
        "button", "card", "tile",
        "header", "footer", "nav", "navigation", "sidebar", "menu",
        "dropdown", "tab", "panel", "layout", "component", "icon",
        "tooltip", "toast", "banner", "badge", "avatar", "label",
        "checkbox", "radio", "toggle", "switch", "stepper", "wizard",
    },
)
"""Strong UI nouns — exclusive UI meaning.

Deliberately omits ``table``, ``list``, ``input``, and ``field``:
``table``/``list`` collide with database tables and Python/PHP lists;
``input``/``field`` collide with function inputs, command inputs, and
JSON/DB fields. Genuine UI prompts that mean form inputs always come
with a strong-UI noun nearby (``form``, ``page``, ``component``)."""

_UI_STYLE: frozenset[str] = frozenset(
    {
        "color", "colour", "css", "tailwind", "padding", "margin",
        "spacing", "font", "typography", "responsive", "mobile",
        "dark mode", "light mode", "theme", "shadow", "border",
        "rounded", "radius",
    },
)

_BACKEND_SIGNALS: frozenset[str] = frozenset(
    {
        "endpoint", "api", "route", "controller", "service",
        "migration", "schema", "table", "column", "index", "query",
        "queue", "job", "worker", "webhook", "policy", "gate",
        "command", "cron", "broadcast", "event", "listener",
    },
)

_TRIVIAL_VERBS: frozenset[str] = frozenset(
    {
        "rename", "relabel", "tweak", "adjust", "swap", "change",
    },
)

_IMPROVE_VERBS: frozenset[str] = frozenset(
    {
        "improve", "polish", "redesign", "rework", "refine",
        "refactor", "tighten", "clean", "fix", "update", "tune",
    },
)

_BUILD_VERBS: frozenset[str] = frozenset(
    {
        "add", "build", "create", "introduce", "implement", "ship",
        "draft", "scaffold", "wire",
    },
)

_NEW_SURFACE: re.Pattern[str] = re.compile(
    r"\b(new|fresh|blank)\s+(page|screen|view|component|form|modal|tile|dashboard)\b",
)

_EXISTING_SURFACE: re.Pattern[str] = re.compile(
    r"\b(existing|current|the)\s+(page|screen|view|component|form|modal)\b",
)

_TRIVIAL_PATTERN: re.Pattern[str] = re.compile(
    r"\b(make|change|update|set|swap)\b[^.]{0,40}\b("
    r"red|blue|green|yellow|black|white|primary|secondary"
    r"|color|colour|copy|text|label|wording|class|prop)\b",
)


def classify_intent(raw: str, *, title: str | None = None) -> str:
    """Return one of :data:`KNOWN_INTENTS` for the supplied text.

    Parameters
    ----------
    raw:
        The user prompt or ticket body. Whitespace is normalised
        internally; ``""`` and ``None`` resolve to ``backend-coding``.
    title:
        Optional ticket title. Concatenated with ``raw`` before
        scanning so single-line ticket headlines (`"Add CSV export"`)
        produce the same label whether they arrive in the body or the
        title slot.
    """
    text = " ".join(filter(None, (title, raw))).strip().lower()
    if not text:
        return INTENT_BACKEND

    has_ui = _has_ui_signal(text)
    has_backend = _has_backend_signal(text)

    if has_ui and _is_trivial(text):
        return INTENT_UI_TRIVIAL
    if has_ui and has_backend:
        return INTENT_MIXED
    if has_ui and _is_improve(text):
        return INTENT_UI_IMPROVE
    if has_ui and _is_build(text):
        return INTENT_UI_BUILD
    if has_ui:
        # UI signal but no clear verb — default to ui-improve so the
        # full audit gate engages. ui-build would skip the existing-
        # surface check, which is the wrong default when the prompt
        # is ambiguous.
        return INTENT_UI_IMPROVE
    return INTENT_BACKEND


def directive_set_for(intent: str) -> str:
    """Map an intent label to a directive-set name.

    Centralised here so the dispatcher and the refine step share one
    routing table; a future intent (``infra``, ``security-review``)
    only needs a single edit. Unknown labels raise ``ValueError`` —
    silently falling back to ``backend`` would mask classifier bugs.
    """
    if intent not in KNOWN_INTENTS:
        raise ValueError(
            f"unknown intent {intent!r}; "
            f"expected one of {sorted(KNOWN_INTENTS)}",
        )
    if intent in (INTENT_UI_BUILD, INTENT_UI_IMPROVE):
        return "ui"
    if intent == INTENT_UI_TRIVIAL:
        return "ui-trivial"
    if intent == INTENT_MIXED:
        return "mixed"
    return "backend"


# --- helpers ----------------------------------------------------------

def _has_ui_signal(text: str) -> bool:
    if any(re.search(rf"\b{re.escape(w)}\b", text) for w in _UI_NOUNS):
        return True
    return any(s in text for s in _UI_STYLE)


def _has_backend_signal(text: str) -> bool:
    return any(re.search(rf"\b{re.escape(w)}\b", text) for w in _BACKEND_SIGNALS)


def _is_trivial(text: str) -> bool:
    if _TRIVIAL_PATTERN.search(text):
        return True
    return any(re.search(rf"\b{re.escape(v)}\b", text) for v in _TRIVIAL_VERBS) and len(
        text.split()
    ) <= 14


def _is_improve(text: str) -> bool:
    if _EXISTING_SURFACE.search(text):
        return True
    return any(re.search(rf"\b{re.escape(v)}\b", text) for v in _IMPROVE_VERBS)


def _is_build(text: str) -> bool:
    if _NEW_SURFACE.search(text):
        return True
    return any(re.search(rf"\b{re.escape(v)}\b", text) for v in _BUILD_VERBS)


def populate_routing(state: "WorkState") -> None:
    """Classify ``state.input`` and write ``intent`` + ``directive_set`` in place.

    Idempotent and override-safe: if ``state.intent`` is already a
    UI-track or mixed label (``ui-build``, ``ui-improve``, ``ui-trivial``,
    ``mixed``), the routing is left untouched. Only freshly-built states
    carrying the construction default ``backend-coding`` are reclassified.
    Loaded state files round-trip without losing a previously-recorded
    intent — including a manual user override in the JSON.

    The text fed to the classifier depends on the input envelope:

    - ``prompt`` → ``state.input.data["raw"]``
    - ``ticket`` → ``state.input.data["title"]`` + first non-empty
      acceptance criterion, falling back to ``description`` when AC is
      missing. Title is passed separately so single-line ticket
      headlines (``"Add CSV export"``) classify identically whether
      they arrive in the body or the title slot.
    - ``diff`` / ``file`` → routed directly to ``ui-improve`` without
      running the heuristic. Both envelopes are R3 Phase 1 inputs that
      describe an existing UI surface ("improve this screen"); the
      classifier's prose-oriented signals do not apply, and the audit +
      design directives downstream are the right place to read the
      diff/file contents.
    """
    if state.intent != INTENT_BACKEND:
        return

    if state.input.kind in {"diff", "file"}:
        state.intent = INTENT_UI_IMPROVE
        state.directive_set = directive_set_for(INTENT_UI_IMPROVE)
        return

    text, title = _extract_text(state)
    intent = classify_intent(text, title=title)
    state.intent = intent
    state.directive_set = directive_set_for(intent)


def _extract_text(state: "WorkState") -> tuple[str, str | None]:
    data = state.input.data or {}
    if state.input.kind == "prompt":
        return str(data.get("raw") or ""), None
    title = data.get("title")
    title_str = str(title) if isinstance(title, str) and title.strip() else None
    body_parts: list[str] = []
    ac = data.get("acceptance_criteria")
    if isinstance(ac, list):
        body_parts.extend(str(item) for item in ac if isinstance(item, str))
    description = data.get("description")
    if isinstance(description, str) and description.strip():
        body_parts.append(description)
    return " ".join(body_parts), title_str


__all__ = [
    "INTENT_BACKEND",
    "INTENT_MIXED",
    "INTENT_UI_BUILD",
    "INTENT_UI_IMPROVE",
    "INTENT_UI_TRIVIAL",
    "KNOWN_INTENTS",
    "classify_intent",
    "directive_set_for",
    "populate_routing",
]
