"""Neutrality + per-mode addendum coverage for ai_council.prompts."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.ai_council.prompts import (  # noqa: E402
    NEUTRALITY_PREAMBLE,
    all_modes,
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
