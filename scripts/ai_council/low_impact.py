"""Lightweight-QA fast-path resolver (Phase 11).

When ``decision_resolution.classes.low_impact.mode = council`` fires,
this module narrows the standard council fan-out to the opted-in
members, caps the spend at the ``decision_resolution.fast_path``
budget, and stamps a transparency marker on the result so the host
agent can surface that the answer came from the lightweight path.

The fast-path is a strict subset of the standard ``consult()`` flow:

- members filtered to ``participate_low_impact = True`` (and ``enabled``);
- list truncated to ``LowImpactFastPathConfig.max_members`` (1 or 2);
- ``CostBudget.max_calls = max_members``;
- ``CostBudget.max_total_usd = max_cost_usd``;
- token caps tightened to ``max_tokens`` (split 60 / 40 in / out);
- ``rounds`` locked to 1 — multi-round debate defeats the purpose.

Iron Law (Phase 10) is unaffected: ``high_impact`` and ``user_required``
never reach this module — they route to ``user`` at the config layer.
This module is only consulted for the ``low_impact`` class.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable, Literal

from scripts.ai_council.clients import CouncilResponse, ExternalAIClient
from scripts.ai_council.config import (
    LowImpactFastPathConfig,
    MemberConfig,
)
from scripts.ai_council.orchestrator import CostBudget


#: Token split ratio between input prompt and output budget when the
#: fast-path caps the total. 60 / 40 mirrors the empirical mix observed
#: for short Q&A — Q is long-ish, A is terse. Tunable; kept private so
#: the contract surface stays at ``max_tokens``.
_INPUT_RATIO = 0.6


@dataclass(frozen=True)
class FastPathPlan:
    """Resolved fast-path execution plan (Phase 11).

    Attributes:
        members: Ordered list of member configs to invoke. Empty when
            no member opted in — the caller must fall back to the
            standard council path or escalate.
        budget: ``CostBudget`` pre-sized to the fast-path caps. Safe
            to pass directly to :func:`orchestrator.consult`.
        marker: One-line transparency string for the rendered output
            (e.g. ``"[fast-path: 2 members · cap $0.05]"``). Surface
            it to the user so fast-path resolutions are distinguishable
            from standard council runs.
        reason: Diagnostic string explaining the plan shape — used by
            the CLI and tests. Empty when ``members`` is non-empty.
    """

    members: tuple[MemberConfig, ...]
    budget: CostBudget
    marker: str
    reason: str = ""

    @property
    def is_resolvable(self) -> bool:
        """True when at least one opted-in member is available."""
        return bool(self.members)


def select_fast_path_members(
    members: dict[str, MemberConfig],
    cfg: LowImpactFastPathConfig,
) -> tuple[MemberConfig, ...]:
    """Filter and order opted-in members for the fast-path.

    Selection rules:

    - member must be ``enabled``;
    - member must have ``participate_low_impact = True``;
    - alphabetical by provider name → deterministic, easy to test,
      no hidden cost-rank heuristic to debug;
    - truncate to ``cfg.max_members`` (1 or 2 per schema).

    No price-table lookup here — the standard council path already
    runs the full cost-disclosure flow and the per-call cap in
    ``CostBudget`` is the structural backstop.
    """
    candidates = [
        m for m in members.values()
        if m.enabled and m.participate_low_impact
    ]
    candidates.sort(key=lambda m: m.name)
    return tuple(candidates[: cfg.max_members])


def build_fast_path_budget(cfg: LowImpactFastPathConfig) -> CostBudget:
    """Translate the ``fast_path`` config into a runnable ``CostBudget``.

    The 60 / 40 input / output split is a heuristic — callers that
    need an exact ceiling can override the returned ``CostBudget``
    fields. ``max_calls`` matches ``max_members`` so the orchestrator
    short-circuits as soon as the fast-path quota is exhausted.
    """
    max_in = max(1, int(cfg.max_tokens * _INPUT_RATIO))
    max_out = max(1, cfg.max_tokens - max_in)
    return CostBudget(
        max_input_tokens=max_in,
        max_output_tokens=max_out,
        max_calls=cfg.max_members,
        max_total_usd=cfg.max_cost_usd,
    )


def plan_fast_path(
    members: dict[str, MemberConfig],
    cfg: LowImpactFastPathConfig,
) -> FastPathPlan:
    """Build the full execution plan for a ``low_impact`` resolution.

    Returns a :class:`FastPathPlan`. When no member opted in, the
    plan's ``members`` tuple is empty and ``reason`` explains why —
    the caller must fall back (standard council) or escalate (user).
    """
    selected = select_fast_path_members(members, cfg)
    if not selected:
        return FastPathPlan(
            members=(),
            budget=build_fast_path_budget(cfg),
            marker="",
            reason=(
                "no member has `participate_low_impact: true` — "
                "fast-path unavailable, fall back to standard council "
                "or escalate to user."
            ),
        )
    names = ", ".join(m.name for m in selected)
    marker = (
        f"[fast-path: {len(selected)} member"
        f"{'s' if len(selected) > 1 else ''} ({names}) · "
        f"cap ${cfg.max_cost_usd:.2f} · {cfg.max_tokens} tokens]"
    )
    return FastPathPlan(
        members=selected,
        budget=build_fast_path_budget(cfg),
        marker=marker,
    )


# --- Phase 11 Step 2-3: fast-path executor + transparency marker ----------

#: Status of a :class:`FastPathResolution`. ``resolved`` = one or
#: matching answers, returned to caller; ``split`` = members disagreed,
#: caller must escalate to user with both opinions; ``aborted`` =
#: hard cap hit or all members failed, caller must escalate;
#: ``unavailable`` = plan had no opted-in members (caller never even
#: called the executor — included so the status enum is exhaustive).
FastPathStatus = Literal["resolved", "split", "aborted", "unavailable"]


#: System prompt for fast-path members. Deliberately terse — the
#: standard advisor + Karpathy peer-review machinery is bypassed by
#: design (Phase 11 contract). One sentence of rationale is asked
#: explicitly so the user-visible marker can surface a "why" without
#: a second round.
_FAST_PATH_SYSTEM = (
    "You are a fast-path council member answering a low-impact "
    "development question. Reply with: (1) a short, direct answer; "
    "(2) one sentence of rationale. No preamble, no caveats, no "
    "alternative options — just answer + rationale."
)


@dataclass(frozen=True)
class MemberAnswer:
    """One fast-path member's normalised answer.

    Attributes:
        member: Member name (e.g. ``"anthropic"``).
        text: Raw response text. ``""`` when the call errored.
        normalized: Lowercase + punctuation-stripped form used for
            agreement detection. ``""`` mirrors ``text``.
        cost_usd: Estimated spend in USD for this single call. ``0.0``
            for non-billable transports (manual / vendor-CLI).
        error: Provider-side error string, ``None`` on success.
    """

    member: str
    text: str
    normalized: str
    cost_usd: float = 0.0
    error: str | None = None

    @property
    def ok(self) -> bool:
        return self.error is None and bool(self.text.strip())


@dataclass(frozen=True)
class FastPathResolution:
    """End-to-end outcome of a low-impact fast-path resolution.

    Attributes:
        status: One of :data:`FastPathStatus`.
        answer: Final user-visible answer text. Empty when ``status``
            is ``split``, ``aborted``, or ``unavailable``.
        marker: Transparency marker line — either the plan marker
            (resolved) or a status-specific escalation marker.
        answers: Per-member normalised answers, in call order.
        total_cost_usd: Sum of per-call costs.
        session_log_line: One-line append for the session artefact
            under ``low-impact-resolutions.md``. Empty when status
            is ``unavailable`` (no call happened).
    """

    status: FastPathStatus
    answer: str
    marker: str
    answers: tuple[MemberAnswer, ...] = ()
    total_cost_usd: float = 0.0
    session_log_line: str = ""


_PUNCT_RE = re.compile(r"[^\w\s]+")
_WS_RE = re.compile(r"\s+")


def _normalize(text: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace.

    Used to detect agreement between two fast-path answers without
    fuzzy / embedding match — keeps the agreement test auditable.
    """
    lowered = (text or "").lower()
    stripped = _PUNCT_RE.sub(" ", lowered)
    return _WS_RE.sub(" ", stripped).strip()


