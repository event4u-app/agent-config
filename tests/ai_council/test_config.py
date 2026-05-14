"""Schema-validation contract for `agents/.ai-council.yml`.

Mirrors the seven validation rules in
`scripts/ai_council/config.py:_build_config` and the `_validate_api_key_ref`
key-form gate. Each test instantiates the loader against a YAML fragment
written to a tmp file — no project state read, no env mutated globally.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.ai_council.config import (  # noqa: E402
    CouncilConfigError,
    load_council_config,
    resolve_api_key,
)


def _write_yaml(tmp_path: Path, payload: dict) -> Path:
    p = tmp_path / "ai-council.yml"
    p.write_text(yaml.safe_dump(payload), encoding="utf-8")
    return p


_MINIMAL_VALID = {
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


# ── happy path ───────────────────────────────────────────────────────────────


def test_minimal_valid_round_trip(tmp_path: Path) -> None:
    cfg = load_council_config(_write_yaml(tmp_path, _MINIMAL_VALID))
    assert cfg.enabled is True
    assert cfg.defaults.mode == "api"
    assert cfg.defaults.min_rounds == 2
    assert cfg.defaults.deep_min_rounds == 3
    assert cfg.cost_budget.max_total_usd == pytest.approx(20.0)
    assert list(cfg.members) == ["anthropic"]
    assert cfg.members["anthropic"].api_key_ref == "env:ANTHROPIC_API_KEY"


def test_zero_disables_usd_ceiling_but_is_accepted(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["cost_budget"] = {"max_total_usd": 0, "max_calls": 0}
    cfg = load_council_config(_write_yaml(tmp_path, payload))
    assert cfg.cost_budget.max_total_usd == 0
    assert cfg.cost_budget.max_calls == 0


def test_per_member_mode_override_precedence(tmp_path: Path) -> None:
    payload = {
        "enabled": True,
        "defaults": {"mode": "api"},
        "members": {
            "anthropic": {
                "enabled": True,
                "model": "claude-sonnet-4-5",
                "api_key_ref": "env:ANTHROPIC_API_KEY",
                "mode": "manual",
            },
            "openai": {
                "enabled": True,
                "model": "gpt-4o",
                "api_key_ref": "env:OPENAI_API_KEY",
            },
        },
    }
    cfg = load_council_config(_write_yaml(tmp_path, payload))
    assert cfg.members["anthropic"].mode == "manual"
    assert cfg.members["openai"].mode is None


# ── negative: missing file ───────────────────────────────────────────────────


def test_missing_file_is_clear_error(tmp_path: Path) -> None:
    missing = tmp_path / "nope.yml"
    with pytest.raises(CouncilConfigError, match="not found"):
        load_council_config(missing)


# ── negative: top-level shape ────────────────────────────────────────────────


def test_top_level_list_is_rejected(tmp_path: Path) -> None:
    p = tmp_path / "bad.yml"
    p.write_text("- not a mapping\n", encoding="utf-8")
    with pytest.raises(CouncilConfigError, match="mapping"):
        load_council_config(p)


def test_enabled_must_be_bool(tmp_path: Path) -> None:
    payload = {**_MINIMAL_VALID, "enabled": "true"}
    with pytest.raises(CouncilConfigError, match="enabled.*bool"):
        load_council_config(_write_yaml(tmp_path, payload))


# ── negative: defaults / mode ────────────────────────────────────────────────


def test_unknown_default_mode_is_rejected(tmp_path: Path) -> None:
    payload = {**_MINIMAL_VALID, "defaults": {"mode": "telepathic"}}
    with pytest.raises(CouncilConfigError, match="defaults.mode"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_unknown_member_mode_is_rejected(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["members"] = {
        "anthropic": {
            "enabled": True,
            "model": "claude-sonnet-4-5",
            "api_key_ref": "env:ANTHROPIC_API_KEY",
            "mode": "telepathic",
        },
    }
    with pytest.raises(CouncilConfigError, match="members.anthropic.mode"):
        load_council_config(_write_yaml(tmp_path, payload))


# ── negative: members ────────────────────────────────────────────────────────


def test_unknown_provider_is_rejected(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["members"] = {
        "deepmind": {"enabled": True, "model": "x", "api_key_ref": "env:X"},
    }
    with pytest.raises(CouncilConfigError, match="unknown provider"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_enabled_member_without_model_fails(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["members"] = {
        "anthropic": {"enabled": True, "api_key_ref": "env:ANTHROPIC_API_KEY"},
    }
    with pytest.raises(CouncilConfigError, match="non-empty `model`"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_enabled_member_without_api_key_ref_fails(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["members"] = {
        "anthropic": {"enabled": True, "model": "claude-sonnet-4-5"},
    }
    with pytest.raises(CouncilConfigError, match="api_key_ref"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_disabled_member_allows_omitted_key_and_model(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["members"] = {
        "anthropic": {
            "enabled": True,
            "model": "claude-sonnet-4-5",
            "api_key_ref": "env:ANTHROPIC_API_KEY",
        },
        "gemini": {"enabled": False},
    }
    cfg = load_council_config(_write_yaml(tmp_path, payload))
    assert cfg.members["gemini"].enabled is False
    assert cfg.members["gemini"].api_key_ref is None


# ── negative: api_key_ref forms ──────────────────────────────────────────────


def test_api_key_ref_must_use_known_prefix(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["members"] = {
        "anthropic": {
            "enabled": True,
            "model": "claude-sonnet-4-5",
            "api_key_ref": "/abs/path/to/key",
        },
    }
    with pytest.raises(CouncilConfigError, match="must start with"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_api_key_ref_empty_file_body_rejected(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["members"] = {
        "anthropic": {
            "enabled": True,
            "model": "claude-sonnet-4-5",
            "api_key_ref": "file:",
        },
    }
    with pytest.raises(CouncilConfigError, match="missing path"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_api_key_ref_empty_env_body_rejected(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["members"] = {
        "anthropic": {
            "enabled": True,
            "model": "claude-sonnet-4-5",
            "api_key_ref": "env:",
        },
    }
    with pytest.raises(CouncilConfigError, match="missing variable name"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_api_key_ref_raw_key_shape_rejected(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["members"] = {
        "anthropic": {
            "enabled": True,
            "model": "claude-sonnet-4-5",
            "api_key_ref": "sk-ant-totally-not-a-real-key",
        },
    }
    with pytest.raises(CouncilConfigError, match="raw API key"):
        load_council_config(_write_yaml(tmp_path, payload))


# ── negative: cost_budget ────────────────────────────────────────────────────


def test_negative_cost_budget_rejected(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["cost_budget"] = {"max_total_usd": -1.0}
    with pytest.raises(CouncilConfigError, match="must be >= 0"):
        load_council_config(_write_yaml(tmp_path, payload))


# ── resolve_api_key — env + file ─────────────────────────────────────────────


def test_resolve_api_key_env_happy(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AGENT_CONFIG_TEST_KEY", "topsecret")
    assert resolve_api_key("env:AGENT_CONFIG_TEST_KEY") == "topsecret"


def test_resolve_api_key_env_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("AGENT_CONFIG_TEST_MISSING", raising=False)
    with pytest.raises(CouncilConfigError, match="unset or empty"):
        resolve_api_key("env:AGENT_CONFIG_TEST_MISSING")


def test_resolve_api_key_file_bad_permissions(tmp_path: Path) -> None:
    keyfile = tmp_path / "k.key"
    keyfile.write_text("secret", encoding="utf-8")
    keyfile.chmod(0o644)
    with pytest.raises(CouncilConfigError, match="unsafe permissions"):
        resolve_api_key(f"file:{keyfile}")


def test_resolve_api_key_file_happy(tmp_path: Path) -> None:
    keyfile = tmp_path / "k.key"
    keyfile.write_text("topsecret\n", encoding="utf-8")
    keyfile.chmod(0o600)
    assert resolve_api_key(f"file:{keyfile}") == "topsecret"


def test_resolve_api_key_file_empty_rejected(tmp_path: Path) -> None:
    keyfile = tmp_path / "k.key"
    keyfile.write_text("", encoding="utf-8")
    keyfile.chmod(0o600)
    with pytest.raises(CouncilConfigError, match="is empty"):
        resolve_api_key(f"file:{keyfile}")
