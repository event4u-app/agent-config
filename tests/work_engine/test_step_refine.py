"""Tests for the ``refine`` step.

The step is pure validation logic, so the tests exercise each
BLOCKED path (missing id, missing title, missing AC, vague AC) and
the SUCCESS path on a well-formed ticket. No external fakes needed
— ``refine`` does not call out to any other module.
"""
from __future__ import annotations

from work_engine import DeliveryState, Outcome
from work_engine.directives.backend import refine


def _good_ticket(**overrides: object) -> dict[str, object]:
    base = {
        "id": "TICKET-42",
        "title": "Allow users to export audit logs as CSV",
        "acceptance_criteria": [
            "Export endpoint returns a streamed CSV for ranges up to 90 days.",
            "Empty ranges return HTTP 204 with no body.",
        ],
    }
    base.update(overrides)
    return base


def test_refine_success_on_well_formed_ticket() -> None:
    state = DeliveryState(ticket=_good_ticket())

    result = refine.run(state)

    assert result.outcome is Outcome.SUCCESS
    assert result.questions == []


def test_refine_blocks_when_ticket_id_is_missing() -> None:
    state = DeliveryState(ticket=_good_ticket(id=""))

    result = refine.run(state)

    assert result.outcome is Outcome.BLOCKED
    # Headnote + three numbered options.
    assert len(result.questions) == 4
    assert "missing ticket id" in result.message
    assert any(q.startswith("> 1.") for q in result.questions)
    assert any(q.startswith("> 2.") for q in result.questions)
    assert any(q.startswith("> 3.") for q in result.questions)


def test_refine_blocks_when_title_is_trivial() -> None:
    state = DeliveryState(ticket=_good_ticket(title="x"))

    result = refine.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "trivial title" in result.message


def test_refine_blocks_when_acceptance_criteria_missing() -> None:
    state = DeliveryState(ticket=_good_ticket(acceptance_criteria=[]))

    result = refine.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "no acceptance criteria" in result.message


def test_refine_blocks_when_acceptance_criteria_are_vague() -> None:
    state = DeliveryState(
        ticket=_good_ticket(
            acceptance_criteria=["it works", "ship it"],
        ),
    )

    result = refine.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "vague acceptance criteria at position(s) 1, 2" in result.message


def test_refine_identifies_only_the_weak_ac_indices() -> None:
    state = DeliveryState(
        ticket=_good_ticket(
            acceptance_criteria=[
                "Proper AC long enough to pass the length floor.",
                "too short",
                "Another concrete criterion spelled out in full.",
            ],
        ),
    )

    result = refine.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "position(s) 2" in result.message
    assert "position(s) 1" not in result.message
    assert "position(s) 3" not in result.message


def test_refine_rejects_non_string_acceptance_criteria() -> None:
    state = DeliveryState(
        ticket=_good_ticket(acceptance_criteria=[{"not": "a string"}]),
    )

    result = refine.run(state)

    assert result.outcome is Outcome.BLOCKED
    assert "vague acceptance criteria at position(s) 1" in result.message


def test_refine_questions_cite_the_ticket_id() -> None:
    state = DeliveryState(ticket=_good_ticket(acceptance_criteria=[]))

    result = refine.run(state)

    assert result.outcome is Outcome.BLOCKED
    joined = "\n".join(result.questions)
    assert "TICKET-42" in joined
    assert "/refine-ticket" in joined
