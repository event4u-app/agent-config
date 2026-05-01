"""``design`` step — produces the design brief that locks microcopy.

Phase 3 Step 1 of ``agents/roadmaps/road-to-product-ui-track.md``: the
design step turns the audit findings into a structured design brief
that ``apply`` consumes verbatim. The brief is **the lock** — apply
writes the strings exactly as the brief specifies. Hallucinated
microcopy at apply time is the failure mode this step exists to
prevent.

Routes on ``state.ui_design`` shape:

- **Empty / None** — first pass. Emit ``@agent-directive: ui-design-brief``
  delegating to a design skill / sub-prompt; on the rebound the brief
  lands in ``state.ui_design``.
- **Populated, microcopy contains placeholders** — emit a re-write halt
  listing the offending fields. Apply is gated against placeholder
  patterns (see ``apply.py``) — failing fast here keeps the gate close
  to the producer.
- **Populated, well-formed, ``design_confirmed`` is missing or False** —
  halt with a numbered-options summary so the user signs off on the
  brief before apply writes any code.
- **Populated, well-formed, ``design_confirmed`` is True** — return
  ``SUCCESS``; the dispatcher advances to ``plan`` (apply).

Idempotent: a re-entry with ``design_confirmed=True`` round-trips
through ``SUCCESS`` without re-emitting a halt the user already
answered.
"""
from __future__ import annotations

from typing import Any

from ...delivery_state import (
    DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
)

REQUIRED_BRIEF_KEYS: tuple[str, ...] = (
    "layout",
    "components",
    "states",
    "microcopy",
    "a11y",
)
"""Top-level keys every well-formed design brief must carry.

``reused_from_audit`` is recommended but not required — a fully
greenfield brief may legitimately have nothing to reuse.
"""

REQUIRED_STATE_KEYS: tuple[str, ...] = (
    "empty",
    "loading",
    "error",
    "success",
    "disabled",
)
"""States the brief must cover; missing entries surface as halt items."""

PLACEHOLDER_PATTERNS: tuple[str, ...] = (
    "<placeholder>",
    "lorem",
    "todo:",
    "tbd",
    "xxx",
)
"""Lower-cased substrings that mark microcopy as unfinished.

Mirrored by :mod:`work_engine.directives.ui.apply` (Phase 3 Step 2):
apply rejects any component whose output text matches one of these
patterns. Catching them here keeps the lock close to the producer.
"""

AMBIGUITIES: tuple[dict[str, str], ...] = (
    {
        "code": "design_missing",
        "trigger": "state.ui_design is None or empty — brief has not been produced",
        "resolution": "agent directive `ui-design-brief` → skill/agent "
        "writes the brief into state.ui_design",
    },
    {
        "code": "design_placeholders",
        "trigger": "microcopy contains placeholder patterns "
        "(<placeholder>, Lorem, TODO:, TBD, XXX)",
        "resolution": "agent re-runs the brief with final strings; "
        "halt lists the offending microcopy keys",
    },
    {
        "code": "design_unconfirmed",
        "trigger": "brief is well-formed but design_confirmed is unset/False",
        "resolution": "user reviews the brief summary and sets "
        "state.ui_design.design_confirmed = True (or asks for "
        "revisions, which loops back to ui-design-brief)",
    },
)
"""Declared ambiguity surfaces for this step."""


def run(state: DeliveryState) -> StepResult:
    """Apply the design-brief lock to ``state.ui_design``."""
    design = state.ui_design
    if not _is_populated(design):
        return _delegate_to_design_skill(state)

    missing = _missing_required_keys(design)
    if missing:
        return _halt_incomplete_brief(state, missing)

    placeholders = _placeholder_violations(design)
    if placeholders:
        return _halt_placeholders(state, placeholders)

    if design.get("design_confirmed") is True:
        return StepResult(outcome=Outcome.SUCCESS)

    return _halt_unconfirmed(state, design)


def _is_populated(design: Any) -> bool:
    """True when ``design`` carries an actionable brief.

    Non-dict and empty-dict shapes are treated as "skill has not run"
    so the first-pass directive fires. Once the skill writes a brief,
    the dict carries at least one of the required keys; from there
    :func:`_missing_required_keys` decides whether the brief is
    complete enough to advance.
    """
    if not isinstance(design, dict):
        return False
    if not design:
        return False
    return any(key in design for key in REQUIRED_BRIEF_KEYS)


def _missing_required_keys(design: dict[str, Any]) -> list[str]:
    """Return required top-level keys that are missing or empty."""
    missing: list[str] = []
    for key in REQUIRED_BRIEF_KEYS:
        value = design.get(key)
        if value is None or value == "" or value == [] or value == {}:
            missing.append(key)
            continue
        if key == "states" and isinstance(value, dict):
            for state_key in REQUIRED_STATE_KEYS:
                if not value.get(state_key):
                    missing.append(f"states.{state_key}")
    return missing


def _placeholder_violations(design: dict[str, Any]) -> list[str]:
    """Return microcopy paths whose values match a placeholder pattern.

    Walks ``design["microcopy"]`` recursively (dict-of-strings or
    dict-of-dict-of-strings) and reports each leaf whose lower-cased
    value contains one of :data:`PLACEHOLDER_PATTERNS`. Path uses
    dotted-key form (``"buttons.submit"``) so the halt can list the
    exact fields the agent must rewrite.
    """
    microcopy = design.get("microcopy")
    if not isinstance(microcopy, dict):
        return []
    violations: list[str] = []
    _walk_microcopy(microcopy, prefix="", violations=violations)
    return violations


