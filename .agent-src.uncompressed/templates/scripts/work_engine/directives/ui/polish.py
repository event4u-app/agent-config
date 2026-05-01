"""``polish`` step — bounded fix loop for review findings.

Phase 3 Step 5 of ``agents/roadmaps/road-to-product-ui-track.md``: the
polish step drives the fix loop after ``review`` produces findings.
It is the **only** step that re-enters review during a single
``/work`` run, and the loop is hard-capped at two rounds — anything
the agent cannot fix in two passes goes back to the user as a
ship-as-is / abort decision rather than burning rounds silently.

Routes on ``state.ui_review`` and ``state.ui_polish``:

- **review_clean is True (or findings empty)** — nothing to polish;
  return ``SUCCESS`` so the dispatcher advances to ``report``.
- **review_clean is False, rounds < 2** — emit
  ``@agent-directive: ui-polish-<stack>``. The agent applies the
  fixes from ``state.ui_review.findings``, re-runs the review skill,
  and increments ``state.ui_polish.rounds``. On rebound, the
  dispatcher walks back here; if the new review is clean we succeed,
  otherwise the next round fires.
- **review_clean is False, rounds == 2** — ceiling reached. Halt
  with three numbered options (ship as-is / abort / hand off) so the
  user breaks the deadlock instead of the engine looping forever.

Idempotent: when the review is clean the step round-trips through
``SUCCESS`` regardless of how many rounds ran. Schema-level validation
in :mod:`work_engine.state` already rejects ``rounds > 2`` on disk,
so the ceiling check here is the runtime mirror of that contract.
"""
from __future__ import annotations

from typing import Any

from ...delivery_state import (
    DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
)

POLISH_CEILING = 2
"""Maximum number of polish rounds per ``/work`` run.

Mirrored by :func:`work_engine.state._validate_ui_polish` (rejects
``rounds > 2`` at schema load when ``extension_used`` is ``False``)
so the contract holds across in-memory state, on-disk state, and the
dispatcher. R4 Phase 2 adds a one-shot extension that lifts the
runtime cap to ``POLISH_CEILING + 1`` when
``state.ui_polish.extension_used`` is ``True``.
"""

A11Y_VIOLATION_KIND = "a11y_violation"
"""Marker on a review finding that flags an axe-core (or equivalent)
accessibility issue. Synthesised by
:func:`work_engine.directives.ui.review._synthesize_a11y_findings`
when actionable violations remain after baseline / accepted /
severity-floor filtering. Polish treats them as ordinary findings
during rounds 1..N but isolates them at the ceiling so the user
gets the dedicated ``polish_a11y_blocking`` halt instead of the
subjective ``polish_ceiling_reached`` halt.
"""

TOKEN_VIOLATION_KIND = "token_violation"
"""Marker on a review finding that flags a hardcoded design value.

Findings with ``kind == TOKEN_VIOLATION_KIND`` carry ``category``
(``"colors"`` / ``"spacing"`` / ``"typography"`` / …) and ``value``
(the literal hardcoded string). Polish classifies them into matched
(value already present in ``state.ui_audit.design_tokens``) and
unmatched, then reacts per :data:`TOKEN_REPEAT_THRESHOLD`.
"""

TOKEN_REPEAT_THRESHOLD = 2
"""Number of repeats above which an unmatched value triggers the
extraction halt — mirrors the roadmap's ">2 times" wording in
``agents/roadmaps/road-to-product-ui-track.md`` Phase 3 Step 5.
"""

STACK_DIRECTIVES: dict[str, str] = {
    "blade-livewire-flux": "ui-polish-blade-livewire-flux",
    "react-shadcn": "ui-polish-react-shadcn",
    "vue": "ui-polish-vue",
    "plain": "ui-polish-plain",
}
"""Map ``state.stack.frontend`` → agent-directive skill name.

Mirrors :data:`work_engine.directives.ui.review.STACK_DIRECTIVES`.
An unknown stack falls through to ``ui-polish-plain``.
"""

DEFAULT_DIRECTIVE = "ui-polish-plain"
"""Fallback directive when ``state.stack`` is missing or malformed."""

