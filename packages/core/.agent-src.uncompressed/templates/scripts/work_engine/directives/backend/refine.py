"""``refine`` step — deterministic gate in front of the refinement skills.

The step never calls an LLM. It inspects ``state.ticket`` (which carries
``input.data`` after the CLI projection) and routes on shape:

- **Ticket envelope** (``id``, ``title``, ``acceptance_criteria``) — the
  R1 path. Validates the minimum viable shape and either returns
  ``SUCCESS`` or ``BLOCKED`` with numbered options pointing at
  ``/refine-ticket``.
- **Prompt envelope** (``raw`` key present, ``reconstructed_ac`` /
  ``assumptions`` slots) — the R2 path. On the first pass the gate
  delegates to the ``refine-prompt`` skill via an ``@agent-directive:``
  halt; on the rebound it scores the reconstructed envelope and routes
  the resulting confidence band:

  - ``high``   → ``SUCCESS`` (silent proceed, breakdown logged for the report)
  - ``medium`` → ``PARTIAL`` with an assumptions-report halt
  - ``low``    → ``BLOCKED`` with one clarifying question targeted at the
    weakest dimension

The checks live here (rather than inside the refinement skills) because
the dispatcher is synchronous Python: it cannot "delegate" to an agent
skill mid-loop. Making the gate deterministic keeps the contract "block
on ambiguity, never guess" enforceable from code, and ensures the band
the dispatcher routes on is always engine-computed — the skill produces
AC + assumptions, the engine decides.
"""
from __future__ import annotations

from typing import Any

from ...delivery_state import (
    DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
)
from ...scoring import confidence as _confidence

_MIN_TITLE_LEN = 3
_MIN_AC_LEN = 10

AMBIGUITIES: tuple[dict[str, str], ...] = (
    {
        "code": "missing_id",
        "trigger": "ticket has no `id` field (or only whitespace)",
        "resolution": "run `/refine-ticket` or paste the ticket id in chat",
    },
    {
        "code": "trivial_title",
        "trigger": f"title missing or shorter than {_MIN_TITLE_LEN} chars",
        "resolution": "run `/refine-ticket` to rewrite the title",
    },
    {
        "code": "missing_or_vague_ac",
        "trigger": (
            f"acceptance_criteria empty, non-list, or any item under "
            f"{_MIN_AC_LEN} chars"
        ),
        "resolution": "run `/refine-ticket` to add concrete acceptance criteria",
    },
    {
        "code": "prompt_unrefined",
        "trigger": (
            "prompt envelope present but `reconstructed_ac` is empty — "
            "the deterministic gate has nothing to score yet"
        ),
        "resolution": "agent directive `refine-prompt` → run the skill, "
        "write AC + assumptions back into `state.ticket`",
    },
    {
        "code": "prompt_medium_confidence",
        "trigger": (
            "scored band is `medium` and the user has not confirmed the "
            "assumptions report yet"
        ),
        "resolution": "user confirms the reconstructed AC + assumptions, "
        "or refines them; agent flips `confidence_confirmed=True` to "
        "release the gate",
    },
    {
        "code": "prompt_low_confidence",
        "trigger": (
            "scored band is `low` — too little signal to plan against, "
            "even after reconstruction"
        ),
        "resolution": "user answers one clarifying question; the agent "
        "re-runs `refine-prompt` against the refreshed prompt",
    },
    {
        "code": "prompt_ui_intent",
        "trigger": (
            "scorer flagged `ui_intent=True` — the prompt reads as UI "
            "work and the backend track cannot ship it cleanly"
        ),
        "resolution": "user re-frames the prompt as backend-only, parks "
        "it for Roadmap 3 (`road-to-product-ui-track.md`), or aborts",
    },
)
"""Declared ambiguity surfaces. Every BLOCKED / PARTIAL return maps to one code."""


def run(state: DeliveryState) -> StepResult:
    """Route on envelope shape: ticket path or prompt path."""
    data = state.ticket or {}
    if _is_prompt_envelope(data):
        return _run_prompt(state, data)

    deficiencies = _diagnose(data)
    if not deficiencies:
        return StepResult(outcome=Outcome.SUCCESS)

    ticket_id = data.get("id") or "(no id)"
    questions = _format_questions(ticket_id, deficiencies)
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=questions,
        message=(
            f"Ticket {ticket_id} is not refined enough to plan against: "
            + "; ".join(deficiencies)
        ),
    )


def _is_prompt_envelope(data: dict[str, Any]) -> bool:
    """True when ``state.ticket`` carries a prompt envelope.

    The presence of a string-valued ``raw`` key is unambiguous: ticket
    payloads never carry ``raw``, and prompt envelopes always do (the
    resolver writes it before any handler sees the state).
    """
    if not isinstance(data, dict):
        return False
    raw = data.get("raw")
    return isinstance(raw, str) and bool(raw.strip())


