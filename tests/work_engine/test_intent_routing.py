"""Tests for :func:`work_engine.intent.populate_routing`.

The routing helper bridges the classifier and the WorkState envelope:
fresh states get ``intent`` + ``directive_set`` filled in from the
prompt or ticket text; pre-classified states (loaded from disk, or
manually overridden) are left untouched.
"""
from __future__ import annotations

from work_engine.intent import populate_routing
from work_engine.state import (
    DEFAULT_DIRECTIVE_SET,
    DEFAULT_INTENT,
    Input,
    WorkState,
)


def _prompt_state(raw: str) -> WorkState:
    return WorkState(input=Input(kind="prompt", data={"raw": raw}))


def _ticket_state(**fields: object) -> WorkState:
    return WorkState(input=Input(kind="ticket", data=dict(fields)))


# -- prompt envelope --------------------------------------------------

def test_prompt_ui_build_routes_to_ui() -> None:
    state = _prompt_state("Build a new checkout screen")
    populate_routing(state)
    assert state.intent == "ui-build"
    assert state.directive_set == "ui"


def test_prompt_ui_trivial_routes_to_ui_trivial() -> None:
    state = _prompt_state("Make the Save button red")
    populate_routing(state)
    assert state.intent == "ui-trivial"
    assert state.directive_set == "ui-trivial"


def test_prompt_mixed_routes_to_mixed() -> None:
    state = _prompt_state("Add an API and a settings page that consumes it")
    populate_routing(state)
    assert state.intent == "mixed"
    assert state.directive_set == "mixed"


def test_prompt_backend_keeps_default() -> None:
    state = _prompt_state("Add a CSV export endpoint")
    populate_routing(state)
    assert state.intent == DEFAULT_INTENT
    assert state.directive_set == DEFAULT_DIRECTIVE_SET


def test_prompt_empty_keeps_backend_default() -> None:
    state = _prompt_state("")
    populate_routing(state)
    assert state.intent == DEFAULT_INTENT
    assert state.directive_set == DEFAULT_DIRECTIVE_SET


# -- ticket envelope --------------------------------------------------

def test_ticket_title_drives_classification() -> None:
    state = _ticket_state(
        id="ABC-1",
        title="Build a new dashboard page",
        acceptance_criteria=["User sees the dashboard"],
    )
    populate_routing(state)
    assert state.intent == "ui-build"
    assert state.directive_set == "ui"


def test_ticket_ac_drives_classification_when_title_neutral() -> None:
    state = _ticket_state(
        id="ABC-2",
        title="Refresh the design",
        acceptance_criteria=[
            "Polish the existing login form",
            "Tighten spacing in the sidebar",
        ],
    )
    populate_routing(state)
    assert state.intent == "ui-improve"
    assert state.directive_set == "ui"


def test_ticket_description_used_when_ac_missing() -> None:
    state = _ticket_state(
        id="ABC-3",
        title="Quick fix",
        description="Make the Save button red",
    )
    populate_routing(state)
    assert state.intent == "ui-trivial"
    assert state.directive_set == "ui-trivial"


def test_ticket_backend_default() -> None:
    state = _ticket_state(
        id="ABC-4",
        title="Add a CSV export endpoint",
        acceptance_criteria=["GET /exports/csv returns the file"],
    )
    populate_routing(state)
    assert state.intent == DEFAULT_INTENT
    assert state.directive_set == DEFAULT_DIRECTIVE_SET


# -- idempotency / override-safety ------------------------------------

def test_pre_classified_state_is_left_untouched() -> None:
    # A loaded state that already carries a UI label must round-trip
    # without being reclassified — the user (or an earlier turn) had
    # the floor.
    state = _prompt_state("Make the Save button red")
    state.intent = "ui-build"
    state.directive_set = "ui"
    populate_routing(state)
    assert state.intent == "ui-build"
    assert state.directive_set == "ui"


def test_repeated_calls_are_stable() -> None:
    state = _prompt_state("Build a new checkout screen")
    populate_routing(state)
    intent_after_first = state.intent
    directive_after_first = state.directive_set
    populate_routing(state)
    assert state.intent == intent_after_first
    assert state.directive_set == directive_after_first


def test_default_state_with_unrelated_text_stays_backend() -> None:
    # Backend default is the construction default; calling the helper
    # on a backend-shaped prompt is a no-op observable on the wire.
    state = _prompt_state("Refactor the user service")
    populate_routing(state)
    assert state.intent == DEFAULT_INTENT
    assert state.directive_set == DEFAULT_DIRECTIVE_SET


# -- diff / file envelopes (R3 Phase 1) -------------------------------

def test_diff_envelope_routes_to_ui_improve() -> None:
    # Diff inputs describe an existing UI surface to improve; the
    # heuristic does not run, the directive set is fixed.
    state = WorkState(
        input=Input(
            kind="diff",
            data={"raw": "diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1 +1 @@\n-a\n+b\n"},
        ),
    )
    populate_routing(state)
    assert state.intent == "ui-improve"
    assert state.directive_set == "ui"


def test_file_envelope_routes_to_ui_improve() -> None:
    state = WorkState(
        input=Input(
            kind="file",
            data={"path": "src/components/Sidebar.tsx"},
        ),
    )
    populate_routing(state)
    assert state.intent == "ui-improve"
    assert state.directive_set == "ui"


def test_diff_envelope_with_pre_classified_intent_is_left_untouched() -> None:
    # A loaded state that already carries a UI label round-trips even
    # when the envelope kind would have routed to a different default.
    state = WorkState(
        input=Input(
            kind="diff",
            data={"raw": "diff --git a/x b/x\n@@ -1 +1 @@\n-a\n+b\n"},
        ),
        intent="ui-trivial",
        directive_set="ui-trivial",
    )
    populate_routing(state)
    assert state.intent == "ui-trivial"
    assert state.directive_set == "ui-trivial"