AMBIGUITIES: tuple[dict[str, str], ...] = (
    {
        "code": "polish_round_pending",
        "trigger": "state.ui_review.review_clean is False and "
        "state.ui_polish.rounds < 2 — fixes have not yet been applied "
        "for the current findings",
        "resolution": "agent directive `ui-polish-<stack>` → skill "
        "applies fixes, re-runs the review, increments "
        "state.ui_polish.rounds",
    },
    {
        "code": "polish_ceiling_reached",
        "trigger": "state.ui_polish.rounds == ceiling and remaining "
        "findings are non-a11y (subjective polish that did not "
        "converge) — a11y blocks take precedence via "
        "polish_a11y_blocking",
        "resolution": "user picks: ship as-is, abort, or hand off to "
        "manual fix; engine refuses to start another round",
    },
    {
        "code": "polish_a11y_blocking",
        "trigger": "state.ui_polish.rounds == ceiling and "
        "state.ui_review.findings still contains a11y_violation "
        "entries — objective gate that takes precedence over the "
        "subjective polish_ceiling_reached halt",
        "resolution": "user picks: extend by one round (engine sets "
        "state.ui_polish.extension_used=True so the next round can "
        "fire), accept-with-known-violations (engine appends the "
        "leftover violations to state.ui_review.a11y.accepted_violations "
        "so the review gate stops blocking on them), or abort the "
        "UI request",
    },
    {
        "code": "polish_token_extraction_pending",
        "trigger": "state.ui_review.findings has token_violation entries "
        "whose value repeats >2 times and has no match in "
        "state.ui_audit.design_tokens",
        "resolution": "user picks: extract as a new token (agent adds "
        "it to state.ui_audit.design_tokens.<category>), inline (agent "
        "drops the token_violation findings before re-entering polish), "
        "or abort the UI request",
    },
)
"""Declared ambiguity surfaces for this step."""


def run(state: DeliveryState) -> StepResult:
    """Apply the polish-loop gate."""
    review = state.ui_review or {}
    findings = review.get("findings", [])
    if not isinstance(findings, list):
        findings = []
    review_clean = bool(review.get("review_clean", False))

    if review_clean or not findings:
        return StepResult(outcome=Outcome.SUCCESS)

    polish = state.ui_polish or {}
    rounds = polish.get("rounds", 0)
    if not isinstance(rounds, int) or isinstance(rounds, bool):
        rounds = 0
    extension_used = bool(polish.get("extension_used", False))
    effective_ceiling = POLISH_CEILING + (1 if extension_used else 0)

    if rounds >= effective_ceiling:
        a11y_findings = _a11y_findings(findings)
        if a11y_findings:
            return _halt_a11y_blocking(
                state,
                a11y_findings=a11y_findings,
                rounds=rounds,
                extension_available=not extension_used,
            )
        return _halt_ceiling(
            state,
            findings_count=len(findings),
            rounds=rounds,
            ceiling=effective_ceiling,
        )

    tokens = _design_tokens(state)
    matched, unmatched_repeats = _classify_token_violations(findings, tokens)
    if unmatched_repeats:
        return _halt_token_extraction(state, repeats=unmatched_repeats)

    return _delegate_to_polish_skill(
        state,
        findings_count=len(findings),
        matched_token_count=len(matched),
        rounds=rounds,
        ceiling=effective_ceiling,
    )


def _resolve_directive(state: DeliveryState) -> str:
    """Pick the agent directive for the project's frontend stack."""
    stack = getattr(state, "stack", None) or {}
    if isinstance(stack, dict):
        frontend = stack.get("frontend")
        if isinstance(frontend, str) and frontend in STACK_DIRECTIVES:
            return STACK_DIRECTIVES[frontend]
    return DEFAULT_DIRECTIVE


def _stack_label(state: DeliveryState) -> str:
    """Return the frontend stack label, defaulting to ``plain``."""
    stack = getattr(state, "stack", None) or {}
    if isinstance(stack, dict):
        frontend = stack.get("frontend")
        if isinstance(frontend, str) and frontend:
            return frontend
    return "plain"


def _delegate_to_polish_skill(
    state: DeliveryState,
    *,
    findings_count: int,
    matched_token_count: int,
    rounds: int,
    ceiling: int,
) -> StepResult:
    """BLOCKED halt — emit the stack-specific polish directive.

    The skill applies fixes from ``state.ui_review.findings``,
    re-runs the review, and writes:

    - new ``state.ui_review`` (refreshed findings + ``review_clean``)
    - ``state.ui_polish.rounds = rounds + 1``
    - ``state.ui_polish.applied`` extended with this round's fix log

    ``matched_token_count`` reports how many findings are
    ``token_violation`` entries whose value already lives in
    ``state.ui_audit.design_tokens`` — those auto-convert in this
    round without further user input. ``ceiling`` is the
    extension-aware upper bound (``POLISH_CEILING`` or
    ``POLISH_CEILING + 1`` after an a11y extension).
    """
    directive = _resolve_directive(state)
    stack_label = _stack_label(state)
    next_round = rounds + 1
    findings_line = (
        f"> {findings_count} finding(s) from `state.ui_review`. "
        "Apply each fix, re-run the review, and write the refreshed "
        "envelope back."
    )
    if matched_token_count:
        findings_line = (
            f"> {findings_count} finding(s) from `state.ui_review` "
            f"({matched_token_count} token-violation match(es) "
            "auto-convert against `state.ui_audit.design_tokens`). "
            "Apply each fix, re-run the review, and write the refreshed "
            "envelope back."
        )
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            agent_directive(directive),
            f"> Stack: `{stack_label}`. Polish round "
            f"{next_round} of {ceiling}.",
            findings_line,
            "> 1. Continue \u2014 apply fixes, re-review, and increment "
            "`state.ui_polish.rounds`",
            "> 2. Abort \u2014 drop this UI request",
        ],
        message=(
            f"UI polish round {next_round}/{ceiling}; delegating "
            f"to `{directive}` for stack `{stack_label}`."
        ),
    )