def _build_user_prompt(question_text: str) -> str:
    return (
        f"Question: {question_text.strip()}\n\n"
        "Reply with: answer on line 1, one sentence rationale on line 2."
    )


def _aborted_marker(reason: str, members: tuple[MemberConfig, ...]) -> str:
    names = ", ".join(m.name for m in members) if members else "no members"
    return (
        f"[fast-path aborted: {reason} — escalating to user "
        f"(members tried: {names})]"
    )


def _split_marker(answers: tuple[MemberAnswer, ...]) -> str:
    parts = " · ".join(f"{a.member}: {a.text.splitlines()[0].strip()[:80]}"
                       for a in answers if a.ok)
    return f"[fast-path split — escalating to user ({parts})]"


def _answer_line(text: str) -> str:
    """Extract the answer portion (line 1) from a fast-path response."""
    for line in text.splitlines():
        stripped = line.strip()
        if stripped:
            return stripped
    return ""


def _build_member_answer(
    member: str,
    response: CouncilResponse,
    price_table: "object | None",
) -> MemberAnswer:
    """Normalise one provider call into a :class:`MemberAnswer`."""
    if response.error:
        return MemberAnswer(
            member=member, text="", normalized="",
            cost_usd=0.0, error=response.error,
        )
    text = (response.text or "").strip()
    if not text:
        return MemberAnswer(
            member=member, text="", normalized="",
            cost_usd=0.0, error="empty response",
        )
    cost = _compute_cost(response, price_table)
    return MemberAnswer(
        member=member,
        text=text,
        normalized=_normalize(_answer_line(text)),
        cost_usd=cost,
    )


