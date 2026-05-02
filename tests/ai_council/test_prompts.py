"""Neutrality + per-mode addendum coverage for ai_council.prompts."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.ai_council.project_context import ProjectContext  # noqa: E402
from scripts.ai_council.prompts import (  # noqa: E402
    HOST_AGENT_IDENTITY_PATTERNS,
    NEUTRALITY_PREAMBLE,
    all_modes,
    handoff_preamble,
    system_prompt_for,
)


def test_all_modes_returns_sorted_canonical_set() -> None:
    assert all_modes() == ["diff", "files", "prompt", "roadmap"]


@pytest.mark.parametrize("mode", ["diff", "files", "prompt", "roadmap"])
def test_system_prompt_starts_with_neutrality_preamble(mode: str) -> None:
    sp = system_prompt_for(mode)
    assert sp.startswith(NEUTRALITY_PREAMBLE)


@pytest.mark.parametrize("mode", ["diff", "files", "prompt", "roadmap"])
def test_system_prompt_includes_mode_specific_addendum(mode: str) -> None:
    sp = system_prompt_for(mode)
    # Each addendum must exist after the preamble.
    after = sp[len(NEUTRALITY_PREAMBLE) :]
    assert len(after.strip()) > 0


def test_unknown_mode_raises() -> None:
    with pytest.raises(ValueError, match="Unknown council mode"):
        system_prompt_for("nope")


@pytest.mark.parametrize("mode", ["diff", "files", "prompt", "roadmap"])
def test_no_host_agent_identity_leak(mode: str) -> None:
    """Iron Law: the council never sees the host agent's name."""
    sp = system_prompt_for(mode).lower()
    forbidden = ["augment", "claude code", "cursor agent", "copilot agent"]
    for needle in forbidden:
        assert needle not in sp, (
            f"system prompt for {mode!r} leaks host-agent identity: {needle!r}"
        )


@pytest.mark.parametrize("mode", ["diff", "files", "prompt", "roadmap"])
def test_no_yes_man_bias(mode: str) -> None:
    """The reviewer must not be primed to agree."""
    sp = system_prompt_for(mode).lower()
    # Crude but useful guard: explicit anti-bias language is required.
    assert "disagree" in sp or "challenge" in sp or "critique" in sp


def test_neutrality_preamble_has_independence_clause() -> None:
    assert "independent" in NEUTRALITY_PREAMBLE.lower()
    assert "not seen" in NEUTRALITY_PREAMBLE.lower()


# ── handoff_preamble ──────────────────────────────────────────────────────────


def test_handoff_preamble_collapses_to_neutrality_when_empty() -> None:
    """Backward-compat: no project, no ask → identical to v1 preamble."""
    assert handoff_preamble(None, "") == NEUTRALITY_PREAMBLE
    assert handoff_preamble(ProjectContext(), "") == NEUTRALITY_PREAMBLE


def test_handoff_preamble_includes_project_fields() -> None:
    p = ProjectContext(name="vendor/pkg", stack="PHP ^8.2 · Laravel", repo_purpose="A neutral orchestrator.")
    out = handoff_preamble(p, "")
    assert "Project: vendor/pkg" in out
    assert "Stack: PHP ^8.2 · Laravel" in out
    assert "Purpose: A neutral orchestrator." in out
    assert out.endswith(NEUTRALITY_PREAMBLE)


def test_handoff_preamble_omits_missing_fields_silently() -> None:
    p = ProjectContext(name="vendor/pkg")  # stack + purpose missing
    out = handoff_preamble(p, "")
    assert "Project: vendor/pkg" in out
    assert "Stack:" not in out
    assert "Purpose:" not in out
    assert "None" not in out


def test_handoff_preamble_passes_original_ask_verbatim() -> None:
    out = handoff_preamble(None, "review this roadmap before I execute it")
    assert "The user originally asked:" in out
    assert "> review this roadmap before I execute it" in out
    assert out.endswith(NEUTRALITY_PREAMBLE)


def test_handoff_preamble_quotes_multiline_ask() -> None:
    out = handoff_preamble(None, "line one\nline two")
    assert "> line one" in out
    assert "> line two" in out


@pytest.mark.parametrize("needle", list(HOST_AGENT_IDENTITY_PATTERNS))
def test_handoff_preamble_strips_host_identity_from_ask(needle: str) -> None:
    """Iron Law: a line mentioning the host agent must not leak."""
    ask = f"the {needle} agent thinks this is fine\nbut the user disagrees"
    out = handoff_preamble(None, ask)
    assert needle not in out.lower()
    assert "but the user disagrees" in out


@pytest.mark.parametrize("needle", list(HOST_AGENT_IDENTITY_PATTERNS))
def test_handoff_preamble_strips_host_identity_from_project(needle: str) -> None:
    p = ProjectContext(name="vendor/pkg", repo_purpose=f"Built with {needle} support.")
    out = handoff_preamble(p, "")
    assert needle not in out.lower()


def test_handoff_preamble_strips_only_offending_lines() -> None:
    ask = "first line is fine\nclaude code says no\nthird line is also fine"
    out = handoff_preamble(None, ask)
    assert "first line is fine" in out
    assert "third line is also fine" in out
    assert "claude code" not in out.lower()


def test_handoff_preamble_empty_after_strip_falls_back_to_neutrality() -> None:
    """If every line is host-identity noise, output collapses to NEUTRALITY only."""
    out = handoff_preamble(None, "claude code\naugment\ncursor agent")
    assert out == NEUTRALITY_PREAMBLE


# ── system_prompt_for with handoff arguments ──────────────────────────────────


def test_system_prompt_for_without_project_matches_v1_shape() -> None:
    """Back-compat: no kwargs → identical to pre-2a output."""
    out = system_prompt_for("prompt")
    assert out.startswith(NEUTRALITY_PREAMBLE)


def test_system_prompt_for_with_project_uses_handoff_preamble() -> None:
    p = ProjectContext(name="vendor/pkg", stack="PHP")
    out = system_prompt_for("prompt", project=p, original_ask="critique this")
    assert "Project: vendor/pkg" in out
    assert "> critique this" in out
    # Per-mode addendum still appended after.
    assert "honest assessment" in out.lower()


def test_system_prompt_for_with_only_original_ask_still_includes_ask() -> None:
    out = system_prompt_for("roadmap", original_ask="ship it?")
    assert "> ship it?" in out
    assert NEUTRALITY_PREAMBLE in out