def _halt_ceiling(
    state: DeliveryState,
    *,
    findings_count: int,
    rounds: int,
    ceiling: int,
) -> StepResult:
    """BLOCKED halt — ceiling reached on subjective (non-a11y) findings.

    R4 Phase 2 narrows this halt: a11y findings are routed to
    :func:`_halt_a11y_blocking` first, so this halt only fires when
    every remaining finding is subjective polish that did not
    converge.
    """
    stack_label = _stack_label(state)
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            f"> Stack: `{stack_label}`. Polish ceiling reached "
            f"({rounds}/{ceiling} rounds).",
            f"> {findings_count} finding(s) still open in "
            "`state.ui_review`. The engine refuses a third round.",
            "> 1. Ship as-is \u2014 mark `state.ui_review.review_clean "
            "= True` and continue to `report` (the open findings stay "
            "in the delivery report)",
            "> 2. Abort \u2014 drop this UI request",
            "> 3. Hand off \u2014 a human picks up the remaining "
            "findings outside the engine; re-invoke `/work` only after "
            "they are resolved",
            "",
            "**Recommendation: 3 \u2014 Hand off** \u2014 two automated "
            "rounds failed to converge. Caveat: pick 1 only when the "
            "remaining findings are explicitly acceptable (low-priority "
            "polish, deferred to a follow-up).",
        ],
        message=(
            f"UI polish ceiling reached ({rounds}/{ceiling}); "
            f"{findings_count} finding(s) still open."
        ),
    )


def _a11y_findings(findings: list[Any]) -> list[dict[str, Any]]:
    """Return the subset of ``findings`` synthesised by the a11y gate."""
    return [
        f for f in findings
        if isinstance(f, dict) and f.get("kind") == A11Y_VIOLATION_KIND
    ]


def _halt_a11y_blocking(
    state: DeliveryState,
    *,
    a11y_findings: list[dict[str, Any]],
    rounds: int,
    extension_available: bool,
) -> StepResult:
    """BLOCKED halt — ceiling reached with actionable a11y findings.

    Takes precedence over :func:`_halt_ceiling`: the user gets three
    options tailored to a11y (extend / accept / abort) instead of
    the subjective ship-or-handoff trio. ``extension_available`` is
    ``False`` once the one-shot extension was already used; in that
    case option 1 disappears and only accept / abort remain.
    """
    stack_label = _stack_label(state)
    count = len(a11y_findings)
    questions: list[str] = [
        f"> Stack: `{stack_label}`. Polish ceiling reached "
        f"({rounds}/{POLISH_CEILING} rounds) with {count} a11y "
        "violation(s) still open.",
    ]
    for finding in a11y_findings[:5]:
        rule = finding.get("rule") or "?"
        selector = finding.get("selector") or "?"
        severity = finding.get("severity") or "?"
        questions.append(
            f"> - `{rule}` on `{selector}` (severity: {severity})"
        )
    if count > 5:
        questions.append(f"> ... and {count - 5} more")
    if extension_available:
        questions.extend([
            "> 1. Extend \u2014 grant one extra polish round; the "
            "engine sets `state.ui_polish.extension_used = True` so "
            "the next delegation can fire",
            "> 2. Accept \u2014 append the open violations to "
            "`state.ui_review.a11y.accepted_violations` so the review "
            "gate stops blocking on them, then continue to `report`",
            "> 3. Abort \u2014 drop this UI request",
            "",
            "**Recommendation: 1 \u2014 Extend** \u2014 a11y "
            "violations are objective; one more round usually closes "
            "the gap. Pick 2 only when the violations are explicitly "
            "out of scope for this run.",
        ])
    else:
        questions.extend([
            "> 1. Accept \u2014 append the open violations to "
            "`state.ui_review.a11y.accepted_violations` so the review "
            "gate stops blocking on them, then continue to `report`",
            "> 2. Abort \u2014 drop this UI request",
            "",
            "**Recommendation: 1 \u2014 Accept** \u2014 the one-shot "
            "extension is already spent; either accept the residual "
            "violations or abort.",
        ])
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=questions,
        message=(
            f"UI polish ceiling reached ({rounds}/{POLISH_CEILING}); "
            f"{count} a11y violation(s) still open."
        ),
    )


