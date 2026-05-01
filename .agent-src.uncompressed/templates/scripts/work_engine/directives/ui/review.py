"""``review`` step — stack-dispatched design-review pass.

Phase 3 Step 4 of ``agents/roadmaps/road-to-product-ui-track.md``: the
review step compares the rendered components from ``apply`` against
the locked design brief and produces a structured findings list. It
does **not** apply fixes — that is the polish step's job. Review's
single output is ``state.ui_review`` carrying ``findings`` (a list of
zero or more issue records) and ``review_clean`` (a bool that mirrors
``len(findings) == 0`` once the agent finalises the pass).

Routes on ``state.ui_review`` shape:

- **Empty / None / non-dict** — first pass. Emit
  ``@agent-directive: ui-design-review-<stack>`` delegating to the
  stack-specific review skill; on the rebound the envelope lands in
  ``state.ui_review``.
- **Populated, missing ``findings``** — partial envelope, the skill
  has to finish the pass. Halt with the same directive so the agent
  re-runs the review.
- **Populated, ``findings`` present, ``review_clean`` missing or not
  a bool** — halt asking the agent to set the flag explicitly. Polish
  reads it and would short-circuit the loop on a wrong value.
- **Populated, well-formed** — return ``SUCCESS``; the dispatcher
  advances to ``verify`` (polish), which decides whether to loop.

Review does **not** enforce ``review_clean == (len(findings) == 0)``.
That looks tempting but it blocks the legitimate "ship as-is with
open findings" replay path: polish's ceiling halt asks the user to
set ``review_clean = True`` while findings are still present, the
dispatcher advances to report, and a later replay of the state file
would re-enter review with that envelope. Honesty of the flag is the
producer's contract (the review skill on first pass; the polish skill
on ship-as-is); review only checks the shape.

Idempotent: a re-entry with the same well-formed envelope round-trips
through ``SUCCESS`` without re-emitting a halt.
"""
from __future__ import annotations

from typing import Any

from ...delivery_state import (
    DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
)

STACK_DIRECTIVES: dict[str, str] = {
    "blade-livewire-flux": "ui-design-review-blade-livewire-flux",
    "react-shadcn": "ui-design-review-react-shadcn",
    "vue": "ui-design-review-vue",
    "plain": "ui-design-review-plain",
}
"""Map ``state.stack.frontend`` → agent-directive skill name.

Mirrors :data:`work_engine.directives.ui.apply.STACK_DIRECTIVES` so
review fires the matching review skill for the stack apply targeted.
An unknown stack falls through to ``ui-design-review-plain``.
"""

DEFAULT_DIRECTIVE = "ui-design-review-plain"
"""Fallback directive when ``state.stack`` is missing or malformed."""

SEVERITY_ORDER: dict[str, int] = {
    "minor": 0,
    "moderate": 1,
    "serious": 2,
    "critical": 3,
}
"""R4 a11y severity ranking — mirrors axe-core's impact levels."""

DEFAULT_SEVERITY_FLOOR = "moderate"
"""R4 a11y default severity floor — violations strictly below this are
informational; violations at or above are actionable."""

AMBIGUITIES: tuple[dict[str, str], ...] = (
    {
        "code": "review_envelope_missing",
        "trigger": "state.ui_review unset / empty — review skill has not run yet",
        "resolution": "agent directive `ui-design-review-<stack>` → "
        "skill compares rendered components against state.ui_design "
        "and writes `findings` + `review_clean` back",
    },
    {
        "code": "review_findings_missing",
        "trigger": "state.ui_review populated but `findings` key absent",
        "resolution": "agent re-runs the review skill with the same "
        "directive; review only succeeds once findings is a list",
    },
    {
        "code": "review_clean_missing",
        "trigger": "state.ui_review.findings is set but review_clean "
        "is missing or not a bool — polish needs an explicit flag",
        "resolution": "agent sets state.ui_review.review_clean to "
        "True or False before returning the envelope; review does "
        "not infer it from findings count",
    },
    {
        "code": "review_a11y_pending",
        "trigger": "state.ui_audit declared an `a11y_baseline` but "
        "state.ui_review.a11y is missing — the review skill ran but "
        "did not produce an a11y envelope",
        "resolution": "agent re-runs the review skill so it captures "
        "axe-core (or equivalent) findings into "
        "`state.ui_review.a11y.violations`; the gate then filters "
        "against the baseline and the severity floor",
    },
)
"""Declared ambiguity surfaces for this step."""


