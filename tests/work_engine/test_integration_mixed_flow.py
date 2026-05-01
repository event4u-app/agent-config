"""End-to-end integration of the mixed (backend + UI) directive set.

Phase 4 Step 5 of ``agents/roadmaps/road-to-product-ui-track.md``: two
mixed fixtures driven through the eight-step dispatcher with a fake
orchestrator. Each fixture proves the contract → ui → stitch chain
locks the backend surface, delegates the UI sub-flow, stitches the
seam, and reaches the delivery report.

Fixture A — *form + endpoint*: SavedSearch persistence (POST + GET).
Fixture B — *table + list endpoint with filtering*: order list with
status / date-range filters (GET with query params).

Mirrors :mod:`tests.work_engine.test_integration_full_flow` but drives
``mixed.get_steps`` and resumes the three mixed-specific directives
(``contract-plan``, ``ui-track``, ``integration-test``) plus the
backend-shared ``review-changes`` and the user-confirmation halt
between contract draft and UI delegation.
"""
from __future__ import annotations

from typing import Any

import pytest

from work_engine import (
    DeliveryState,
    Outcome,
    STEP_ORDER,
    dispatch,
    is_agent_directive,
)
from work_engine.directives.mixed import get_steps as mixed_steps


MIXED_STEPS = dict(mixed_steps())


@pytest.fixture()
def fake_memory_lookup(monkeypatch):
    """Stub ``memory_lookup.retrieve`` so the memory step is deterministic."""
    import sys
    import types

    stub = types.ModuleType("memory_lookup")
    stub.retrieve = lambda types_, keys, limit: []
    monkeypatch.setitem(sys.modules, "memory_lookup", stub)
    return stub


def _extract_directive_verb(questions: list[str]) -> str | None:
    """Return the directive verb, or ``None`` if the halt is user-facing."""
    if not questions or not is_agent_directive(questions[0]):
        return None
    payload = questions[0].split(":", 1)[1].strip()
    return payload.split(" ", 1)[0]


def _resume_as_agent(
    state: DeliveryState,
    verb: str | None,
    *,
    contract: dict[str, Any],
) -> str:
    """Apply the slice a real orchestrator would produce.

    Returns a label so the caller can record the rebound sequence. The
    user-confirmation halt (no directive) is encoded as ``"confirm-contract"``
    — the test treats the contract sentinel flip as a deterministic agent
    action so the loop converges without human input.
    """
    if verb is None:
        # Contract draft is in place, awaiting user confirmation.
        assert isinstance(state.contract, dict)
        state.contract["contract_confirmed"] = True
        return "confirm-contract"
    if verb == "contract-plan":
        state.contract = dict(contract)
        # plan step is the dispatcher slot; its outcome is what the
        # contract handler reads on re-entry.
        return verb
    if verb == "ui-track":
        state.ui_review = {"review_clean": True, "findings": []}
        state.outcomes["implement"] = Outcome.SUCCESS.value
        return verb
    if verb == "integration-test":
        state.stitch = {
            "verdict": "success",
            "scenarios": [{"id": f"S-{i}"} for i in range(1, 3)],
        }
        state.outcomes["test"] = Outcome.SUCCESS.value
        return verb
    if verb == "review-changes":
        state.verify = {"verdict": "success", "confidence": "high", "findings": []}
        state.outcomes["verify"] = Outcome.SUCCESS.value
        return verb
    raise AssertionError(f"unknown directive verb: {verb!r}")


def _drive_mixed_loop(
    state: DeliveryState,
    *,
    contract: dict[str, Any],
    max_iterations: int = 12,
) -> list[str]:
    """Run dispatch + resume until SUCCESS, returning the rebound labels."""
    seen: list[str] = []
    for _ in range(max_iterations):
        final, halting_step = dispatch(state, MIXED_STEPS)
        if final is Outcome.SUCCESS:
            return seen
        assert final is Outcome.BLOCKED, (
            f"unexpected halt at {halting_step}: outcome={final}"
        )
        verb = _extract_directive_verb(state.questions)
        label = _resume_as_agent(state, verb, contract=contract)
        seen.append(label)
    raise AssertionError("mixed dispatch did not converge within max_iterations")


# --- Fixture A: form + endpoint --------------------------------------------


def _form_endpoint_ticket() -> dict[str, Any]:
    return {
        "id": "MIX-A-1",
        "title": "Saved-search form + persistence endpoint",
        "acceptance_criteria": [
            "Users can save a named search from the search-results screen.",
            "POST /saved-searches persists name + query JSON; GET returns them.",
            "Form validates name (required, <=80 chars) and query (non-empty JSON).",
        ],
    }


def _form_endpoint_contract() -> dict[str, Any]:
    return {
        "data_model": [
            {"name": "SavedSearch", "fields": ["id", "name", "query", "owner_id"]},
        ],
        "api_surface": [
            {"method": "POST", "path": "/saved-searches"},
            {"method": "GET", "path": "/saved-searches"},
        ],
    }



