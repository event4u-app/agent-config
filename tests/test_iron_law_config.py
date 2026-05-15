"""Iron-Law sentinel for the AI Council config loader (step-9 P11 · U3).

These tests are intentionally redundant with `tests/ai_council/test_config.py`
— they exist so the Iron Law (``high_impact`` / ``user_required`` dispatch
NEVER configurable) is enforced at a top-level, easy-to-find path that
reviewers and `task ci` cannot accidentally skip. Per roadmap D12:

    "If this test doesn't exist, the Iron Law is a hope, not a guarantee."

Every case below must raise ``CouncilConfigError`` at config-load time.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.ai_council.config import (  # noqa: E402
    CouncilConfigError,
    load_council_config,
)


_MINIMAL_VALID: dict = {
    "enabled": True,
    "defaults": {"mode": "api"},
    "cost_budget": {},
    "members": {
        "anthropic": {
            "enabled": True,
            "model": "claude-sonnet-4-5",
            "api_key_ref": "env:ANTHROPIC_API_KEY",
        },
    },
}


def _write(tmp_path: Path, payload: dict) -> Path:
    p = tmp_path / "ai-council.yml"
    p.write_text(yaml.safe_dump(payload), encoding="utf-8")
    return p


def _write_raw(tmp_path: Path, text: str) -> Path:
    p = tmp_path / "ai-council.yml"
    p.write_text(text, encoding="utf-8")
    return p


# ── 1. high_impact.dispatch: single (top-level shape) ──────────────────


def test_iron_law_top_level_high_impact_dispatch_rejected(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["high_impact"] = {"dispatch": "single"}
    with pytest.raises(CouncilConfigError, match="not configurable"):
        load_council_config(_write(tmp_path, payload))


# ── 2. user_required.dispatch: single (top-level shape) ────────────────


def test_iron_law_top_level_user_required_dispatch_rejected(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["user_required"] = {"dispatch": "single"}
    with pytest.raises(CouncilConfigError, match="not configurable"):
        load_council_config(_write(tmp_path, payload))


# ── 3. decision_resolution.classes.high_impact.dispatch (nested) ───────


def test_iron_law_nested_high_impact_dispatch_rejected(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["decision_resolution"] = {
        "classes": {"high_impact": {"dispatch": "single"}},
    }
    with pytest.raises(CouncilConfigError, match="not configurable"):
        load_council_config(_write(tmp_path, payload))


def test_iron_law_nested_user_required_dispatch_rejected(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["decision_resolution"] = {
        "classes": {"user_required": {"dispatch": "full"}},
    }
    with pytest.raises(CouncilConfigError, match="not configurable"):
        load_council_config(_write(tmp_path, payload))


# ── 4. Smuggled-in dispatch via YAML <<: anchor merge ──────────────────


def test_iron_law_yaml_anchor_merge_smuggle_rejected(tmp_path: Path) -> None:
    """Author tries to hide ``dispatch: single`` behind an anchor merge.

    PyYAML resolves the ``<<:`` merge before our validator runs, so the
    smuggled key surfaces as a plain ``dispatch`` field on the
    ``high_impact`` mapping — which the validator still rejects.
    """
    raw = """\
enabled: true
defaults:
  mode: api
cost_budget: {}
members:
  anthropic:
    enabled: true
    model: claude-sonnet-4-5
    api_key_ref: env:ANTHROPIC_API_KEY

_dispatch_anchor: &smuggle
  dispatch: single

decision_resolution:
  classes:
    high_impact:
      <<: *smuggle
"""
    with pytest.raises(CouncilConfigError, match="not configurable"):
        load_council_config(_write_raw(tmp_path, raw))


def test_iron_law_yaml_anchor_merge_user_required_smuggle_rejected(
    tmp_path: Path,
) -> None:
    raw = """\
enabled: true
defaults:
  mode: api
cost_budget: {}
members:
  anthropic:
    enabled: true
    model: claude-sonnet-4-5
    api_key_ref: env:ANTHROPIC_API_KEY

_dispatch_anchor: &smuggle
  dispatch: single

user_required:
  <<: *smuggle
"""
    with pytest.raises(CouncilConfigError, match="not configurable"):
        load_council_config(_write_raw(tmp_path, raw))
