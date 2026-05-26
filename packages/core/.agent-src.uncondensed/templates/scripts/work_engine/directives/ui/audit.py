"""``audit`` step — mandatory pre-step for the UI directive set.

Routes on ``state.ui_audit`` shape:

- **Empty / None** — first pass. Emit an ``@agent-directive:`` halt
  delegating to the ``existing-ui-audit`` skill; on the rebound the
  skill writes findings back into ``state.ui_audit``.
- **Greenfield without decision** — ``greenfield == True`` and
  ``greenfield_decision`` unset. Emit a numbered-options halt; the
  user picks ``scaffold`` / ``bare`` / ``external_reference``.
- **Populated, ambiguous, no pick** — confidence is medium, OR the
  inventory has multiple matches with similar similarity scores.
  Emit a numbered-options halt; the user picks the candidate to
  extend (or "build new"). Records ``audit_path = "ambiguous"`` plus
  the selected candidate. The downstream design step shows the brief
  as a final summary, not a separate halt.
- **Populated, high-confidence** — confidence is ``high`` and the
  inventory has exactly one strong reusable match (similarity
  ≥ ``STRONG_SIMILARITY``). Records ``audit_path = "high_confidence"``
  and returns ``SUCCESS``; the design step folds the audit findings
  into the design-brief halt as default assumptions.
- **Populated and decided** — any of the above with the path / pick
  already recorded round-trips through ``SUCCESS``. The audit step
  is idempotent so dispatcher replay never re-emits a halt the user
  already answered.

The deterministic checks live here (rather than inside the skill) for
the same reason as :mod:`work_engine.directives.backend.refine`: the
dispatcher is synchronous Python and cannot delegate mid-loop. Making
the gate deterministic keeps "no design without audit findings"
enforceable from code, not norms.
"""
from __future__ import annotations

from typing import Any

from ...delivery_state import (
    DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
)

STRONG_SIMILARITY: float = 0.7
"""Similarity threshold for a "strong reusable match" (Step 4 contract)."""

TIE_GAP: float = 0.05
"""Top-2 within this gap counts as ambiguous regardless of confidence."""

TESTED_AGAINST_SHADCN_MAJOR: int = 2
"""Major version the ``react-shadcn-ui`` skill body declares as ``Tested
against`` (``shadcn@2.1`` → major ``2``). When ``state.ui_audit
.shadcn_inventory.version`` resolves to a different major, audit emits
the soft version-mismatch halt (Phase 2 Step 5)."""

AMBIGUITIES: tuple[dict[str, str], ...] = (
    {
        "code": "audit_missing",
        "trigger": "state.ui_audit is None or empty — skill has not run yet",
        "resolution": "agent directive `existing-ui-audit` → skill writes "
        "findings into state.ui_audit",
    },
    {
        "code": "greenfield_undecided",
        "trigger": (
            "state.ui_audit.greenfield is True but greenfield_decision "
            "is unset — user has not picked a scaffolding direction"
        ),
        "resolution": "user picks scaffold / bare / external_reference; "
        "agent records the choice in state.ui_audit.greenfield_decision",
    },
    {
        "code": "shadcn_version_mismatch",
        "trigger": (
            "state.ui_audit.shadcn_inventory.version major differs from "
            "TESTED_AGAINST_SHADCN_MAJOR — react-shadcn-ui skill was "
            "tested against a different major"
        ),
        "resolution": "user accepts cautious composition or aborts; "
        "agent records the choice in "
        "state.ui_audit.version_mismatch_decision",
    },
    {
        "code": "audit_ambiguous",
        "trigger": (
            "confidence band is medium, OR inventory has multiple matches "
            "with similar similarity scores, OR no match clears "
            "STRONG_SIMILARITY"
        ),
        "resolution": "user picks a candidate to extend (or 'build new'); "
        "agent records the choice in state.ui_audit.audit_path "
        "and state.ui_audit.candidate_pick",
    },
)
"""Declared ambiguity surfaces for this step."""


def run(state: DeliveryState) -> StepResult:
    """Apply the audit gate to ``state.ui_audit``."""
    audit = state.ui_audit
    if not _is_populated(audit):
        return _delegate_to_audit_skill(state)

    if audit.get("greenfield") is True and not audit.get("greenfield_decision"):
        return _halt_greenfield(state, audit)

    # Greenfield with a recorded decision skips the candidate-pick halt
    # (there are no existing components to weigh) and lands on SUCCESS.
    if audit.get("greenfield") is True:
        if not audit.get("audit_path"):
            audit["audit_path"] = "greenfield"
        return StepResult(outcome=Outcome.SUCCESS)

    # Soft halt: react-shadcn-ui skill was tested against a specific
    # major; a project on a different major needs an explicit "proceed
    # with cautious composition" pick before apply runs. Idempotent via
    # ``version_mismatch_decision``.
    mismatch = _detect_shadcn_version_mismatch(audit)
    if mismatch is not None and not audit.get("version_mismatch_decision"):
        return _halt_shadcn_version_mismatch(state, mismatch)

    # Idempotent re-entry: an already-decided path round-trips through
    # SUCCESS without re-emitting the halt the user already answered.
    if audit.get("audit_path") in {"high_confidence", "ambiguous"}:
        return StepResult(outcome=Outcome.SUCCESS)

    decision = _decide_path(state, audit)
    if decision == "high_confidence":
        audit["audit_path"] = "high_confidence"
        return StepResult(outcome=Outcome.SUCCESS)

    return _halt_ambiguous(state, audit)


