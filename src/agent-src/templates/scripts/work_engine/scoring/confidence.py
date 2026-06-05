"""Confidence scoring for prompt-driven execution (R2 Phase 3 Step 2).

The scorer judges whether a reconstructed prompt is good enough for the
``work_engine`` to proceed silently, halt for confirmation, or refuse to
plan. It is heuristic-only — no LLM calls — so the same prompt produces
the same score across replays and the freeze-guard harness can pin
expectations.

Rubric (each dimension 0–2, total / 10 → band):

- ``goal_clarity`` — does the raw prompt name a single action verb +
  object + observable result?
- ``scope_boundary`` — does the prompt name a file, class, module, or
  domain that bounds the change?
- ``ac_evidence`` — did the refiner produce concrete, anchored
  acceptance criteria?
- ``stack_data`` — does the prompt imply stack / data / migration work
  *and* identify the touched surface? (penalty if implied + unspecified)
- ``reversibility`` — would a wrong reconstruction be cheaply rollback-
  able?

Bands (per ``agents/roadmaps/archive/road-to-prompt-driven-execution.md``):

- ``high``   — score ≥ 0.8 → dispatcher proceeds silently
- ``medium`` — 0.5 ≤ score < 0.8 → assumptions-report halt
- ``low``    — score < 0.5 → one-question halt

The scorer is the single source of truth for both the rubric and the
band thresholds. Documentation (SKILL.md, ADR, contexts) cite this
module — they do not re-derive the values.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

# --- Public types ------------------------------------------------------

DIMENSION_NAMES: tuple[str, ...] = (
    "goal_clarity",
    "scope_boundary",
    "ac_evidence",
    "stack_data",
    "reversibility",
)
"""Canonical dimension order. Matches the roadmap rubric and is the
order :class:`ConfidenceScore.dimensions` is rendered in by callers."""

MAX_PER_DIMENSION = 2
"""Per-dimension ceiling. Five dimensions × 2 = 10 = full score."""

BAND_HIGH_MIN = 0.8
BAND_MEDIUM_MIN = 0.5
"""Band thresholds. Inclusive on the lower bound, exclusive on the upper.

