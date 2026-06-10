"""Goldens for the `profile-overlay` explain renderer (Phase 2,
road-to-session-profile-observability).

render_profile_overlay is a PURE template over the envelope — never an LLM, never
reads beyond the envelope. These pin plain + technical renders and prove the
renderer never throws on a partial/missing-field envelope.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
from scripts.config import profile_explain as pe  # noqa: E402


def test_envelope_shape():
    env = pe.build_profile_envelope(["engineering-base"], 40, 60, 167)
    assert env["envelope_type"] == "profile-overlay"
    assert env["active"] == ["engineering-base"]
    assert env["delta"]["hidden_behind_inactive_packs"] == 167
    assert env["persists_across_sessions"] is True
    # no seed/closure split and no staleness-age — not persisted, must be absent
    assert "staleness_days" not in env
    assert "seed_tokens" not in env


def test_no_overlay_plain():
    out = pe.render_profile_overlay(pe.build_profile_envelope([], 150, 227, 0))
    assert "Nothing is filtered" in out
    assert "no profile is active" in out


def test_single_overlay_plain():
    out = pe.render_profile_overlay(pe.build_profile_envelope(["engineering-base"], 40, 60, 167))
    assert "a profile is active (engineering-base)" in out
    assert "40 commands and 60 skills" in out
    assert "hides 167" in out
    assert "/profile deactivate" in out
    assert "days" not in out  # staleness is persistence, not an age


def test_multi_overlay_joins_names():
    out = pe.render_profile_overlay(
        pe.build_profile_envelope(["finance-basic", "finance-advanced"], 12, 20, 300))
    assert "(finance-basic, finance-advanced)" in out


def test_technical_mode():
    out = pe.render_profile_overlay(
        pe.build_profile_envelope(["ops-people"], 30, 50, 100), mode="technical")
    assert out.startswith("profile-overlay: active=[ops-people]")
    assert "surfaced: commands=30 skills=50" in out
    assert "hidden:   100" in out


def test_partial_envelope_never_throws():
    # missing-field placeholder — renderer must not raise
    for env in ({}, {"active": ["x"]}, {"active": [], "commands_shown": None}):
        out = pe.render_profile_overlay(env)
        assert isinstance(out, str) and out


def test_render_is_deterministic():
    a = pe.render_profile_overlay(pe.build_profile_envelope(["x"], 1, 2, 3))
    b = pe.render_profile_overlay(pe.build_profile_envelope(["x"], 1, 2, 3))
    assert a == b