def run(state: DeliveryState) -> StepResult:
    """Apply the design-review gate to ``state.ui_review``."""
    review = state.ui_review
    if not _is_populated(review):
        return _delegate_to_review_skill(state)

    if "findings" not in review or not isinstance(review["findings"], list):
        return _halt_findings_missing(state)

    findings = review["findings"]
    if not isinstance(review.get("review_clean"), bool):
        return _halt_clean_missing(state, findings_count=len(findings))

    a11y_halt = _apply_a11y_gate(state, review)
    if a11y_halt is not None:
        return a11y_halt

    return StepResult(outcome=Outcome.SUCCESS)


def _is_populated(review: Any) -> bool:
    """True when ``review`` is a dict with at least one own key.

    Non-dict and empty-dict shapes are treated as "skill has not run"
    so the first-pass directive fires.
    """
    return isinstance(review, dict) and bool(review)


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


def _delegate_to_review_skill(state: DeliveryState) -> StepResult:
    """First-pass halt — emit the stack-specific review directive."""
    directive = _resolve_directive(state)
    stack_label = _stack_label(state)
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            agent_directive(directive),
            f"> Stack: `{stack_label}`. Reviewing rendered components "
            "against the locked design brief.",
            "> The review pass compares `state.ticket.ui_apply.rendered` "
            "against `state.ui_design` (microcopy, states, a11y, layout) "
            "and produces a structured `findings` list.",
            "> 1. Continue \u2014 run the review and write "
            "`{findings: [...], review_clean: bool}` into "
            "`state.ui_review`",
            "> 2. Abort \u2014 drop this UI request",
        ],
        message=(
            f"UI review pending; delegating to `{directive}` for "
            f"stack `{stack_label}`."
        ),
    )


def _halt_findings_missing(state: DeliveryState) -> StepResult:
    """BLOCKED halt — envelope present but ``findings`` slot is unset."""
    directive = _resolve_directive(state)
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            agent_directive(directive),
            "> Review envelope is partial: `findings` list is missing.",
            "> Re-run the review skill so `state.ui_review.findings` "
            "is a list (empty when nothing is wrong).",
        ],
        message="UI review envelope incomplete; `findings` missing.",
    )


def _halt_clean_missing(
    state: DeliveryState,
    *,
    findings_count: int,
) -> StepResult:
    """BLOCKED halt — ``review_clean`` is missing or not a bool."""
    directive = _resolve_directive(state)
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            agent_directive(directive),
            "> Review envelope is incomplete: `review_clean` is missing "
            "or not a boolean.",
            f"> Findings count: {findings_count}. Set "
            "`state.ui_review.review_clean` to `True` (no further "
            "polish needed) or `False` (polish loop should run).",
        ],
        message=(
            "UI review envelope incomplete; `review_clean` must be a bool."
        ),
    )


def _apply_a11y_gate(
    state: DeliveryState,
    review: dict[str, Any],
) -> StepResult | None:
    """R4 Phase 1: enforce a11y gate after the basic shape gates pass.

    The gate is **opt-in via the audit baseline**: if
    ``state.ui_audit.a11y_baseline`` is present (a list, possibly empty)
    the audit declared this UI surface to be a11y-tracked. The review
    skill must then populate ``state.ui_review.a11y.violations``;
    missing → ``review_a11y_pending`` halt. Pre-R4 envelopes (no
    baseline) bypass the gate so existing fixtures keep working.

    When the envelope is present the gate filters violations against
    the baseline (pre-existing issues are ignored), against the
    accepted list (user-acknowledged issues from a previous polish
    halt), and against the severity floor (default ``moderate``). Any
    *actionable* leftover violations are synthesised as
    ``a11y_violation`` findings on ``review.findings`` and
    ``review_clean`` is forced to ``False`` so polish picks them up.

    Returns ``None`` to advance the dispatcher, or a ``BLOCKED``
    ``StepResult`` for the pending halt.

    Side effects on ``review`` are deduplicated by ``(kind, rule)`` so
    a re-entry round-trips without growing the findings list.
    """
    audit = getattr(state, "ui_audit", None)
    has_baseline = isinstance(audit, dict) and "a11y_baseline" in audit
    a11y = review.get("a11y")

    if a11y is None:
        if has_baseline:
            return _halt_a11y_pending(state)
        return None

    violations = a11y.get("violations") or []
    baseline = audit["a11y_baseline"] if has_baseline else []
    accepted = a11y.get("accepted_violations") or []
    floor = a11y.get("severity_floor") or DEFAULT_SEVERITY_FLOOR

    new_violations = _filter_known(violations, baseline)
    new_violations = _filter_known(new_violations, accepted)
    actionable = [v for v in new_violations if _at_or_above_floor(v, floor)]

    if not actionable:
        return None

    _synthesize_a11y_findings(review["findings"], actionable)
    review["review_clean"] = False
    return None


