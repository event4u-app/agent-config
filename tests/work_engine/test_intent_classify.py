"""Tests for ``work_engine.intent.classify`` (R3 Phase 1 Step 5b).

Covers the 5-label heuristic classifier and the directive-set routing
table — 16 prompt fixtures (3 per non-trivial intent + 4 trivial-vs-
improve edge cases) per the roadmap. Wire-format integration tests for
``populate_routing`` live in :mod:`test_intent_routing`.
"""
from __future__ import annotations

import pytest

from work_engine.intent.classify import (
    INTENT_BACKEND,
    INTENT_MIXED,
    INTENT_UI_BUILD,
    INTENT_UI_IMPROVE,
    INTENT_UI_TRIVIAL,
    KNOWN_INTENTS,
    classify_intent,
    directive_set_for,
)


# -- ui-build (3) -----------------------------------------------------

@pytest.mark.parametrize(
    "prompt",
    [
        "Add a new dashboard page with user metrics",
        "Build a fresh checkout screen",
        "Create a new modal for payment confirmation",
    ],
)
def test_ui_build(prompt: str) -> None:
    assert classify_intent(prompt) == INTENT_UI_BUILD


# -- ui-improve (3) ---------------------------------------------------

@pytest.mark.parametrize(
    "prompt",
    [
        "Polish the existing login form",
        "Redesign the sidebar navigation",
        "Improve the dashboard layout",
    ],
)
def test_ui_improve(prompt: str) -> None:
    assert classify_intent(prompt) == INTENT_UI_IMPROVE


# -- ui-trivial (3) ---------------------------------------------------

@pytest.mark.parametrize(
    "prompt",
    [
        "Make the Save button red",
        "Change the header text to Welcome",
        "Rename the Submit label to Confirm",
    ],
)
def test_ui_trivial(prompt: str) -> None:
    assert classify_intent(prompt) == INTENT_UI_TRIVIAL


# -- mixed (3) --------------------------------------------------------

@pytest.mark.parametrize(
    "prompt",
    [
        "Build a CSV export endpoint with a download button",
        "Add an API and a settings page that consumes it",
        "Wire a webhook receiver and an admin tile to inspect events",
    ],
)
def test_mixed(prompt: str) -> None:
    assert classify_intent(prompt) == INTENT_MIXED


# -- backend-coding (3) -----------------------------------------------

@pytest.mark.parametrize(
    "prompt",
    [
        "Add a CSV export endpoint",
        "Refactor the user service",
        "Add a migration for the orders table",
    ],
)
def test_backend(prompt: str) -> None:
    assert classify_intent(prompt) == INTENT_BACKEND


# -- trivial vs improve edge cases (4) --------------------------------

def test_color_swap_is_trivial_not_improve() -> None:
    # Color swap on a button reads trivial even with no verb override.
    assert classify_intent("Make the primary button blue") == INTENT_UI_TRIVIAL


def test_redesign_button_is_improve_not_trivial() -> None:
    # "Redesign" is an improve verb; even on a button surface it stays improve.
    assert classify_intent("Redesign the primary button component") == INTENT_UI_IMPROVE


def test_rename_label_is_trivial_only_when_short() -> None:
    # Long-form rename request escalates beyond trivial — the short-form
    # length cap on trivial verbs prevents drift.
    long_prompt = (
        "Rename the Submit label to Confirm and also restructure the "
        "form layout, add validation, and update the success message"
    )
    assert classify_intent(long_prompt) != INTENT_UI_TRIVIAL


def test_change_text_to_value_pattern_wins_over_long_text() -> None:
    # The trivial *pattern* (change <copy> to <value>) wins regardless of
    # length — the user is being explicit about a single-string edit.
    long_prompt = (
        "Change the header copy to 'Welcome back' on the dashboard, "
        "and that is the only thing I want changed in this iteration"
    )
    assert classify_intent(long_prompt) == INTENT_UI_TRIVIAL


# -- routing table ----------------------------------------------------

def test_directive_set_for_ui_build() -> None:
    assert directive_set_for(INTENT_UI_BUILD) == "ui"


def test_directive_set_for_ui_improve() -> None:
    assert directive_set_for(INTENT_UI_IMPROVE) == "ui"


def test_directive_set_for_ui_trivial() -> None:
    assert directive_set_for(INTENT_UI_TRIVIAL) == "ui-trivial"


def test_directive_set_for_mixed() -> None:
    assert directive_set_for(INTENT_MIXED) == "mixed"


def test_directive_set_for_backend() -> None:
    assert directive_set_for(INTENT_BACKEND) == "backend"


def test_directive_set_for_unknown_raises() -> None:
    with pytest.raises(ValueError, match="unknown intent"):
        directive_set_for("nonsense")


def test_known_intents_locked() -> None:
    assert KNOWN_INTENTS == {
        INTENT_UI_BUILD,
        INTENT_UI_IMPROVE,
        INTENT_UI_TRIVIAL,
        INTENT_MIXED,
        INTENT_BACKEND,
    }


# -- empty / degenerate inputs ----------------------------------------

def test_empty_prompt_defaults_to_backend() -> None:
    assert classify_intent("") == INTENT_BACKEND


def test_whitespace_only_prompt_defaults_to_backend() -> None:
    assert classify_intent("   \n\t  ") == INTENT_BACKEND


def test_title_alone_classifies() -> None:
    # Single-line ticket headlines arrive in the title slot.
    assert classify_intent("", title="Add a CSV export endpoint") == INTENT_BACKEND
    assert classify_intent("", title="Build a new dashboard page") == INTENT_UI_BUILD