A score of exactly 0.8 lands in ``high`` (per roadmap: ``high ≥ 0.8``);
exactly 0.5 lands in ``medium``. Anything below 0.5 is ``low``."""


@dataclass(frozen=True)
class ConfidenceScore:
    """Immutable result of one scoring pass.

    ``frozen=True`` so callers cannot accidentally mutate a band after
    the dispatcher has already routed on it. The dispatcher reads
    ``band`` and (for low-band halts) ``reasons``; the per-dimension
    breakdown is logged in the delivery report for replay traceability.
    """

    band: str
    score: float
    dimensions: dict[str, int]
    reasons: list[str] = field(default_factory=list)
    ui_intent: bool = False


# --- Heuristic vocabularies -------------------------------------------

_ACTION_VERBS: frozenset[str] = frozenset({
    "add", "build", "create", "implement", "introduce", "write",
    "fix", "patch", "repair", "resolve",
    "refactor", "rename", "extract", "inline", "split",
    "remove", "delete", "drop", "purge",
    "update", "upgrade", "bump", "migrate",
    "optimize", "speed", "improve", "tune",
    "document", "describe", "explain",
    "test", "validate", "verify",
    "expose", "publish", "deprecate",
    "configure", "wire", "connect",
})

_DOMAIN_NOUNS: frozenset[str] = frozenset({
    "auth", "authentication", "authorization", "login", "logout", "signup",
    "user", "users", "account", "profile",
    "dashboard", "search", "checkout", "cart", "billing", "payment",
    "admin", "settings", "config",
    "api", "endpoint", "webhook", "queue", "job", "worker",
    "frontend", "backend", "ui", "view", "page", "form",
    "database", "migration", "schema",
    "report", "export", "import",
})

_STACK_DATA_KEYWORDS: frozenset[str] = frozenset({
    "migration", "schema", "table", "column", "index",
    "database", "db", "postgres", "mysql", "mariadb", "sqlite",
    "redis", "cache", "queue",
    "dependency", "package", "library", "framework", "upgrade",
    "breaking change", "deprecate", "api version",
    "deploy", "release",
})

_IRREVERSIBLE_KEYWORDS: frozenset[str] = frozenset({
    "drop ", "delete ", "purge", "wipe", "truncate",
    "send email", "charge", "refund", "billing", "payment", "money",
    "production data", "live database", "broadcast",
})

_UI_KEYWORDS: frozenset[str] = frozenset({
    "redesign", "color", "colour", "css", "tailwind", "layout",
    "font", "spacing", "padding", "margin", "button", "icon",
    "responsive", "mobile view", "look", "polish", "prettier",
    "theme", "dark mode", "light mode",
})

_FILE_PATH_RE = re.compile(
    r"`[^`]+`"                      # backtick-wrapped tokens
    r"|[\w./-]+\.(?:py|php|ts|tsx|js|jsx|vue|blade\.php|sql|yml|yaml|json|md)"
    r"|[A-Z][\w]+(?:\\[A-Z][\w]+)+" # PHP namespaces (Foo\Bar\Baz)
    r"|[A-Z][a-zA-Z]+::[a-zA-Z]+"   # PHP static call (Foo::bar)
    r"|[a-z]+(?:[A-Z][a-z]+){2,}",  # camelCase identifiers w/ ≥2 humps
)


# --- Public API --------------------------------------------------------

def score(
    *,
    raw: str,
    ac: list[str] | None = None,
    assumptions: list[str] | None = None,
) -> ConfidenceScore:
    """Score a reconstructed prompt and return the band + rubric breakdown.

    Parameters
    ----------
    raw:
        The original user prompt text. Pre-stripped or not; the scorer
        normalises whitespace internally.
    ac:
        Reconstructed acceptance criteria from the ``refine-prompt``
        skill. ``None`` is treated as an empty list (no AC produced).
    assumptions:
        Inferred assumptions surfaced by the refiner. Currently
        informational — the rubric does not penalise assumption count
        directly because medium-band halts are the resolution surface.

    Returns
    -------
    ConfidenceScore
        Frozen dataclass carrying the band, normalised score, the
        five-dimension breakdown, human-readable reasons, and a UI-intent
        flag for R3 routing.
    """
    text = (raw or "").strip()
    text_lower = text.lower()
    ac_list = list(ac or ())

    g_val, g_reason = _score_goal_clarity(text, text_lower)
    s_val, s_reason = _score_scope_boundary(text, text_lower)
    e_val, e_reason = _score_acceptance_evidence(ac_list)
    k_val, k_reason = _score_stack_data(text_lower)
    r_val, r_reason = _score_reversibility(text_lower)

    dimensions = {
        "goal_clarity": g_val,
        "scope_boundary": s_val,
        "ac_evidence": e_val,
        "stack_data": k_val,
        "reversibility": r_val,
    }
    total = sum(dimensions.values())
    norm = round(total / (MAX_PER_DIMENSION * len(DIMENSION_NAMES)), 4)
    return ConfidenceScore(
        band=_band_from_score(norm),
        score=norm,
        dimensions=dimensions,
        reasons=[g_reason, s_reason, e_reason, k_reason, r_reason],
        ui_intent=_detect_ui_intent(text_lower),
    )


# --- Band mapping ------------------------------------------------------

def _band_from_score(score_value: float) -> str:
    """Map a normalised score to one of ``high`` / ``medium`` / ``low``.

    Inclusive on the lower bound to match the roadmap contract
    (``high \u2265 0.8``); a score of exactly ``0.8`` lands in ``high``,
    exactly ``0.5`` in ``medium``, anything below ``0.5`` in ``low``.
    """
    if score_value >= BAND_HIGH_MIN:
        return "high"
    if score_value >= BAND_MEDIUM_MIN:
        return "medium"
    return "low"


# --- Per-dimension scorers --------------------------------------------

def _score_goal_clarity(text: str, text_lower: str) -> tuple[int, str]:
    """Score whether the prompt names a single, observable outcome."""
    if not text:
        return 0, "goal_clarity=0: empty prompt"
    has_verb = any(
        re.search(rf"\b{re.escape(v)}\w*\b", text_lower)
        for v in _ACTION_VERBS
    )
    is_question = text.rstrip().endswith("?")
    word_count = len(text.split())
    conjunction_split = bool(re.search(r"\b(and then|and also|plus)\b", text_lower))

    if has_verb and not is_question and 4 <= word_count <= 40 and not conjunction_split:
        return 2, "goal_clarity=2: action verb + bounded length + single outcome"
    if has_verb and not is_question:
        if conjunction_split:
            return 1, "goal_clarity=1: verb present but multiple outcomes joined"
        return 1, "goal_clarity=1: verb present but length is borderline"
    if is_question:
        return 0, "goal_clarity=0: prompt is a question, no executable verb"
    return 0, "goal_clarity=0: no recognisable action verb"


def _score_scope_boundary(text: str, text_lower: str) -> tuple[int, str]:
    """Score whether the prompt bounds the change to a concrete surface."""
    has_path = bool(_FILE_PATH_RE.search(text))
    has_domain = any(
        re.search(rf"\b{re.escape(n)}\b", text_lower)
        for n in _DOMAIN_NOUNS
    )
    if has_path:
        return 2, "scope_boundary=2: explicit file/class/identifier named"
    if has_domain:
        return 1, "scope_boundary=1: domain noun present, no concrete path"
    return 0, "scope_boundary=0: no file or domain anchor"


def _score_acceptance_evidence(ac: list[str]) -> tuple[int, str]:
    """Score the reconstructed AC list produced by the refiner."""
    n = len(ac)
    if n == 0:
        return 0, "ac_evidence=0: no acceptance criteria reconstructed"
    anchored_signals = ("should", "must", "given", "when", "then", "expect")
    anchored = sum(
        1 for line in ac
        if any(s in line.lower() for s in anchored_signals)
    )
    if n >= 3 and anchored >= 2:
        return 2, f"ac_evidence=2: {n} criteria, {anchored} anchored"
    if n >= 1:
        return 1, f"ac_evidence=1: {n} criteria, {anchored} anchored"
    return 0, "ac_evidence=0: empty AC list"


def _score_stack_data(text_lower: str) -> tuple[int, str]:
    """Penalise stack/data work that is implied but not bounded."""
    implies_stack = any(k in text_lower for k in _STACK_DATA_KEYWORDS)
    if not implies_stack:
        return 2, "stack_data=2: prompt is behavioural, no stack/data signal"
    has_target = bool(re.search(
        r"\b(table|column|index|file|migration)\s+[`\"\w]",
        text_lower,
    ))
    if has_target:
        return 2, "stack_data=2: stack/data work named with explicit target"
    return 0, "stack_data=0: stack/data work implied without target"


def _score_reversibility(text_lower: str) -> tuple[int, str]:
    """Score how cheaply a wrong reconstruction could be rolled back."""
    if any(k in text_lower for k in _IRREVERSIBLE_KEYWORDS):
        return 0, "reversibility=0: irreversible keyword detected"
    config_signals = ("config", "env", "secret", ".env", "deploy")
    if any(s in text_lower for s in config_signals):
        return 1, "reversibility=1: config/env surface, partial rollback cost"
    return 2, "reversibility=2: code-only change, cheap to revert"


def _detect_ui_intent(text_lower: str) -> bool:
    """Flag prompts that read as UI work for R3 routing."""
    return any(k in text_lower for k in _UI_KEYWORDS)


__all__ = [
    "BAND_HIGH_MIN",
    "BAND_MEDIUM_MIN",
    "ConfidenceScore",
    "DIMENSION_NAMES",
    "MAX_PER_DIMENSION",
    "score",
]