def _filter_known(
    violations: list[Any],
    known: list[Any],
) -> list[Any]:
    """Drop violations whose ``(rule, selector)`` matches ``known``.

    Used for both the baseline filter (pre-existing violations stay
    ignored) and the accepted filter (user-acknowledged violations
    after a ``polish_a11y_blocking`` halt). Non-dict entries in either
    list are skipped — schema only enforces list shape.
    """
    if not known:
        return list(violations)
    keys: set[tuple[Any, Any]] = set()
    for entry in known:
        if isinstance(entry, dict):
            keys.add((entry.get("rule"), entry.get("selector")))
    if not keys:
        return list(violations)
    return [
        v for v in violations
        if not (
            isinstance(v, dict)
            and (v.get("rule"), v.get("selector")) in keys
        )
    ]


def _at_or_above_floor(violation: Any, floor: str) -> bool:
    """``True`` when ``violation.severity`` is at or above ``floor``.

    Unknown severities default to ``moderate`` rather than dropping
    the violation — a malformed envelope must not silently weaken the
    gate. The floor itself is schema-validated, so a bogus floor never
    reaches this helper.
    """
    if not isinstance(violation, dict):
        return False
    severity = violation.get("severity")
    sev_rank = SEVERITY_ORDER.get(
        severity if isinstance(severity, str) else "",
        SEVERITY_ORDER[DEFAULT_SEVERITY_FLOOR],
    )
    floor_rank = SEVERITY_ORDER.get(floor, SEVERITY_ORDER[DEFAULT_SEVERITY_FLOOR])
    return sev_rank >= floor_rank


def _synthesize_a11y_findings(
    findings: list[Any],
    actionable: list[Any],
) -> None:
    """Append ``a11y_violation`` findings, deduped by ``(rule, selector)``.

    Polish reads these as ordinary findings; the ``kind`` discriminator
    lets Phase 2's ``polish_a11y_blocking`` gate isolate the a11y
    subset at the polish ceiling.
    """
    existing: set[tuple[Any, Any]] = {
        (f.get("rule"), f.get("selector"))
        for f in findings
        if isinstance(f, dict) and f.get("kind") == "a11y_violation"
    }
    for v in actionable:
        if not isinstance(v, dict):
            continue
        key = (v.get("rule"), v.get("selector"))
        if key in existing:
            continue
        findings.append({
            "kind": "a11y_violation",
            "rule": v.get("rule"),
            "selector": v.get("selector"),
            "severity": v.get("severity"),
        })
        existing.add(key)


def _halt_a11y_pending(state: DeliveryState) -> StepResult:
    """BLOCKED halt — audit declared a baseline but review has no a11y."""
    directive = _resolve_directive(state)
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            agent_directive(directive),
            "> Review envelope is incomplete: the audit declared an "
            "`a11y_baseline` but `state.ui_review.a11y` is missing.",
            "> Re-run the review skill so it captures axe-core (or "
            "equivalent) findings into "
            "`state.ui_review.a11y.violations`. The gate filters "
            "against the baseline and the severity floor "
            f"(default `{DEFAULT_SEVERITY_FLOOR}`).",
        ],
        message=(
            "UI review envelope incomplete; `a11y` envelope missing "
            "(audit declared a baseline)."
        ),
    )


__all__ = [
    "AMBIGUITIES",
    "DEFAULT_DIRECTIVE",
    "DEFAULT_SEVERITY_FLOOR",
    "SEVERITY_ORDER",
    "STACK_DIRECTIVES",
    "run",
]