def _compute_cost(
    response: CouncilResponse,
    price_table: "object | None",
) -> float:
    """Estimate USD cost for one response.

    Uses the injected ``price_table`` when available; falls back to
    ``0.0`` for non-billable transports (manual / vendor-CLI) and for
    unknown models. Never raises — cost is an observability signal,
    not a gate (the budget check is structural).
    """
    if price_table is None:
        return 0.0
    lookup = getattr(price_table, "lookup", None)
    if lookup is None:
        return 0.0
    price = lookup(response.provider, response.model)
    if price is None:
        return 0.0
    in_usd = (response.input_tokens / 1_000_000) * price.input_per_1m_usd
    out_usd = (response.output_tokens / 1_000_000) * price.output_per_1m_usd
    return in_usd + out_usd


def _session_log_line(
    question_text: str,
    status: FastPathStatus,
    answers: tuple[MemberAnswer, ...],
    total_cost: float,
    now: "datetime | None" = None,
) -> str:
    """Build a one-line append for the session artefact.

    Format: ``ISO8601 | status | members(ok/total) | $cost | Q…``
    Question is truncated to 120 chars so the log stays scannable.
    """
    ts = (now or datetime.now(timezone.utc)).strftime("%Y-%m-%dT%H:%M:%SZ")
    ok = sum(1 for a in answers if a.ok)
    total = len(answers)
    q = question_text.strip().replace("\n", " ")
    if len(q) > 120:
        q = q[:117] + "..."
    names = ", ".join(a.member for a in answers)
    members_tag = f" members({names})" if names else ""
    return (
        f"{ts} | {status} | members={ok}/{total} |{members_tag} "
        f"cost=${total_cost:.4f} | Q={q}"
    )