def _walk_microcopy(
    node: dict[str, Any],
    *,
    prefix: str,
    violations: list[str],
) -> None:
    """Recursive helper for :func:`_placeholder_violations`."""
    for key, value in node.items():
        path = f"{prefix}.{key}" if prefix else str(key)
        if isinstance(value, dict):
            _walk_microcopy(value, prefix=path, violations=violations)
            continue
        if not isinstance(value, str):
            continue
        lowered = value.lower()
        for pattern in PLACEHOLDER_PATTERNS:
            if pattern in lowered:
                violations.append(path)
                break


def _preview_input(state: DeliveryState) -> str:
    """Render a one-line preview of the input being designed."""
    data = state.ticket or {}
    raw = data.get("raw")
    if isinstance(raw, str) and raw.strip():
        text = " ".join(raw.split())
    else:
        title = data.get("title")
        text = title if isinstance(title, str) else (data.get("id") or "(no title)")
    if len(text) <= 80:
        return text
    return text[:79].rstrip() + "\u2026"


def _delegate_to_design_skill(state: DeliveryState) -> StepResult:
    """Halt with an agent directive so the orchestrator runs ``ui-design-brief``."""
    preview = _preview_input(state)
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            agent_directive("ui-design-brief"),
            f"> Input: {preview}",
            "> No design brief yet \u2014 producing one now. The brief locks "
            "layout, components, states, microcopy, and a11y before any "
            "code is written.",
            "> 1. Continue \u2014 produce the brief from audit findings",
            "> 2. Abort \u2014 drop this UI request",
        ],
        message=(
            "UI design brief missing; delegating to ui-design-brief skill."
        ),
    )


def _halt_incomplete_brief(
    state: DeliveryState,
    missing: list[str],
) -> StepResult:
    """BLOCKED halt \u2014 brief is missing required keys."""
    preview = _preview_input(state)
    lines = [
        agent_directive("ui-design-brief"),
        f"> Input: {preview}",
        "> Design brief is incomplete. Missing required fields:",
    ]
    for path in missing:
        lines.append(f"> - `{path}`")
    lines.append(
        "> Re-run the brief skill so every required slot has a final "
        "value before apply.",
    )
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=lines,
        message=(
            f"UI design brief incomplete; {len(missing)} required "
            f"field(s) missing."
        ),
    )


def _halt_placeholders(
    state: DeliveryState,
    violations: list[str],
) -> StepResult:
    """BLOCKED halt \u2014 microcopy still carries placeholder patterns."""
    preview = _preview_input(state)
    lines = [
        agent_directive("ui-design-brief"),
        f"> Input: {preview}",
        "> Microcopy contains placeholder patterns. Apply rejects these "
        "verbatim, so they have to be replaced with final strings now:",
    ]
    for path in violations:
        lines.append(f"> - `microcopy.{path}`")
    lines.append(
        "> Re-run the brief skill with finalised copy; the apply step "
        "will write strings exactly as the brief specifies.",
    )
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=lines,
        message=(
            f"UI design brief carries {len(violations)} placeholder "
            f"violation(s); halting for finalised microcopy."
        ),
    )


def _halt_unconfirmed(
    state: DeliveryState,
    design: dict[str, Any],
) -> StepResult:
    """BLOCKED halt \u2014 brief is well-formed; user must sign off."""
    preview = _preview_input(state)
    components = design.get("components") or []
    states = design.get("states") or {}
    microcopy = design.get("microcopy") or {}

    component_count = len(components) if isinstance(components, list) else 0
    state_count = len(states) if isinstance(states, dict) else 0
    microcopy_count = _count_microcopy(microcopy) if isinstance(microcopy, dict) else 0

    lines = [
        f"> Input: {preview}",
        "> Design brief is ready. Summary:",
        f"> - Components: {component_count}",
        f"> - States covered: {state_count}",
        f"> - Microcopy entries (locked): {microcopy_count}",
        "> 1. Confirm \u2014 lock this brief and advance to apply",
        "> 2. Revise \u2014 send feedback; loops back to ui-design-brief",
        "> 3. Abort \u2014 drop this UI request",
        "",
        "**Recommendation: 1 \u2014 Confirm** \u2014 the brief covers all "
        "required slots and microcopy is final. Caveat: flip to 2 only if "
        "a string, state, or component is wrong; do not confirm strings "
        "you have not read.",
    ]
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=lines,
        message=(
            "UI design brief ready; halting for user confirmation "
            "before apply."
        ),
    )


def _count_microcopy(microcopy: dict[str, Any]) -> int:
    """Count leaf string entries in ``microcopy`` (recursive)."""
    total = 0
    for value in microcopy.values():
        if isinstance(value, dict):
            total += _count_microcopy(value)
        elif isinstance(value, str):
            total += 1
    return total


__all__ = [
    "AMBIGUITIES",
    "PLACEHOLDER_PATTERNS",
    "REQUIRED_BRIEF_KEYS",
    "REQUIRED_STATE_KEYS",
    "run",
]
