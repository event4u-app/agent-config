"""GT-CS goldens — end-to-end suggestion engine acceptance tests.

Nine cases mirror the `road-to-context-aware-command-suggestion`
acceptance criteria. Each runs `load_commands → match → rank →
apply_cooldown → render` against the real `.agent-src.uncompressed/
commands/` directory and asserts the structural invariants the rule
contract promises.

Goldens here check **shape** (which commands surface, recommendation
line, as-is option present, no leakage) rather than verbatim text —
description trimming and tie-break thresholds drift independently
of the contract.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from command_suggester import (  # noqa: E402
    CooldownStore,
    Settings,
    apply_cooldown,
    is_explicit_slash_invocation,
    load_commands,
    match,
    rank,
    render,
)

REPO_ROOT = Path(__file__).resolve().parent.parent
COMMANDS_DIR = REPO_ROOT / ".agent-src.uncompressed" / "commands"
RULE_PATH = REPO_ROOT / ".agent-src.uncompressed" / "rules" / "command-suggestion-policy.md"


@pytest.fixture(scope="module")
def specs():
    return load_commands(COMMANDS_DIR)


@pytest.fixture(scope="module")
def specs_by_name(specs):
    return {s.name: s for s in specs}


def _suggest(message, specs, specs_by_name, *, settings=None, store=None):
    """Run the full pipeline. Returns (ranked_matches, rendered_block)."""
    settings = settings or Settings()
    store = store or CooldownStore()
    if not settings.enabled or is_explicit_slash_invocation(message):
        return [], ""
    raw = match(message, [], specs)
    ranked = rank(raw, settings, specs_by_name, raw_message=message)
    cooled = apply_cooldown(ranked, store, settings, specs_by_name)
    return cooled, render(cooled, specs_by_name)


def test_GT_CS1_single_match_ticket_intent(specs, specs_by_name) -> None:
    """Ticket-shaped prompt → /implement-ticket surfaces with structural bonus."""
    ranked, block = _suggest("Setze Ticket ABC-123 um", specs, specs_by_name)
    names = [m.command for m in ranked]
    assert "implement-ticket" in names
    assert ranked[0].command == "implement-ticket"
    assert "Just run the prompt as-is, no command" in block
    assert "Recommendation: 1 — /implement-ticket" in block


def test_GT_CS2_multi_match_commit_and_pr(specs, specs_by_name) -> None:
    """Two commands match the same prompt → both surface, as-is last."""
    ranked, block = _suggest(
        "commit my changes and write a PR description", specs, specs_by_name
    )
    names = [m.command for m in ranked]
    assert "commit" in names
    assert "create-pr:description-only" in names
    # As-is option index = len(matches) + 1.
    assert f"> {len(ranked) + 1}. Just run the prompt as-is, no command" in block


def test_GT_CS3_sub_floor_vague_suppressed(specs, specs_by_name) -> None:
    """Vague prompt → no block emitted, prompt processed as-is."""
    ranked, block = _suggest("do it now", specs, specs_by_name)
    assert ranked == []
    assert block == ""


def test_GT_CS4_explicit_slash_bypasses(specs, specs_by_name) -> None:
    """Explicit `/command` → engine fully bypassed, zero output."""
    assert is_explicit_slash_invocation("/quality-fix") is True
    ranked, block = _suggest("/quality-fix", specs, specs_by_name)
    assert ranked == []
    assert block == ""


def test_GT_CS5_pick_as_is_records_cooldown(specs, specs_by_name) -> None:
    """User picks as-is → engine records cooldown so next turn is silent."""
    store = CooldownStore()
    ranked1, _ = _suggest("Setze Ticket ABC-123 um", specs, specs_by_name, store=store)
    assert ranked1, "GT-CS5 fixture must produce a match first"
    store.record_shown(ranked1)
    ranked2, block2 = _suggest(
        "Setze Ticket ABC-123 um", specs, specs_by_name, store=store
    )
    assert ranked2 == []
    assert block2 == ""


def test_GT_CS6_cooldown_silences_repeat(specs, specs_by_name) -> None:
    """Same trigger fires twice within window → second silent."""
    store = CooldownStore()
    ranked1, _ = _suggest(
        "commit my changes please now", specs, specs_by_name, store=store
    )
    assert any(m.command == "commit" for m in ranked1)
    store.record_shown(ranked1)
    ranked2, _ = _suggest(
        "commit my changes please now", specs, specs_by_name, store=store
    )
    assert all(m.command != "commit" for m in ranked2)


def test_GT_CS7_settings_disabled_silences(specs, specs_by_name) -> None:
    """`enabled: false` → zero output regardless of triggers."""
    settings = Settings(enabled=False)
    ranked, block = _suggest(
        "Setze Ticket ABC-123 um", specs, specs_by_name, settings=settings
    )
    assert ranked == []
    assert block == ""


def test_GT_CS8_clarification_wins_documented_in_rule() -> None:
    """Subordination contract: clarification wins, suggestion silent that turn.

    Contract lives in the rule (`ask-when-uncertain` outranks suggestion).
    Goldens verify the rule literally states it; runtime enforcement is
    the agent's job, not the engine's.
    """
    body = RULE_PATH.read_text(encoding="utf-8").lower()
    assert "ask-when-uncertain" in body
    assert "clarification wins" in body or "clarification is owed" in body


def test_GT_CS9_adversarial_echo_does_not_trigger(specs, specs_by_name) -> None:
    """Quoted `/commit` in user-pasted code → no commit suggestion."""
    msg = "explain `/commit` versus `/commit-in-chunks` from the docs"
    ranked, _ = _suggest(msg, specs, specs_by_name)
    assert all(m.command not in {"commit", "commit-in-chunks"} for m in ranked)