def resolve_low_impact(
    question_text: str,
    plan: FastPathPlan,
    clients: dict[str, ExternalAIClient],
    price_table: "object | None" = None,
    now: "Callable[[], datetime] | None" = None,
) -> FastPathResolution:
    """Execute the fast-path plan and return a :class:`FastPathResolution`.

    Contract:

    - One round only — each opted-in member is called exactly once.
    - Per-call ``max_tokens`` is taken from ``plan.budget.max_output_tokens``.
    - The USD cap (``plan.budget.max_total_usd``) is a hard stop — when
      the running total would exceed it after a call, the executor
      aborts and escalates to the user (never silently truncates).
    - Provider failures never block — a failed member is recorded and
      the executor continues with the remaining member (if any).
    - Consensus rule (2 members): normalised answer-line equality. No
      embedding match, no LLM-judge — keeps the agreement test
      auditable. Disagreement → ``status = "split"``, caller escalates.

    Args:
        question_text: The low-impact question being routed.
        plan: Output of :func:`plan_fast_path`.
        clients: Provider name → instantiated client. Missing entries
            are treated as a member-side failure (error recorded,
            other members proceed).
        price_table: Optional pricing table for cost estimation. When
            ``None``, ``cost_usd`` fields stay at ``0.0`` (the structural
            budget check still fires on token counts).
        now: Optional clock injector for deterministic tests.

    Returns:
        :class:`FastPathResolution` with status, answer, marker, and
        session log line. Caller renders the marker, surfaces the
        answer (if any), and appends ``session_log_line`` to the
        session artefact.
    """
    if not plan.is_resolvable:
        return FastPathResolution(
            status="unavailable",
            answer="",
            marker=_aborted_marker("no opted-in member", ()),
        )

    user_prompt = _build_user_prompt(question_text)
    answers: list[MemberAnswer] = []
    total_cost = 0.0

    for member in plan.members:
        client = clients.get(member.name)
        if client is None:
            answers.append(MemberAnswer(
                member=member.name, text="", normalized="",
                cost_usd=0.0, error="no client instantiated",
            ))
            continue
        try:
            response = client.ask(
                _FAST_PATH_SYSTEM,
                user_prompt,
                max_tokens=plan.budget.max_output_tokens,
            )
        except Exception as exc:  # noqa: BLE001 — surface as member error
            answers.append(MemberAnswer(
                member=member.name, text="", normalized="",
                cost_usd=0.0, error=f"client raised: {exc!r}",
            ))
            continue
        ans = _build_member_answer(member.name, response, price_table)
        # Hard cap — refuse to add an over-budget answer to the result.
        projected = total_cost + ans.cost_usd
        if projected > plan.budget.max_total_usd and ans.ok:
            answers.append(MemberAnswer(
                member=member.name, text="", normalized="",
                cost_usd=ans.cost_usd,
                error=(
                    f"would exceed fast-path cap "
                    f"${plan.budget.max_total_usd:.2f} "
                    f"(projected ${projected:.4f})"
                ),
            ))
            break
        answers.append(ans)
        total_cost = projected

    answers_t = tuple(answers)
    ok_answers = tuple(a for a in answers_t if a.ok)

    if not ok_answers:
        marker = _aborted_marker("all members failed", plan.members)
        return FastPathResolution(
            status="aborted", answer="", marker=marker,
            answers=answers_t, total_cost_usd=total_cost,
            session_log_line=_session_log_line(
                question_text, "aborted", answers_t, total_cost,
                now=now() if now else None,
            ),
        )

    if len(ok_answers) == 1:
        return FastPathResolution(
            status="resolved",
            answer=ok_answers[0].text,
            marker=plan.marker,
            answers=answers_t,
            total_cost_usd=total_cost,
            session_log_line=_session_log_line(
                question_text, "resolved", answers_t, total_cost,
                now=now() if now else None,
            ),
        )

    # Two members → quick consensus on normalised answer line.
    if ok_answers[0].normalized == ok_answers[1].normalized:
        return FastPathResolution(
            status="resolved",
            answer=ok_answers[0].text,
            marker=plan.marker,
            answers=answers_t,
            total_cost_usd=total_cost,
            session_log_line=_session_log_line(
                question_text, "resolved", answers_t, total_cost,
                now=now() if now else None,
            ),
        )

    return FastPathResolution(
        status="split",
        answer="",
        marker=_split_marker(ok_answers),
        answers=answers_t,
        total_cost_usd=total_cost,
        session_log_line=_session_log_line(
            question_text, "split", answers_t, total_cost,
            now=now() if now else None,
        ),
    )


# --- Phase 11 Step 5: low-impact stats over session log -------------------


@dataclass(frozen=True)
class LowImpactStats:
    """Aggregate summary of one session's low-impact resolutions.

    Attributes:
        total: Total number of fast-path attempts in the session.
        by_status: Count per status (``resolved``/``split``/``aborted``).
        by_member: Count per member name (sum across all attempts;
            a 2-member call increments both entries).
        total_cost_usd: Sum of per-attempt cost across the session.
    """

    total: int
    by_status: dict[str, int]
    by_member: dict[str, int]
    total_cost_usd: float


_LOG_LINE_RE = re.compile(
    r"^(?P<ts>\S+)\s*\|\s*(?P<status>\w+)\s*\|\s*members=(?P<ok>\d+)/"
    r"(?P<tot>\d+)\s*\|.*?cost=\$(?P<cost>[\d.]+)\s*\|\s*Q=",
)


def parse_low_impact_log(text: str) -> LowImpactStats:
    """Parse a ``low-impact-resolutions.md`` body into stats.

    Lines that do not match the canonical ``_session_log_line`` shape
    are skipped silently — keeps the parser tolerant of free-form
    section headers the artefact may grow over time. Returns a
    :class:`LowImpactStats` with the aggregated counts.
    """
    by_status: dict[str, int] = {}
    by_member: dict[str, int] = {}
    total = 0
    total_cost = 0.0
    member_section_re = re.compile(r"members\((?P<names>[^)]+)\)")
    for raw in text.splitlines():
        m = _LOG_LINE_RE.match(raw.strip())
        if not m:
            continue
        total += 1
        status = m.group("status")
        by_status[status] = by_status.get(status, 0) + 1
        try:
            total_cost += float(m.group("cost"))
        except ValueError:
            pass
        # Optional ``members(name, name)`` tag emitted by the renderer.
        names_m = member_section_re.search(raw)
        if names_m:
            for name in names_m.group("names").split(","):
                name = name.strip()
                if name:
                    by_member[name] = by_member.get(name, 0) + 1
    return LowImpactStats(
        total=total,
        by_status=dict(sorted(by_status.items())),
        by_member=dict(sorted(by_member.items())),
        total_cost_usd=round(total_cost, 4),
    )