def _diagnose(ticket: dict[str, Any]) -> list[str]:
    """Return a human-readable list of what's missing from the ticket.

    Order matches what a reader needs first (identity → summary →
    acceptance criteria) so the surfaced questions read naturally.
    """
    issues: list[str] = []

    ticket_id = ticket.get("id")
    if not isinstance(ticket_id, str) or not ticket_id.strip():
        issues.append("missing ticket id")

    title = ticket.get("title")
    if not isinstance(title, str) or len(title.strip()) < _MIN_TITLE_LEN:
        issues.append("missing or trivial title")

    ac = ticket.get("acceptance_criteria")
    if not isinstance(ac, list) or not ac:
        issues.append("no acceptance criteria")
    else:
        weak_indices = [
            idx + 1
            for idx, item in enumerate(ac)
            if not _is_concrete_ac(item)
        ]
        if weak_indices:
            issues.append(
                "vague acceptance criteria at position(s) "
                + ", ".join(str(i) for i in weak_indices),
            )

    return issues


def _is_concrete_ac(item: Any) -> bool:
    """An AC is concrete when it is a non-empty string above the length floor.

    The floor is deliberately loose: refine is a gate, not a style
    judge. The heavy lifting (measurability, testability, tone) is
    owned by the ``refine-ticket`` skill on the rebound.
    """
    if not isinstance(item, str):
        return False
    return len(item.strip()) >= _MIN_AC_LEN


def _format_questions(ticket_id: str, deficiencies: list[str]) -> list[str]:
    """Render the numbered options shown to the user when BLOCKED.

    Three options, ordered by likely next action: run the existing
    refinement skill, paste the missing data in chat, or abandon the
    ticket entirely. ``user-interaction`` requires numbered, prose-
    free options; the deficiency list is rendered as a headnote.
    """
    headnote = (
        "> Ticket "
        + ticket_id
        + " is missing: "
        + "; ".join(deficiencies)
        + "."
    )
    return [
        headnote,
        f"> 1. Run `/refine-ticket {ticket_id}` and re-invoke `/implement-ticket`",
        "> 2. Provide the missing details in chat — I'll merge them into the ticket",
        "> 3. Abandon this ticket — too vague to implement",
    ]


def _run_prompt(state: DeliveryState, data: dict[str, Any]) -> StepResult:
    """Score the prompt envelope and route on the resulting band.

    First pass (no AC reconstructed yet) → delegate to ``refine-prompt``.
    Second pass → score and branch:

    - ``high``   → ``SUCCESS``; the breakdown is recorded on
      ``state.ticket['confidence']`` so the report renderer can include
      it without re-scoring.
    - ``medium`` → ``PARTIAL`` with an assumptions-report halt unless
      the agent has flipped ``confidence_confirmed=True`` after the
      user signed off. ``low`` band can never be released this way.
    - ``low``    → ``BLOCKED`` with one clarifying question targeted at
      the weakest dimension (lowest score wins; ties prefer the order
      declared in :data:`work_engine.scoring.confidence.DIMENSION_NAMES`).
    """
    raw = data.get("raw") or ""
    ac = data.get("reconstructed_ac")
    if not isinstance(ac, list):
        ac = []
    assumptions = data.get("assumptions")
    if not isinstance(assumptions, list):
        assumptions = []

    if not ac:
        return _delegate_to_refine_prompt(raw)

    result = _confidence.score(raw=raw, ac=ac, assumptions=assumptions)
    data["confidence"] = {
        "band": result.band,
        "score": result.score,
        "dimensions": dict(result.dimensions),
        "reasons": list(result.reasons),
        "ui_intent": result.ui_intent,
    }
    # Mirror reconstructed AC into the legacy slot every downstream gate
    # (analyze, plan, implement) reads. Prompt envelopes carry AC under
    # ``reconstructed_ac``; without this projection ``analyze`` blocks with
    # "ticket lost its acceptance criteria" the moment ``refine`` succeeds.
    data["acceptance_criteria"] = list(ac)

    if result.ui_intent:
        return _halt_ui_intent(raw, result)

    if result.band == "high":
        return StepResult(outcome=Outcome.SUCCESS)

    if result.band == "medium":
        if data.get("confidence_confirmed") is True:
            return StepResult(outcome=Outcome.SUCCESS)
        return _halt_medium(raw, ac, assumptions, result)

    return _halt_low(raw, result)


def _delegate_to_refine_prompt(raw: str) -> StepResult:
    """Halt with an agent directive so the orchestrator runs ``refine-prompt``."""
    preview = _preview(raw)
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            agent_directive("refine-prompt"),
            f"> Prompt received: {preview}",
            "> No reconstructed acceptance criteria yet — running "
            "`refine-prompt` and resuming.",
            "> 1. Continue — let the skill reconstruct AC + assumptions",
            "> 2. Abort — the prompt is not what I meant",
        ],
        message="Prompt envelope present but unrefined; delegating to refine-prompt.",
    )