def test_mixed_form_endpoint_converges_with_five_rebounds(fake_memory_lookup) -> None:
    """Fixture A — form + endpoint: full mixed flow lands at SUCCESS.

    Rebound sequence locks the chain: contract-plan draft, user
    confirmation, UI track delegation, integration-test smoke,
    backend review-changes. Five rebounds total.
    """
    state = DeliveryState(ticket=_form_endpoint_ticket())

    seen = _drive_mixed_loop(state, contract=_form_endpoint_contract())

    assert seen == [
        "contract-plan",
        "confirm-contract",
        "ui-track",
        "integration-test",
        "review-changes",
    ]
    assert all(
        state.outcomes.get(name) == Outcome.SUCCESS.value for name in STEP_ORDER
    ), state.outcomes


def test_mixed_form_endpoint_locks_contract_before_ui(fake_memory_lookup) -> None:
    """The UI track must not be reached until contract_confirmed is True.

    Drives the loop one rebound at a time and asserts ``ui-track`` is
    never the first directive emitted: the contract step holds the
    plan slot until the user signs off.
    """
    state = DeliveryState(ticket=_form_endpoint_ticket())
    contract = _form_endpoint_contract()

    # Step 1 — first halt must be contract-plan.
    final, halting = dispatch(state, MIXED_STEPS)
    assert final is Outcome.BLOCKED and halting == "plan"
    assert _extract_directive_verb(state.questions) == "contract-plan"

    # Step 2 — agent fills contract; next halt is the user-confirmation
    # screen (no directive). UI track is NOT yet reachable.
    _resume_as_agent(state, "contract-plan", contract=contract)
    final, halting = dispatch(state, MIXED_STEPS)
    assert final is Outcome.BLOCKED and halting == "plan"
    assert _extract_directive_verb(state.questions) is None
    assert state.outcomes.get("implement") != Outcome.SUCCESS.value

    # Step 3 — only after contract_confirmed flips does ui-track fire.
    _resume_as_agent(state, None, contract=contract)
    final, halting = dispatch(state, MIXED_STEPS)
    assert final is Outcome.BLOCKED and halting == "implement"
    assert _extract_directive_verb(state.questions) == "ui-track"


# --- Fixture B: table + list endpoint with filtering -----------------------


def _table_filter_ticket() -> dict[str, Any]:
    return {
        "id": "MIX-B-1",
        "title": "Order list table with status + date-range filters",
        "acceptance_criteria": [
            "Operators see a paginated table of orders with status, "
            "customer, total, created_at columns.",
            "GET /orders accepts `status` (enum) and `created_from` / "
            "`created_to` (ISO date) query params; returns paginated JSON.",
            "Empty filter result shows the empty-state message; "
            "applied filters survive page navigation.",
        ],
    }


def _table_filter_contract() -> dict[str, Any]:
    return {
        "data_model": [
            {
                "name": "Order",
                "fields": ["id", "status", "customer_id", "total", "created_at"],
            },
        ],
        "api_surface": [
            {
                "method": "GET",
                "path": "/orders",
                "query": ["status", "created_from", "created_to", "page"],
                "response": "paginated list of Order",
            },
        ],
    }


def test_mixed_table_filter_converges_with_five_rebounds(fake_memory_lookup) -> None:
    """Fixture B — table + filtered list endpoint: full mixed flow.

    Same chain as Fixture A but with a list endpoint carrying query
    parameters instead of a write surface. Locks that the contract
    shape (single GET endpoint, query slot) does not change the
    rebound sequence.
    """
    state = DeliveryState(ticket=_table_filter_ticket())

    seen = _drive_mixed_loop(state, contract=_table_filter_contract())

    assert seen == [
        "contract-plan",
        "confirm-contract",
        "ui-track",
        "integration-test",
        "review-changes",
    ]
    assert all(
        state.outcomes.get(name) == Outcome.SUCCESS.value for name in STEP_ORDER
    ), state.outcomes


def test_mixed_table_filter_records_two_smoke_scenarios(fake_memory_lookup) -> None:
    """The integration-test rebound writes the scenarios it ran.

    Asserts the stitch state surfaces in the final delivery state so
    a downstream report renderer can list the smoke cases (``S-1``,
    ``S-2``) the agent executed.
    """
    state = DeliveryState(ticket=_table_filter_ticket())

    _drive_mixed_loop(state, contract=_table_filter_contract())

    assert isinstance(state.stitch, dict)
    assert state.stitch.get("verdict") == "success"
    scenarios = state.stitch.get("scenarios") or []
    assert len(scenarios) == 2
    assert {s["id"] for s in scenarios} == {"S-1", "S-2"}
