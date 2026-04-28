"""``refine`` step — deterministic gate in front of the ``refine-ticket`` skill.

The step never calls an LLM. It inspects ``state.ticket`` for the
minimum viable shape (an identifier, a non-trivial title, and at
least one sufficiently concrete acceptance criterion) and either:

- returns ``SUCCESS`` — the ticket is already refined enough for the
  downstream steps to plan against, or
- returns ``BLOCKED`` — the deficiencies are listed as numbered
  options per the ``user-interaction`` rule, and the flow halts so
  the user can run ``/refine-ticket`` (or provide the missing data)
  and re-invoke ``/implement-ticket``.

The checks live here (rather than inside the ``refine-ticket`` skill)
because the dispatcher is synchronous Python: it cannot "delegate"
to an agent skill mid-loop. Making the gate deterministic keeps the
contract "block on ambiguity, never guess" enforceable from code,
and leaves the harder judgement calls (is an AC measurable? testable?)
to the human-run ``/refine-ticket`` flow on the rebound.
"""
from __future__ import annotations

from typing import Any

from ...delivery_state import DeliveryState, Outcome, StepResult

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
)
"""Declared ambiguity surfaces. Every BLOCKED return maps to one code."""


def run(state: DeliveryState) -> StepResult:
    """Return SUCCESS when the ticket is refined, BLOCKED otherwise."""
    deficiencies = _diagnose(state.ticket)
    if not deficiencies:
        return StepResult(outcome=Outcome.SUCCESS)

    ticket_id = state.ticket.get("id") or "(no id)"
    questions = _format_questions(ticket_id, deficiencies)
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=questions,
        message=(
            f"Ticket {ticket_id} is not refined enough to plan against: "
            + "; ".join(deficiencies)
        ),
    )


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


__all__ = ["AMBIGUITIES", "run"]