def _halt_medium(
    raw: str,
    ac: list[Any],
    assumptions: list[Any],
    result: "_confidence.ConfidenceScore",
) -> StepResult:
    """PARTIAL halt — assumptions report, one user round-trip."""
    preview = _preview(raw)
    ac_lines = [f">    {idx}. {item}" for idx, item in enumerate(ac, start=1)]
    asm_lines = [f">    - {item}" for item in assumptions] or [
        ">    - (none recorded)",
    ]
    questions = [
        f"> Prompt: {preview}",
        f"> Confidence: **medium** (score {result.score:.2f}). "
        "Assumptions worth confirming before I plan.",
        "> Reconstructed AC:",
        *ac_lines,
        "> Assumptions:",
        *asm_lines,
        "> 1. Continue as-is — the AC + assumptions are good enough",
        "> 2. Refine — I'll send a corrected prompt and re-run "
        "`refine-prompt`",
        "> 3. Abort — pause this `/work` cycle",
    ]
    return StepResult(
        outcome=Outcome.PARTIAL,
        questions=questions,
        message=(
            f"Prompt scored medium ({result.score:.2f}); "
            "halting for assumptions confirmation."
        ),
    )


def _halt_low(raw: str, result: "_confidence.ConfidenceScore") -> StepResult:
    """BLOCKED halt — one targeted question on the weakest dimension."""
    preview = _preview(raw)
    weakest_idx, weakest_name = _weakest_dimension(result.dimensions)
    reason = result.reasons[weakest_idx] if weakest_idx < len(result.reasons) else ""
    prompts = {
        "goal_clarity": "What is the single observable outcome you want?",
        "scope_boundary": "Which file, class, or module should I touch?",
        "ac_evidence": "What concrete behaviour proves it works?",
        "stack_data": "Which table, column, or migration target is involved?",
        "reversibility": "Is this change destructive — should I work behind a flag?",
    }
    question = prompts.get(weakest_name, "Can you tighten the prompt?")
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            f"> Prompt: {preview}",
            f"> Confidence: **low** (score {result.score:.2f}). "
            f"Weakest dimension: `{weakest_name}` — {reason}",
            f"> {question}",
            "> 1. I'll answer — paste the answer in chat and re-invoke `/work`",
            "> 2. Abort — drop this prompt",
        ],
        message=(
            f"Prompt scored low ({result.score:.2f}); blocking on "
            f"`{weakest_name}` clarification."
        ),
    )


def _halt_ui_intent(
    raw: str, result: "_confidence.ConfidenceScore",
) -> StepResult:
    """BLOCKED halt — UI-shaped prompts await the R3 dispatch track.

    The backend `directives/backend/` set has no UI capability; routing a
    UI prompt through it would either ship a backend stub or guess at a
    component. Both are worse than a clean refusal with a pointer to the
    deferred R3 track. The halt is band-independent — even a high-band
    UI prompt blocks here, because confidence on the *reconstruction* says
    nothing about whether the *dispatcher* can deliver it.
    """
    preview = _preview(raw)
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            f"> Prompt: {preview}",
            "> This prompt reads as **UI work** — the backend dispatch "
            "track can't ship it cleanly.",
            "> UI dispatch is deferred to Roadmap 3 "
            "(`road-to-product-ui-track.md`); until it lands, `/work` "
            "only handles backend-shaped prompts.",
            "> 1. Re-frame as a backend-only prompt — I'll re-score and proceed",
            "> 2. Park this prompt — wait for R3 and re-invoke `/work` then",
            "> 3. Abort — drop this prompt",
        ],
        message=(
            f"Prompt flagged as UI-intent (band={result.band}, "
            f"score={result.score:.2f}); blocked pending R3 UI track."
        ),
    )


def _weakest_dimension(dimensions: dict[str, int]) -> tuple[int, str]:
    """Return ``(index, name)`` of the lowest-scoring dimension.

    Ties are broken by :data:`_confidence.DIMENSION_NAMES` order so the
    same input always produces the same question (replay determinism).
    """
    ordered = list(_confidence.DIMENSION_NAMES)
    weakest_name = min(ordered, key=lambda n: (dimensions.get(n, 0), ordered.index(n)))
    return ordered.index(weakest_name), weakest_name


def _preview(raw: str, max_chars: int = 80) -> str:
    """Trim a raw prompt for inline display in halts."""
    text = " ".join((raw or "").split())
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 1].rstrip() + "\u2026"


__all__ = ["AMBIGUITIES", "run"]
