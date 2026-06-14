"""Tests for ``src/cli/python/workspace_explain.py``.

Covers ``docs/contracts/explain-modes.md`` renderer surface (Phase 6):
plain vs technical labels, confidence + freshness banding, glossary
override, relative-date formatting, and missing-field tolerance.
"""

from __future__ import annotations

import importlib.util
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = REPO_ROOT / "src" / "cli" / "python" / "workspace_explain.py"


def _load():
    spec = importlib.util.spec_from_file_location("workspace_explain", MODULE_PATH)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules["workspace_explain"] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture
def mod():
    return _load()


def _envelope(**overrides):
    base = {
        "id": "mem-123",
        "trust_score": 0.91,
        "decay": {"applied_factor": 0.85},
        "evidence": {"sources": ["docs/a.md", "docs/b.md"]},
        "contradictions": [],
        "last_reviewed_at": "2025-05-01T00:00:00Z",
    }
    base.update(overrides)
    return base


def test_plain_renders_high_confidence_band(mod):
    out = mod.render(_envelope(),
                     now=datetime(2025, 5, 5, tzinfo=timezone.utc))
    assert out["mode"] == "plain"
    assert "How confident" in out["markdown"]
    assert "Very High" in out["markdown"]
    assert "Fresh" in out["markdown"]
    assert "No open disagreements" in out["markdown"]
    assert out["ids"] == ["mem-123"]


def test_technical_renders_numeric_score(mod):
    out = mod.render(_envelope(trust_score=0.41), mode="technical")
    assert out["mode"] == "technical"
    assert "Trust score" in out["markdown"]
    assert "0.41" in out["markdown"]
    assert "decay=0.85" in out["markdown"]


def test_low_trust_band(mod):
    out = mod.render(_envelope(trust_score=0.10),
                     now=datetime(2025, 5, 5, tzinfo=timezone.utc))
    assert "Low" in out["markdown"]


def test_contradictions_count_shown(mod):
    out = mod.render(_envelope(contradictions=[{"id": "c1"}, {"id": "c2"}]),
                     now=datetime(2025, 5, 5, tzinfo=timezone.utc))
    assert "2 open" in out["markdown"]


def test_missing_envelope_fields_do_not_throw(mod):
    out = mod.render({}, now=datetime(2025, 5, 5, tzinfo=timezone.utc))
    assert out["mode"] == "plain"
    assert "0 source(s)" in out["markdown"]
    assert "Low" in out["markdown"]
    assert out["ids"] == []


def test_glossary_overrides_labels_and_bands(mod, tmp_path):
    gpath = tmp_path / "glossary.yml"
    gpath.write_text(
        "schema: explain-glossary/v0\n"
        "labels:\n"
        "  confidence: Sicherheit\n"
        "  sources: Woher das stammt\n"
        "  last_reviewed: Zuletzt geprüft\n"
        "  contradictions: Widerspruch\n"
        "bands:\n"
        "  confidence:\n"
        "    very_high: 0.95\n"
        "    high: 0.80\n"
        "    medium: 0.50\n"
        "  freshness:\n"
        "    fresh: 0.90\n"
        "    aging: 0.60\n",
        encoding="utf-8",
    )
    g = mod.load_glossary(gpath)
    assert g.labels["confidence"] == "Sicherheit"
    assert g.bands_confidence["very_high"] == 0.95
    out = mod.render(_envelope(trust_score=0.91), glossary=g,
                     now=datetime(2025, 5, 5, tzinfo=timezone.utc))
    assert "Sicherheit" in out["markdown"]
    # 0.91 < new very_high (0.95) so it falls to "High"
    assert "High" in out["markdown"]


def test_glossary_missing_file_returns_defaults(mod, tmp_path):
    g = mod.load_glossary(tmp_path / "missing.yml")
    assert g.labels["confidence"] == "How confident"


def test_human_relative_hours_days_months(mod):
    now = datetime(2025, 5, 5, 12, 0, 0, tzinfo=timezone.utc)
    assert "hour" in mod._human_relative("2025-05-05T08:00:00Z", now=now)
    assert "day" in mod._human_relative("2025-04-30T12:00:00Z", now=now)
    assert "month" in mod._human_relative("2025-02-01T12:00:00Z", now=now)


def test_human_relative_invalid_ts(mod):
    out = mod._human_relative("not-a-ts")
    assert out == "not-a-ts"
    assert mod._human_relative("") == "(unavailable)"


# --- host-decision explainability (road-to-6.0.0-final-readiness Phase 5) --


def _detect(**o):
    base = {"host": "claude-code", "known": True, "inventory_tier": 1,
            "cli": "claude", "cli_present": True, "effective_tier": 1,
            "mode": "driven"}
    base.update(o)
    return base


def test_host_plain_tier1_explains_why_host_and_tier(mod):
    md = mod.render_host_decision(_detect())["markdown"]
    assert "## Why this host" in md and "`claude-code` is your active host" in md
    assert "## Why this tier" in md and "Tier 1" in md
    # No fallback section when nothing fell back.
    assert "## Why a fallback fired" not in md
    assert "## Why continue" not in md


def test_host_plain_tier1_demotion_explains_fallback(mod):
    det = _detect(cli_present=False, effective_tier=3, mode="tier1-drive-pending")
    md = mod.render_host_decision(det)["markdown"]
    assert "Tier 3" in md
    assert "## Why a fallback fired" in md
    assert "isn't on your PATH" in md and "claude" in md


def test_host_plain_killswitch_explains_fallback(mod):
    md = mod.render_host_decision(
        _detect(), health={"killed": True, "consecutive_failures": 5},
    )["markdown"]
    assert "## Why a fallback fired" in md
    assert "kill-switch" in md and "5 consecutive failures" in md


def test_host_plain_continue_section(mod):
    md = mod.render_host_decision(
        _detect(), resume_session_id="sess-abc",
    )["markdown"]
    assert "## Why continue" in md and "sess-abc" in md


def test_host_unknown_host_treated_as_handoff(mod):
    det = _detect(host="mystery", known=False, inventory_tier=None,
                  cli=None, cli_present=False, effective_tier=3)
    md = mod.render_host_decision(det)["markdown"]
    assert "not in the known-host list" in md and "Tier 3" in md


def test_host_technical_mode_keeps_raw_fields(mod):
    out = mod.render_host_decision(_detect(), mode="technical")
    assert out["mode"] == "technical"
    assert "effective_tier=1" in out["markdown"]
