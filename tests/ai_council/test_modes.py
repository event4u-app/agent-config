"""Mode resolution precedence (Phase 2b · F3)."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.ai_council.modes import (  # noqa: E402
    DEFAULT_MODE,
    VALID_MODES,
    InvalidModeError,
    resolve_mode,
    resolve_modes,
)


# ── default-only ───────────────────────────────────────────────────────────


def test_resolve_returns_default_when_all_layers_empty():
    assert resolve_mode("anthropic") == DEFAULT_MODE
    assert DEFAULT_MODE == "api"


def test_default_is_in_valid_modes():
    assert DEFAULT_MODE in VALID_MODES


# ── precedence: invocation > member > global > default ─────────────────────


def test_invocation_beats_member_and_global():
    out = resolve_mode(
        "anthropic",
        invocation_mode="manual",
        member_settings={"mode": "api"},
        global_mode="api",
    )
    assert out == "manual"


def test_member_beats_global():
    out = resolve_mode(
        "anthropic",
        member_settings={"mode": "manual"},
        global_mode="api",
    )
    assert out == "manual"


def test_global_used_when_member_absent():
    out = resolve_mode("anthropic", global_mode="manual")
    assert out == "manual"


def test_member_setting_with_no_mode_key_falls_back_to_global():
    out = resolve_mode(
        "anthropic",
        member_settings={"enabled": True, "model": "x"},
        global_mode="manual",
    )
    assert out == "manual"


# ── empty / whitespace / None normalisation ────────────────────────────────


@pytest.mark.parametrize("empty", ["", "   ", None])
def test_empty_invocation_falls_through(empty):
    out = resolve_mode("anthropic", invocation_mode=empty, global_mode="manual")
    assert out == "manual"


def test_case_and_whitespace_insensitive():
    assert resolve_mode("anthropic", invocation_mode="  MANUAL  ") == "manual"
    assert resolve_mode("anthropic", global_mode="API") == "api"


# ── invalid values ─────────────────────────────────────────────────────────


def test_invalid_invocation_raises():
    with pytest.raises(InvalidModeError) as exc:
        resolve_mode("anthropic", invocation_mode="bogus")
    assert "/council mode=" in str(exc.value)


def test_invalid_member_mode_raises():
    with pytest.raises(InvalidModeError) as exc:
        resolve_mode("anthropic", member_settings={"mode": "bogus"})
    assert "ai_council.members.anthropic.mode" in str(exc.value)


def test_invalid_global_mode_raises():
    with pytest.raises(InvalidModeError) as exc:
        resolve_mode("anthropic", global_mode="bogus")
    assert "ai_council.mode" in str(exc.value)


def test_higher_precedence_short_circuits_lower_validation():
    # Even with a malformed lower-priority layer, the higher one wins
    # without invoking validation against the malformed value.
    out = resolve_mode(
        "anthropic",
        invocation_mode="manual",
        member_settings={"mode": "bogus"},  # would raise if checked
        global_mode="bogus",
    )
    assert out == "manual"


# ── batch resolver ─────────────────────────────────────────────────────────


def test_resolve_modes_per_member():
    out = resolve_modes(
        ["anthropic", "openai"],
        members_settings={
            "anthropic": {"mode": "manual"},
            "openai": {},
        },
        global_mode="api",
    )
    assert out == {"anthropic": "manual", "openai": "api"}


def test_resolve_modes_invocation_wins_for_all():
    out = resolve_modes(
        ["anthropic", "openai"],
        invocation_mode="manual",
        members_settings={"anthropic": {"mode": "api"}, "openai": {"mode": "api"}},
        global_mode="api",
    )
    assert out == {"anthropic": "manual", "openai": "manual"}


def test_resolve_modes_empty_list():
    assert resolve_modes([]) == {}


def test_resolve_modes_unknown_member_uses_default_chain():
    out = resolve_modes(["mystery"], members_settings={}, global_mode="manual")
    assert out == {"mystery": "manual"}