def render_low_impact_stats(stats: LowImpactStats) -> str:
    """Render :class:`LowImpactStats` as a short stdout summary block."""
    lines = ["# Low-impact fast-path · session summary", ""]
    lines.append(f"- attempts: {stats.total}")
    if stats.by_status:
        parts = " · ".join(
            f"{k}={v}" for k, v in stats.by_status.items()
        )
        lines.append(f"- status: {parts}")
    else:
        lines.append("- status: (none)")
    if stats.by_member:
        parts = " · ".join(
            f"{k}={v}" for k, v in stats.by_member.items()
        )
        lines.append(f"- members: {parts}")
    lines.append(f"- total cost: ${stats.total_cost_usd:.4f}")
    return "\n".join(lines) + "\n"


# --- step-9 P5: fuzzy corpus match with safety vetoes -------------------

def classify_impact_with_corpus_fuzzy(
    question_text: str,
    corpus_paths: "tuple[object, ...] | None" = None,
    *,
    threshold: float = 0.92,
):
    """Fuzzy variant of :func:`necessity.classify_impact_with_corpus`.

    Uses :class:`difflib.SequenceMatcher` to match near-paraphrases of
    ``Validated`` corpus entries while preserving the Iron Law:

    - **Iron Law (precedence)**: the base verdict from
      :func:`classify_impact` runs first. If the base class is in
      ``LOCKED_IMPACT_CLASSES`` (``high_impact`` / ``user_required``),
      the fuzzy lookup is skipped entirely.
    - **High-impact-veto**: any whole-word token from
      :data:`IMPACT_TRIGGERS["high_impact"]` in the (lowered) query
      short-circuits to the base verdict regardless of similarity.
      Catches paraphrases that escaped the trigger-bucket vote.
    - **Anti-example-veto**: if the maximum similarity to any
      ``Anti-Examples`` phrase is ``>=`` the maximum similarity to any
      ``Validated`` phrase, the fuzzy match is rejected. Prevents
      ratio-driven drift onto bullets the corpus has explicitly
      flagged as user-required.

    Returns the base verdict on every reject path so the caller gets
    consistent semantics with the exact-match classifier.
    """
    import difflib
    import re as _re

    from scripts.ai_council.low_impact_corpus import (
        load_anti_example_phrases,
        load_validated_phrases,
    )
    from scripts.ai_council.necessity import (
        IMPACT_TRIGGERS,
        ImpactVerdict,
        LOCKED_IMPACT_CLASSES,
        classify_impact,
    )

    base = classify_impact(question_text)
    if base.impact_class in LOCKED_IMPACT_CLASSES:
        return base
    if not corpus_paths or not (0.0 < threshold <= 1.0):
        return base

    norm_q = _re.sub(r"[^\w\s]", " ", (question_text or "").lower())
    norm_q = _re.sub(r"\s+", " ", norm_q).strip()
    if not norm_q:
        return base

    # High-impact-veto: a paraphrase carrying a security-class trigger
    # wins the Iron Law regardless of corpus similarity. Whole-word
    # match against the lowered query, mirroring `_count_matches`.
    high_triggers = IMPACT_TRIGGERS.get("high_impact", ())
    lowered_q = (question_text or "").lower()
    for trig in high_triggers:
        pattern = r"\b" + _re.escape(trig.lower()) + r"\b"
        if _re.search(pattern, lowered_q):
            return base

    validated: list[str] = []
    anti: list[str] = []
    for path in corpus_paths:
        validated.extend(load_validated_phrases(path))
        anti.extend(load_anti_example_phrases(path))

    if not validated:
        return base

    def _ratio(a: str, b: str) -> float:
        return difflib.SequenceMatcher(a=a, b=b).ratio()

    best_validated = max((_ratio(norm_q, p) for p in validated), default=0.0)
    if best_validated < threshold:
        return base

    best_anti = max((_ratio(norm_q, p) for p in anti), default=0.0)
    # Anti-example-veto: if the query is at least as close to an
    # anti-example as to a validated phrase, the corpus has actively
    # flagged this shape — don't shortcut.
    if anti and best_anti >= best_validated:
        return base

    return ImpactVerdict(
        impact_class="low_impact",
        confidence=round(min(0.9, best_validated), 4),
        rationale=(
            f"Fuzzy match against Validated corpus "
            f"(ratio={best_validated:.3f} ≥ {threshold:.2f}) — routing "
            "as `low_impact` (step-9 P5)."
        ),
        category="corpus_validated_fuzzy",
    )