def _is_populated(audit: Any) -> bool:
    """True when ``audit`` carries actionable findings.

    Non-dict and empty-dict shapes are treated as "skill has not run"
    so the first-pass directive fires. Once the skill writes findings,
    the dict carries at least one of the documented inventory keys
    (``components_found`` or the legacy ``components`` alias).
    """
    if not isinstance(audit, dict):
        return False
    if not audit:
        return False
    return any(
        key in audit
        for key in ("components_found", "components", "greenfield")
    )


def _preview_input(state: DeliveryState) -> str:
    """Render a one-line preview of the input being audited."""
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


def _delegate_to_audit_skill(state: DeliveryState) -> StepResult:
    """Halt with an agent directive so the orchestrator runs ``existing-ui-audit``."""
    preview = _preview_input(state)
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            agent_directive("existing-ui-audit"),
            f"> Input: {preview}",
            "> No UI audit findings yet — running `existing-ui-audit` "
            "to inventory components, design system, tokens, and "
            "candidate matches before design.",
            "> 1. Continue — let the skill produce the audit",
            "> 2. Abort — drop this UI request",
        ],
        message=(
            "UI audit findings missing; delegating to existing-ui-audit skill."
        ),
    )


def _halt_greenfield(state: DeliveryState, audit: dict[str, Any]) -> StepResult:
    """BLOCKED halt — greenfield project needs an explicit scaffolding pick."""
    preview = _preview_input(state)
    questions = [
        f"> Input: {preview}",
        "> No existing UI surface detected — this looks like greenfield.",
        "> 1. Scaffold — minimal token set + base component primitive folder",
        "> 2. Bare — proceed with Tailwind defaults, no scaffolding",
        "> 3. External reference — point me at a design-system URL or file",
        "",
        "**Recommendation: 1 \u2014 Scaffold tokens + primitives** "
        "\u2014 even one extra screen benefits from a shared base; the "
        "scaffold cost is ~10 min and saves re-doing every primitive "
        "on screen 2. Caveat: flip to 2 if this is a demo or "
        "single-page prototype that will not grow.",
    ]
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=questions,
        message=(
            "UI audit detected greenfield; halting for scaffolding "
            "direction (scaffold / bare / external_reference)."
        ),
    )


def _decide_path(state: DeliveryState, audit: dict[str, Any]) -> str:
    """Return ``"high_confidence"`` or ``"ambiguous"`` for a populated audit.

    High-confidence requires *both*:

    - ``state.ticket["confidence"]["band"] == "high"`` (or the input
      kind makes confidence inapplicable — see :func:`_confidence_band`).
    - exactly one strong reusable match: top similarity
      ``\u2265 STRONG_SIMILARITY`` and no runner-up within
      :data:`TIE_GAP` of it.

    Anything else is ambiguous \u2014 medium / low confidence, no strong
    match, or two near-identical candidates the user must disambiguate.
    """
    band = _confidence_band(state)
    if band != "high":
        return "ambiguous"

    matches = _matches(audit)
    if not matches:
        return "ambiguous"

    scored = sorted(
        (_similarity_of(m) for m in matches),
        reverse=True,
    )
    top = scored[0]
    if top < STRONG_SIMILARITY:
        return "ambiguous"
    if len(scored) >= 2 and (top - scored[1]) < TIE_GAP:
        return "ambiguous"
    return "high_confidence"


def _confidence_band(state: DeliveryState) -> str:
    """Return the scored confidence band, or ``"high"`` when not applicable.

    Ticket inputs that survive the backend refine step carry a band in
    ``state.ticket["confidence"]["band"]``. Diff / file envelopes never
    run the scorer; treat them as ``"high"`` because the user is
    pointing at a concrete surface, not asking us to reconstruct one.
    Missing band defaults to ``"medium"`` so the safe path (ambiguous
    halt) is the fall-through.
    """
    data = state.ticket or {}
    confidence = data.get("confidence")
    if isinstance(confidence, dict):
        band = confidence.get("band")
        if isinstance(band, str) and band:
            return band
    if data.get("input_kind") in {"diff", "file"}:
        return "high"
    return "medium"


def _matches(audit: dict[str, Any]) -> list[dict[str, Any]]:
    """Return the inventory list, preferring ``components_found``."""
    for key in ("components_found", "components"):
        value = audit.get(key)
        if isinstance(value, list) and value:
            return [m for m in value if isinstance(m, dict)]
    return []


