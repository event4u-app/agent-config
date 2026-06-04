"""Council-necessity classifier (Phase 6).

Heuristic pre-flight that decides whether the request actually warrants
a council deliberation. Three verdicts drive three exit paths in the
dispatcher (skip / educate / proceed). See
``docs/contracts/ai-council-config.md`` for the trigger lists and the
toggle schema.

The classifier is **shape-based**, not semantic — it scans the prompt
for marker words associated with each bucket. False positives are
preferable to false negatives on the `necessary` side (an extra council
run is cheaper than a missed strategic decision); the educate path
exists exactly to let the user override a wrong `unnecessary` verdict.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

NecessityVerdict = Literal["necessary", "borderline", "unnecessary"]
Invocation = Literal["agent", "user_explicit"]

#: Length tier cut-offs in characters (stripped prompt). Tier names are
#: used in :func:`classify_size_fit` rationales; tweak only with a
#: parametrised test update.
_SHORT_PROMPT_MAX = 200
_MEDIUM_PROMPT_MAX = 800

#: Lenses where the size classifier never suggests a downgrade. Debate
#: is structurally expensive but also depends on top-tier reasoning to
#: produce useful dissent — surfacing a downgrade prompt mid-debate
#: degrades signal-to-noise.
_NO_DOWNGRADE_LENSES = frozenset({"debate"})

#: Trigger words that flag a prompt as `necessary`. Each entry must be
#: a lowercase, whole-word match — surrounding word boundaries are
#: enforced by :func:`_count_matches`. Buckets:
#:
#: - architecture: structural / boundary / cross-component decisions
#: - tradeoff: multi-stakeholder or multi-axis trade-off shape
#: - ambiguity: explicit uncertainty markers in the prompt
#: - strategic: decision verbs that move the artefact across a fork
NECESSARY_TRIGGERS: dict[str, tuple[str, ...]] = {
    "architecture": (
        "architecture", "architectural", "system design", "boundary",
        "boundaries", "coupling", "decouple", "monorepo", "microservice",
        "microservices", "service boundary", "module boundary",
        "refactor strategy", "migration plan", "rewrite", "redesign",
    ),
    "tradeoff": (
        "trade-off", "tradeoff", "trade off", "stakeholder", "stakeholders",
        "competing", "tension", "balance", "weigh", "pros and cons",
        "alternatives", "options", "vs", "versus",
    ),
    "ambiguity": (
        "unsure", "uncertain", "ambiguous", "unclear", "not sure",
        "don't know", "dont know", "open question", "controversial",
        "debate", "second opinion", "sanity check",
    ),
    "strategic": (
        "should we", "shall we", "do we", "roadmap", "long-term",
        "strategic", "strategy", "vision", "direction", "decision",
        "decide", "choose", "select", "approach", "policy",
    ),
}

#: Trigger words that flag a prompt as `unnecessary`. Same matching
#: rules as :data:`NECESSARY_TRIGGERS`. Buckets:
#:
#: - bugfix: localised defect / error / crash hunt
#: - syntax: tooling / format / lint level
#: - single_file: implementation scoped to one file or function
#: - lookup: information retrieval, not deliberation
UNNECESSARY_TRIGGERS: dict[str, tuple[str, ...]] = {
    "bugfix": (
        "bug", "bugfix", "fix bug", "crash", "error", "exception",
        "stack trace", "traceback", "failing test", "fails", "broken",
        "regression",
    ),
    "syntax": (
        "syntax", "typo", "format", "formatting", "lint", "linter",
        "indent", "indentation", "rename", "import order",
    ),
    "single_file": (
        "this function", "this method", "this file", "one-line",
        "one liner", "small change", "rename", "extract method",
        "extract function", "add a getter", "add a setter",
    ),
    "lookup": (
        "what is", "what's", "what does", "how does", "look up",
        "documentation", "docs", "example", "snippet", "syntax of",
        "api of",
    ),
}

#: Lenses where the necessity bar is tighter — debate is expensive, so
#: a `borderline` verdict on the `debate` lens gets nudged toward
#: `unnecessary` when no `necessary` marker is present. `pr` lens fires
#: on diffs and stays neutral. Other lenses use the default scoring.
_STRICT_LENSES = frozenset({"debate"})


@dataclass(frozen=True)
class ClassificationResult:
    """Outcome of a necessity classification.

    Attributes:
        verdict: One of ``necessary`` / ``borderline`` / ``unnecessary``.
        category: Best-match trigger bucket (``architecture``, ``bugfix``,
            ``lookup``, …) or ``"unclassified"`` when no marker fired.
        rationale: One-line human-readable explanation suitable for
            inline display in session.md or the educate path.
        necessary_hits: Number of `necessary` triggers matched.
        unnecessary_hits: Number of `unnecessary` triggers matched.
    """

    verdict: NecessityVerdict
    category: str
    rationale: str
    necessary_hits: int
    unnecessary_hits: int


_WORD_RE_CACHE: dict[str, re.Pattern[str]] = {}


def _compile(trigger: str) -> re.Pattern[str]:
    cached = _WORD_RE_CACHE.get(trigger)
    if cached is not None:
        return cached
    if any(ch.isspace() for ch in trigger):
        pattern = r"\b" + re.escape(trigger) + r"\b"
    else:
        pattern = r"\b" + re.escape(trigger) + r"\b"
    compiled = re.compile(pattern, flags=re.IGNORECASE)
    _WORD_RE_CACHE[trigger] = compiled
    return compiled


def _count_matches(
    text: str, triggers: dict[str, tuple[str, ...]],
) -> tuple[int, str | None]:
    """Return ``(total_hits, top_bucket_or_None)``.

    Top bucket = the bucket with the most matches in ``text``. Ties are
    broken by definition order in the input dict — Python dicts preserve
    insertion order, so the trigger tables above act as priority lists.
    """
    best_bucket: str | None = None
    best_count = 0
    total = 0
    for bucket, words in triggers.items():
        count = 0
        for w in words:
            if _compile(w).search(text):
                count += 1
        total += count
        if count > best_count:
            best_count = count
            best_bucket = bucket
    return total, best_bucket


def classify_necessity(
    prompt: str,
    lens: str = "analysis",
    invocation: Invocation = "agent",
) -> ClassificationResult:
    """Classify a council request as necessary / borderline / unnecessary.

    Args:
        prompt: The raw prompt text the council would deliberate on.
            Whitespace-stripped; empty input maps to ``unnecessary`` /
            ``"empty"``.
        lens: Active lens (``analysis``, ``debate``, ``pr``, …). Strict
            lenses (currently ``debate``) raise the bar — a borderline
            verdict with no `necessary` hits flips to ``unnecessary``.
        invocation: Source signal — ``agent`` or ``user_explicit``.
            Does not change the verdict itself; the dispatcher routes
            on the pair ``(verdict, invocation)``.

    Returns:
        :class:`ClassificationResult` with verdict, top-matched
        category, one-line rationale, and raw hit counts (useful for
        tests and session.md provenance).
    """
    text = (prompt or "").strip()
    if not text:
        return ClassificationResult(
            verdict="unnecessary",
            category="empty",
            rationale="Empty prompt — nothing to deliberate.",
            necessary_hits=0,
            unnecessary_hits=0,
        )

    n_hits, n_bucket = _count_matches(text, NECESSARY_TRIGGERS)
    u_hits, u_bucket = _count_matches(text, UNNECESSARY_TRIGGERS)

    # Decision table (intentionally simple — heuristic by design):
    #   strong necessary signal     → necessary
    #   strong unnecessary signal   → unnecessary (unless necessary also fires)
    #   mixed                       → borderline
    #   no signal                   → borderline
    if n_hits >= 2 and n_hits > u_hits:
        verdict: NecessityVerdict = "necessary"
        category = n_bucket or "unclassified"
        rationale = (
            f"Matched {n_hits} `necessary` trigger(s) in bucket "
            f"`{category}`; council deliberation typically warranted."
        )
    elif n_hits >= 1 and u_hits == 0:
        verdict = "necessary" if n_hits >= 2 else "borderline"
        category = n_bucket or "unclassified"
        rationale = (
            f"{n_hits} `necessary` marker(s) in `{category}`, no "
            f"`unnecessary` markers — leaning toward deliberation."
        )
    elif u_hits >= 2 and n_hits == 0:
        verdict = "unnecessary"
        category = u_bucket or "unclassified"
        rationale = (
            f"Matched {u_hits} `unnecessary` trigger(s) in bucket "
            f"`{category}`; council typically does not add value here."
        )
    elif u_hits >= 1 and n_hits == 0:
        verdict = "unnecessary" if u_hits >= 2 else "borderline"
        category = u_bucket or "unclassified"
        rationale = (
            f"{u_hits} `unnecessary` marker(s) in `{category}`, no "
            f"`necessary` markers — leaning away from deliberation."
        )
    else:
        # Mixed or no markers — borderline by default.
        verdict = "borderline"
        category = (n_bucket or u_bucket) or "unclassified"
        rationale = (
            f"Mixed signals: necessary={n_hits}, unnecessary={u_hits}. "
            f"Borderline — proceed with a one-line note in session.md."
        )

    # Lens-strictness pass: debate-tier lenses nudge borderline →
    # unnecessary when no `necessary` marker is present, to prevent
    # expensive debate runs on trivial questions.
    if (
        lens in _STRICT_LENSES
        and verdict == "borderline"
        and n_hits == 0
    ):
        verdict = "unnecessary"
        rationale = (
            f"Lens `{lens}` is strict (expensive deliberation); "
            f"borderline with zero `necessary` markers → unnecessary."
        )

    return ClassificationResult(
        verdict=verdict,
        category=category,
        rationale=rationale,
        necessary_hits=n_hits,
        unnecessary_hits=u_hits,
    )


def educate_message(result: ClassificationResult, lens: str) -> str:
    """Return the user-facing educate paragraph for the dispatcher.

    Emitted only on the `user_explicit + unnecessary` path. The skill
    layer pairs this with a numbered-options prompt (1=proceed,
    2=skip); the CLI surfaces it as plain text and returns a non-zero
    exit code unless ``--proceed-anyway`` is set.
    """
    return (
        f"This request looks like `{result.category}` "
        f"({result.unnecessary_hits} matching marker(s)) on the "
        f"`{lens}` lens. Council typically adds value when the request "
        f"involves architectural trade-offs, multi-stakeholder "
        f"decisions, or strategic direction — not for localised bug "
        f"fixes, syntax / formatting work, or lookups.\n"
        f"\n"
        f"Re-run with `--proceed-anyway` to invoke the council anyway."
    )


# --- Phase 7: Model-size classifier + downgrade suggestion ---------------


@dataclass(frozen=True)
class SizeFitVerdict:
    """Outcome of a model-size fit classification.

    Attributes:
        fit: ``True`` when ``current_model`` is appropriate for the
            prompt shape; ``False`` when a cheaper / faster sibling on
            the same ladder would answer as well.
        suggested_model: ladder entry recommended when ``fit=False``.
            ``None`` when ``fit=True`` (no swap proposed).
        reason: one-line human-readable rationale.
        current_index: zero-based index of ``current_model`` in the
            ladder (smallest = 0). ``-1`` when ``current_model`` is not
            on the ladder.
        length_tier: ``"short"`` / ``"medium"`` / ``"long"``.
        complexity_hits: count of `necessary`-bucket markers in the
            prompt (proxy for "needs big model").
    """

    fit: bool
    suggested_model: str | None
    reason: str
    current_index: int
    length_tier: Literal["short", "medium", "long"]
    complexity_hits: int


def _length_tier(text: str) -> Literal["short", "medium", "long"]:
    if len(text) < _SHORT_PROMPT_MAX:
        return "short"
    if len(text) < _MEDIUM_PROMPT_MAX:
        return "medium"
    return "long"


def classify_size_fit(
    prompt: str,
    current_model: str,
    ladder: tuple[str, ...] | list[str],
    lens: str = "analysis",
) -> SizeFitVerdict:
    """Decide whether ``current_model`` fits the prompt shape.

    Heuristic — never suggests an UP-tier swap (Phase 7 is downgrade-
    only). When the prompt is short AND carries no complexity markers
    AND the current model is above the smallest tier, suggest the next
    rung down. Longer prompts or multi-axis complexity keep the current
    model.

    Args:
        prompt: raw prompt text the council would deliberate on.
        current_model: model id currently selected for the member.
        ladder: provider's `model_ladder` ordered smallest → largest.
            When ``current_model`` is not on the ladder, returns
            ``fit=True`` with an explanatory reason (no downgrade
            suggested — caller should configure the ladder first).
        lens: active lens; ``debate`` lens disables downgrade
            suggestions to keep dissent quality high.

    Returns:
        :class:`SizeFitVerdict`.
    """
    text = (prompt or "").strip()
    tier = _length_tier(text)
    n_hits, _ = _count_matches(text.lower(), NECESSARY_TRIGGERS)

    ladder_list = list(ladder or ())
    try:
        idx = ladder_list.index(current_model)
    except ValueError:
        return SizeFitVerdict(
            fit=True,
            suggested_model=None,
            reason=(
                f"`{current_model}` is not on the configured ladder "
                f"({ladder_list or 'empty'}) — no downgrade path."
            ),
            current_index=-1,
            length_tier=tier,
            complexity_hits=n_hits,
        )

    if idx == 0:
        return SizeFitVerdict(
            fit=True,
            suggested_model=None,
            reason=f"`{current_model}` is already on the smallest tier.",
            current_index=idx,
            length_tier=tier,
            complexity_hits=n_hits,
        )

    if lens in _NO_DOWNGRADE_LENSES:
        return SizeFitVerdict(
            fit=True,
            suggested_model=None,
            reason=(
                f"Lens `{lens}` keeps the top tier for dissent quality; "
                f"no downgrade suggested."
            ),
            current_index=idx,
            length_tier=tier,
            complexity_hits=n_hits,
        )

    if n_hits >= 2 or tier == "long":
        return SizeFitVerdict(
            fit=True,
            suggested_model=None,
            reason=(
                f"Complexity warrants the current tier "
                f"(length={tier}, complexity_hits={n_hits})."
            ),
            current_index=idx,
            length_tier=tier,
            complexity_hits=n_hits,
        )

    if tier == "short" and n_hits == 0:
        suggested = ladder_list[max(0, idx - 1)]
        return SizeFitVerdict(
            fit=False,
            suggested_model=suggested,
            reason=(
                f"Short prompt ({len(text)} chars) with no complexity "
                f"markers — `{suggested}` should answer as well."
            ),
            current_index=idx,
            length_tier=tier,
            complexity_hits=n_hits,
        )

    if tier == "medium" and n_hits == 0 and idx >= 1:
        suggested = ladder_list[max(0, idx - 1)]
        return SizeFitVerdict(
            fit=False,
            suggested_model=suggested,
            reason=(
                f"Medium-length prompt with no complexity markers — "
                f"`{suggested}` likely sufficient."
            ),
            current_index=idx,
            length_tier=tier,
            complexity_hits=n_hits,
        )

    return SizeFitVerdict(
        fit=True,
        suggested_model=None,
        reason=(
            f"Length / complexity balance keeps current tier "
            f"(length={tier}, complexity_hits={n_hits})."
        ),
        current_index=idx,
        length_tier=tier,
        complexity_hits=n_hits,
    )


def downgrade_message(verdict: SizeFitVerdict, current_model: str) -> str:
    """User-facing downgrade-suggestion paragraph.

    Emitted by the dispatcher when ``model_downgrade`` is enabled and
    ``classify_size_fit`` returned ``fit=False``. Followed by a single
    numbered-options prompt at the agent surface (1=use suggested /
    2=keep current / 3=skip this member).
    """
    return (
        f"Current model `{current_model}` looks oversized for this "
        f"request. Suggested: `{verdict.suggested_model}` "
        f"(reason: {verdict.reason})."
    )


# --- Phase 10: Five-class impact classifier + routing --------------------

ImpactClass = Literal[
    "trivial", "low_impact", "medium_impact", "high_impact", "user_required",
]

#: Classes that are structurally LOCKED to ``user`` routing. The
#: schema validator in ``config.py`` rejects any attempt to remap
#: these via ``decision_resolution.<class>.mode``. Iron Law per the
#: roadmap: security / auth / billing / tenant-boundary / migration /
#: production-destructive decisions always reach the user.
LOCKED_IMPACT_CLASSES: frozenset[ImpactClass] = frozenset(
    {"high_impact", "user_required"},
)

#: User-fence markers that force ``user_required`` regardless of any
#: other signal. Mirrors the "fenced step" language in
#: ``scope-control``: when the user has set a review gate, the agent
#: never auto-routes the question away from them.
_USER_FENCE_MARKERS: tuple[str, ...] = (
    "ask me", "review first", "plan only", "don't decide", "do not decide",
    "wait for me", "I'll decide", "i will decide", "let me decide",
    "frag mich", "warte auf mich",
)

#: Trigger words per impact class. Whole-word match via
#: :func:`_count_matches`. Ordered by structural severity — when a
#: prompt matches multiple classes, the higher-severity class wins
#: (handled by the override precedence in :func:`classify_impact`).
IMPACT_TRIGGERS: dict[ImpactClass, tuple[str, ...]] = {
    "trivial": (
        "naming", "rename", "name this", "what should i call",
        "whitespace", "indent", "indentation", "comment style",
        "import order", "import ordering", "variable case", "snake_case",
        "camelcase", "typo", "spacing",
    ),
    "low_impact": (
        "service vs repository", "repository vs service", "idiom",
        "dto", "dto vs array", "value object", "job vs sync",
        "queue vs sync", "test extension", "test suffix", "trait vs class",
        "helper vs static", "use composition", "use inheritance",
    ),
    "medium_impact": (
        "api shape", "endpoint shape", "contract change", "contract update",
        "cross-module", "cross module", "module boundary", "package boundary",
        "interface change", "signature change", "breaking change",
    ),
    "high_impact": (
        "security", "auth", "authentication", "authorization", "permission",
        "tenant", "tenants", "tenant boundary", "migration", "schema migration",
        "production", "prod database", "destructive", "drop table", "truncate",
        "delete column", "billing", "secret", "secrets", "api key",
        "credentials", "encryption", "sso", "oauth", "iam",
        "policy change", "data retention", "personal data", "pii",
    ),
}


@dataclass(frozen=True)
class ImpactVerdict:
    """Outcome of an impact classification (Phase 10).

    Attributes:
        impact_class: One of :data:`ImpactClass`.
        confidence: 0.0–1.0 self-rated certainty in the verdict.
            Used by the routing layer's ``confidence_threshold`` gate:
            high-confidence ``low_impact`` skips council, low-confidence
            falls through to council (Phase 11) or user.
        rationale: One-line explanation suitable for inline session.md
            display. Includes the matched trigger bucket when applicable.
        category: Best-match trigger bucket (or ``"unclassified"`` when
            no marker fired and the prompt defaulted to a class).
    """

    impact_class: ImpactClass
    confidence: float
    rationale: str
    category: str


def classify_impact(question_text: str) -> ImpactVerdict:
    """Classify a pending agent question by stakes / blast-radius.

    Heuristic, keyword-shape based — no LLM call, fully explainable.
    Precedence (highest wins): user-fence marker → high_impact markers
    → medium_impact markers → low_impact markers → trivial markers →
    default fallback. Confidence is rule-based and reflects how many
    distinct markers fired, not learned probability.

    Args:
        question_text: The pending question text the agent is about
            to surface. Whitespace-stripped before scanning; empty
            input maps to ``user_required`` / confidence ``1.0`` (no
            agent should silently resolve an empty question).

    Returns:
        :class:`ImpactVerdict` with class, confidence, rationale,
        and matched bucket.
    """
    text = (question_text or "").strip()
    if not text:
        return ImpactVerdict(
            impact_class="user_required",
            confidence=1.0,
            rationale="Empty question — user must clarify.",
            category="empty",
        )

    lower = text.lower()

    # User fence → user_required, beats every other signal. The agent
    # never auto-routes around an explicit review gate.
    for marker in _USER_FENCE_MARKERS:
        if _compile(marker).search(lower):
            return ImpactVerdict(
                impact_class="user_required",
                confidence=1.0,
                rationale=(
                    f"User-fence marker (`{marker}`) — explicit review "
                    f"gate, routes to user regardless of topic."
                ),
                category="user_fence",
            )


    # Severity precedence: count distinct triggers per class, take the
    # highest-severity class with at least one hit. Confidence scales
    # with hit count for the winning class.
    hits_per_class: dict[ImpactClass, tuple[int, str]] = {}
    for cls in ("high_impact", "medium_impact", "low_impact", "trivial"):
        hits, bucket = _count_matches(lower, {cls: IMPACT_TRIGGERS[cls]})
        if hits:
            hits_per_class[cls] = (hits, bucket or cls)

    for cls in ("high_impact", "medium_impact", "low_impact", "trivial"):
        if cls in hits_per_class:
            hits, bucket = hits_per_class[cls]
            confidence = min(1.0, 0.5 + 0.15 * hits)
            # high_impact is Iron-Law: cap confidence at 1.0 with at
            # least one explicit marker — never downgrade.
            if cls == "high_impact":
                confidence = max(confidence, 0.85)
            rationale = (
                f"Matched {hits} `{cls}` marker(s) in bucket `{bucket}` — "
                f"confidence {confidence:.2f}."
            )
            return ImpactVerdict(
                impact_class=cls,
                confidence=confidence,
                rationale=rationale,
                category=bucket,
            )

    # No markers fired — default to medium_impact / low confidence so
    # the routing layer falls through to council or user rather than
    # silently letting the agent resolve.
    return ImpactVerdict(
        impact_class="medium_impact",
        confidence=0.3,
        rationale=(
            "No impact markers fired — defaulting to `medium_impact` at "
            "low confidence; routing layer should escalate."
        ),
        category="unclassified",
    )



def load_validated_phrases(corpus_path: "object") -> tuple[str, ...]:
    """Return normalised `## Validated` question strings from a corpus.

    Thin re-export of :func:`scripts.ai_council.low_impact_corpus.load_validated_phrases`
    — the hardened parser (step-9 P4) lives there; routing stays lenient
    so a broken corpus never blocks classification. Strict-mode
    contract validation lives in
    :func:`scripts.ai_council.low_impact_corpus.parse_corpus_strict`.
    """
    from scripts.ai_council.low_impact_corpus import (
        load_validated_phrases as _load,
    )
    return _load(corpus_path)


def classify_impact_with_corpus(
    question_text: str,
    corpus_paths: "tuple[object, ...] | None" = None,
) -> ImpactVerdict:
    """Corpus-aware variant of :func:`classify_impact` (Phase 12).

    Loads ``## Validated`` phrases from every ``corpus_paths`` entry
    (project-local first, upstream seed second) and short-circuits to
    ``low_impact`` confidence ``0.9`` on exact-after-normalisation
    match. Probation / anti-example sections are excluded.

    The locked-class Iron Law from :func:`classify_impact` still wins
    — user-fence markers AND ``high_impact`` triggers are checked
    BEFORE the corpus lookup, so a question with both a corpus hit and
    a security marker still routes to ``user``.
    """
    base = classify_impact(question_text)
    if base.impact_class in LOCKED_IMPACT_CLASSES:
        return base
    if not corpus_paths:
        return base
    norm_q = re.sub(r"[^\w\s]", " ", (question_text or "").lower())
    norm_q = re.sub(r"\s+", " ", norm_q).strip()
    if not norm_q:
        return base
    for path in corpus_paths:
        for phrase in load_validated_phrases(path):
            if norm_q == phrase:
                return ImpactVerdict(
                    impact_class="low_impact",
                    confidence=0.9,
                    rationale=(
                        "Matched Validated corpus entry — routing as "
                        "`low_impact` (Phase 12 learning loop)."
                    ),
                    category="corpus_validated",
                )
    return base


ResolutionMode = Literal["agent", "council", "user"]
_RESOLUTION_RUNGS: tuple[ResolutionMode, ...] = ("agent", "council", "user")


@dataclass(frozen=True)
class DecisionRouting:
    """Final routing decision (Phase 10).

    Combines :class:`ImpactVerdict` with the per-class
    ``DecisionResolutionEntry`` from config to produce the mode the
    chokepoint should dispatch to.

    Attributes:
        verdict: Underlying impact classification.
        mode: Final resolution mode after Iron-Law + confidence-gate.
        upgraded: ``True`` when the confidence-threshold pushed the
            mode one rung up (e.g. ``agent`` → ``council``).
        rationale: One-line explanation suitable for session.md.
    """

    verdict: ImpactVerdict
    mode: ResolutionMode
    upgraded: bool
    rationale: str


def route_decision(
    question_text: str,
    classes: dict[str, "object"],
) -> DecisionRouting:
    """Classify + route a pending agent question.

    Args:
        question_text: The text the agent was about to ask the user.
        classes: Mapping ``impact_class -> DecisionResolutionEntry``
            (typed loosely to keep this module free of a config
            import cycle). Each entry must expose ``mode`` and
            ``confidence_threshold`` attributes.

    Returns:
        :class:`DecisionRouting` with the final mode. Iron Law:
        :data:`LOCKED_IMPACT_CLASSES` always returns ``mode="user"``
        regardless of config or confidence.
    """
    verdict = classify_impact(question_text)
    entry = classes.get(verdict.impact_class)
    if entry is None:
        # No config — Iron-Law fallback to user.
        return DecisionRouting(
            verdict=verdict,
            mode="user",
            upgraded=False,
            rationale=(
                f"No routing entry for `{verdict.impact_class}` — "
                f"defaulting to user (Iron-Law fallback)."
            ),
        )

    base_mode: ResolutionMode = getattr(entry, "mode", "user")  # type: ignore[assignment]
    threshold: float = getattr(entry, "confidence_threshold", 0.6)

    if verdict.impact_class in LOCKED_IMPACT_CLASSES:
        return DecisionRouting(
            verdict=verdict,
            mode="user",
            upgraded=False,
            rationale=(
                f"`{verdict.impact_class}` is Iron-Law locked to `user` "
                f"— bypass refused."
            ),
        )

    upgraded = False
    mode: ResolutionMode = base_mode
    if mode != "user" and verdict.confidence < threshold:
        try:
            idx = _RESOLUTION_RUNGS.index(base_mode)
            mode = _RESOLUTION_RUNGS[min(idx + 1, len(_RESOLUTION_RUNGS) - 1)]
            upgraded = mode != base_mode
        except ValueError:
            mode = "user"
            upgraded = True

    rationale = (
        f"Class `{verdict.impact_class}` (confidence "
        f"{verdict.confidence:.2f}, threshold {threshold:.2f}) → "
        f"mode `{mode}`"
        + (f" (upgraded from `{base_mode}`)" if upgraded else "")
        + "."
    )
    return DecisionRouting(
        verdict=verdict,
        mode=mode,
        upgraded=upgraded,
        rationale=rationale,
    )