def _design_tokens(state: DeliveryState) -> dict[str, Any]:
    """Return ``state.ui_audit.design_tokens`` as a dict, or ``{}``.

    Defensive: tolerates missing audit, non-dict audit, missing
    ``design_tokens`` key, and non-dict ``design_tokens`` payload.
    All four shapes degrade to "no tokens known" so the unmatched
    classifier treats every value as an extraction candidate.
    """
    audit = getattr(state, "ui_audit", None) or {}
    if not isinstance(audit, dict):
        return {}
    tokens = audit.get("design_tokens") or {}
    if not isinstance(tokens, dict):
        return {}
    return tokens


def _classify_token_violations(
    findings: list[Any],
    tokens: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Split ``token_violation`` findings into matched / unmatched-repeats.

    A finding qualifies when ``kind == TOKEN_VIOLATION_KIND`` and it
    carries string ``category`` + ``value``. Matched: ``value`` is
    among the values of ``tokens[category]`` (the token bucket is a
    name → literal mapping per ``state.ui_audit.design_tokens``
    schema). Unmatched values are bucketed by ``(category, value)``;
    only buckets with ``count > TOKEN_REPEAT_THRESHOLD`` are returned
    so single-use hardcoded values do not trigger the halt.
    """
    matched: list[dict[str, Any]] = []
    unmatched_counts: dict[tuple[str, str], int] = {}
    for finding in findings:
        if not isinstance(finding, dict):
            continue
        if finding.get("kind") != TOKEN_VIOLATION_KIND:
            continue
        category = finding.get("category")
        value = finding.get("value")
        if not isinstance(category, str) or not isinstance(value, str):
            continue
        bucket = tokens.get(category)
        if isinstance(bucket, dict) and value in bucket.values():
            matched.append(finding)
            continue
        key = (category, value)
        unmatched_counts[key] = unmatched_counts.get(key, 0) + 1
    repeats = [
        {"category": cat, "value": val, "count": count}
        for (cat, val), count in unmatched_counts.items()
        if count > TOKEN_REPEAT_THRESHOLD
    ]
    return matched, repeats


def _suggest_token_name(category: str, value: str) -> str:
    """Build a suggested CSS-custom-property name for an extraction halt.

    Heuristic only — the agent picks the final name when applying
    the extraction. Strips non-alphanumerics from ``value``, prefixes
    with the singular of ``category`` (``colors`` → ``color``), and
    caps the length so the halt body stays readable.
    """
    safe = "".join(c if c.isalnum() else "-" for c in value).strip("-").lower()
    if not safe:
        safe = "value"
    base = category.rstrip("s") or category
    return f"{base}-{safe}"[:40]


def _halt_token_extraction(
    state: DeliveryState,
    *,
    repeats: list[dict[str, Any]],
) -> StepResult:
    """BLOCKED halt — repeated hardcoded value(s) without a matching token.

    Polish refuses to silently inline the same hardcoded value across
    multiple call sites; the user picks whether the value graduates
    to a design token or stays inline for this run.
    """
    stack_label = _stack_label(state)
    questions: list[str] = [
        f"> Stack: `{stack_label}`. {len(repeats)} hardcoded value(s) "
        f"appear >{TOKEN_REPEAT_THRESHOLD} times without a matching "
        "entry in `state.ui_audit.design_tokens`.",
    ]
    for repeat in repeats:
        suggested = _suggest_token_name(repeat["category"], repeat["value"])
        questions.append(
            f"> - `{repeat['value']}` "
            f"({repeat['category']}, {repeat['count']}\u00d7) "
            f"\u2014 suggested name: `--{suggested}`"
        )
    questions.extend([
        "> 1. Extract as design token(s) \u2014 add to "
        "`state.ui_audit.design_tokens.<category>` and re-enter polish; "
        "matching findings auto-convert next round",
        "> 2. Inline \u2014 keep the hardcoded value(s) for this run; "
        "drop the token_violation findings from "
        "`state.ui_review.findings` before re-entering polish",
        "> 3. Abort \u2014 drop this UI request",
        "",
        "**Recommendation: 1 \u2014 Extract** \u2014 a value used "
        f">{TOKEN_REPEAT_THRESHOLD} times is a de-facto token; "
        "promoting it now keeps the design system honest. Pick 2 only "
        "when the value is intentionally one-off.",
    ])
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=questions,
        message=(
            f"UI polish paused; {len(repeats)} hardcoded value(s) "
            "repeat without a matching design token."
        ),
    )


__all__ = [
    "A11Y_VIOLATION_KIND",
    "AMBIGUITIES",
    "DEFAULT_DIRECTIVE",
    "POLISH_CEILING",
    "STACK_DIRECTIVES",
    "TOKEN_REPEAT_THRESHOLD",
    "TOKEN_VIOLATION_KIND",
    "run",
]