def _similarity_of(match: dict[str, Any]) -> float:
    """Read a similarity score from a match entry; default to 0.0."""
    raw = match.get("similarity")
    try:
        return float(raw)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.0


def _detect_shadcn_version_mismatch(audit: dict[str, Any]) -> dict[str, Any] | None:
    """Return mismatch info when the inventory diverges by a major.

    Reads ``audit["shadcn_inventory"]["version"]`` and compares its
    leading integer with :data:`TESTED_AGAINST_SHADCN_MAJOR`. Returns
    ``None`` (no halt) when:

    - the inventory is missing, not a dict, or has no ``version``;
    - the version string cannot be parsed (treat as "unknown — skill
      will fall back to manual composition rather than a stale skill");
    - the major matches the tested major.
    """
    inventory = audit.get("shadcn_inventory")
    if not isinstance(inventory, dict):
        return None
    raw_version = inventory.get("version")
    if not isinstance(raw_version, str) or not raw_version.strip():
        return None
    head = raw_version.lstrip("v").split(".", 1)[0].strip()
    try:
        installed_major = int(head)
    except ValueError:
        return None
    if installed_major == TESTED_AGAINST_SHADCN_MAJOR:
        return None
    return {
        "installed_version": raw_version,
        "installed_major": installed_major,
        "tested_major": TESTED_AGAINST_SHADCN_MAJOR,
    }


def _halt_shadcn_version_mismatch(
    state: DeliveryState, mismatch: dict[str, Any]
) -> StepResult:
    """BLOCKED soft-halt \u2014 user accepts cautious composition or aborts."""
    preview = _preview_input(state)
    installed = mismatch["installed_version"]
    tested = mismatch["tested_major"]
    installed_major = mismatch["installed_major"]
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            f"> Input: {preview}",
            f"> shadcn skill tested against v{tested}.x; project uses "
            f"`{installed}` (major v{installed_major}).",
            "> 1. Proceed with cautious composition \u2014 skill applies "
            "general patterns, agent verifies primitive APIs against "
            "the installed version",
            "> 2. Abort \u2014 update the `react-shadcn-ui` skill to the "
            "installed major before continuing",
            "",
            "**Recommendation: 1 \u2014 Proceed with caution** "
            "\u2014 most shadcn primitive APIs are stable across "
            "majors; the skill's structural guidance still applies. "
            "Caveat: flip to 2 if the design brief leans on a "
            "primitive whose API changed (Form, Sheet, Dialog have "
            "had breaking renames in past majors).",
        ],
        message=(
            f"shadcn version mismatch (skill v{tested}.x vs project "
            f"{installed}); halting for cautious-composition decision."
        ),
    )


def _halt_ambiguous(state: DeliveryState, audit: dict[str, Any]) -> StepResult:
    """BLOCKED halt \u2014 user picks an existing candidate or 'build new'."""
    preview = _preview_input(state)
    matches = _matches(audit)
    scored = sorted(
        matches,
        key=_similarity_of,
        reverse=True,
    )[:3]

    lines = [
        f"> Input: {preview}",
        "> Audit findings are ambiguous \u2014 pick the candidate to "
        "extend, or build new:",
    ]
    for idx, match in enumerate(scored, start=1):
        name = match.get("name") or match.get("path") or "(unnamed)"
        sim = _similarity_of(match)
        path = match.get("path") or ""
        suffix = f" \u2014 `{path}`" if path else ""
        lines.append(f"> {idx}. Extend `{name}` (similarity {sim:.2f}){suffix}")
    next_idx = len(scored) + 1
    lines.append(
        f"> {next_idx}. Build new \u2014 none of the above is close enough",
    )

    if scored:
        top = scored[0]
        top_name = top.get("name") or top.get("path") or "candidate 1"
        top_sim = _similarity_of(top)
        rec = (
            f"**Recommendation: 1 \u2014 Extend `{top_name}`** \u2014 "
            f"similarity {top_sim:.2f} is the strongest match in the "
            f"inventory; reuse beats new code unless the contract "
            f"diverges. Caveat: flip to {next_idx} if the existing "
            f"component cannot host the new behavior cleanly."
        )
    else:
        rec = (
            f"**Recommendation: {next_idx} \u2014 Build new** \u2014 "
            f"no inventory match cleared the strong-similarity bar. "
            f"Caveat: flip to an extend option only if a near-miss "
            f"is a better fit than starting from scratch."
        )
    lines.extend(["", rec])

    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=lines,
        message=(
            "UI audit findings ambiguous; halting for candidate pick "
            "(extend existing / build new)."
        ),
    )


__all__ = [
    "AMBIGUITIES",
    "STRONG_SIMILARITY",
    "TESTED_AGAINST_SHADCN_MAJOR",
    "TIE_GAP",
    "run",
]
