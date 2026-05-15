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


# ── Phase 8 backfill: malformed YAML + section-shape sweep ───────────────────


def test_malformed_yaml_is_wrapped(tmp_path: Path) -> None:
    """Unparseable YAML surfaces as `CouncilConfigError`, never raw YAMLError."""
    p = tmp_path / "bad.yml"
    p.write_text("enabled: true\n  bad: :\n", encoding="utf-8")
    with pytest.raises(CouncilConfigError, match="invalid YAML"):
        load_council_config(p)


def test_members_list_is_rejected(tmp_path: Path) -> None:
    p = tmp_path / "bad.yml"
    p.write_text("enabled: true\nmembers:\n  - anthropic\n", encoding="utf-8")
    with pytest.raises(CouncilConfigError, match=r"`members` must be a mapping"):
        load_council_config(p)


@pytest.mark.parametrize(
    "section",
    ["defaults", "cost_budget", "advisors", "consensus_scoring"],
)
def test_section_must_be_mapping(tmp_path: Path, section: str) -> None:
    """Every top-level config section must be a mapping when present."""
    payload = dict(_MINIMAL_VALID)
    payload[section] = ["not", "a", "mapping"]
    with pytest.raises(CouncilConfigError, match=f"`{section}` must be a mapping"):
        load_council_config(_write_yaml(tmp_path, payload))


# ── Phase 8 backfill: advisor cross-validation ───────────────────────────────


def _members_with_anthropic_only() -> dict:
    return {
        "anthropic": {
            "enabled": True,
            "model": "claude-sonnet-4-5",
            "api_key_ref": "env:ANTHROPIC_API_KEY",
        },
    }


def test_advisor_referencing_unknown_member_is_rejected(tmp_path: Path) -> None:
    payload = {
        "enabled": True,
        "defaults": {"mode": "api"},
        "members": _members_with_anthropic_only(),
        "advisors": {
            "contrarian": {
                "enabled": True,
                "member": "openai",
                "persona": "personas/advisors/contrarian.md",
            },
        },
    }
    with pytest.raises(CouncilConfigError, match="no such member"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_advisor_referencing_disabled_member_is_rejected(tmp_path: Path) -> None:
    payload = {
        "enabled": True,
        "defaults": {"mode": "api"},
        "members": {
            "anthropic": {
                "enabled": True,
                "model": "claude-sonnet-4-5",
                "api_key_ref": "env:ANTHROPIC_API_KEY",
            },
            "openai": {"enabled": False},
        },
        "advisors": {
            "contrarian": {
                "enabled": True,
                "member": "openai",
                "persona": "personas/advisors/contrarian.md",
            },
        },
    }
    with pytest.raises(CouncilConfigError, match="exists but is disabled"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_advisor_with_unknown_provider_is_rejected(tmp_path: Path) -> None:
    payload = {
        "enabled": True,
        "defaults": {"mode": "api"},
        "members": _members_with_anthropic_only(),
        "advisors": {
            "contrarian": {
                "enabled": True,
                "member": "deepmind",
                "persona": "personas/advisors/contrarian.md",
            },
        },
    }
    with pytest.raises(CouncilConfigError, match="not a valid provider"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_advisor_model_must_be_string(tmp_path: Path) -> None:
    payload = {
        "enabled": True,
        "defaults": {"mode": "api"},
        "members": _members_with_anthropic_only(),
        "advisors": {
            "contrarian": {
                "enabled": True,
                "member": "anthropic",
                "persona": "personas/advisors/contrarian.md",
                "model": 42,
            },
        },
    }
    with pytest.raises(CouncilConfigError, match="model must be a string"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_disabled_advisor_skips_cross_validation(tmp_path: Path) -> None:
    """A disabled advisor pointing at a missing member must NOT fail."""
    payload = {
        "enabled": True,
        "defaults": {"mode": "api"},
        "members": _members_with_anthropic_only(),
        "advisors": {
            "contrarian": {
                "enabled": False,
                "member": "openai",
                "persona": "personas/advisors/contrarian.md",
            },
        },
    }
    cfg = load_council_config(_write_yaml(tmp_path, payload))
    assert cfg.advisors["contrarian"].enabled is False


# ── Phase 8 backfill: consensus_scoring thresholds + lenses ──────────────────


def test_consensus_scoring_inverted_thresholds_rejected(tmp_path: Path) -> None:
    """minority > strong violates the 0 <= minority <= strong <= 1 invariant."""
    payload = dict(_MINIMAL_VALID)
    payload["consensus_scoring"] = {
        "enabled": True,
        "strong_threshold": 0.3,
        "minority_threshold": 0.7,
    }
    with pytest.raises(CouncilConfigError, match="thresholds broken"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_consensus_scoring_threshold_out_of_unit_range_rejected(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["consensus_scoring"] = {"strong_threshold": 1.5}
    with pytest.raises(CouncilConfigError, match="thresholds broken"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_consensus_scoring_lenses_must_be_list_of_strings(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["consensus_scoring"] = {"lenses": [1, 2, 3]}
    with pytest.raises(CouncilConfigError, match="must be a list of strings"):
        load_council_config(_write_yaml(tmp_path, payload))


# ── Phase 8 backfill: every raw-key prefix is refused ────────────────────────


@pytest.mark.parametrize(
    "raw_key",
    [
        "sk-totallynotrealkey",
        "sk-ant-totallynotrealkey",
        "ya29.totallynotrealkey",
        "AIzaTotallyNotRealKey",
        "xai-totallynotrealkey",
        "pplx-totallynotrealkey",
        "gsk_totallynotrealkey",
    ],
)
def test_raw_key_prefixes_are_all_rejected(tmp_path: Path, raw_key: str) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["members"] = {
        "anthropic": {
            "enabled": True,
            "model": "claude-sonnet-4-5",
            "api_key_ref": raw_key,
        },
    }
    with pytest.raises(CouncilConfigError, match="raw API key"):
        load_council_config(_write_yaml(tmp_path, payload))


# ── Phase 0 (CLI transport): mode: cli + binary: + cli_call_budget ───────────


def test_cli_mode_accepted_without_api_key_ref(tmp_path: Path) -> None:
    """`mode: cli` is the third transport — keys are CLI-managed, not required."""
    payload = {
        "enabled": True,
        "defaults": {"mode": "api"},
        "members": {
            "anthropic": {
                "enabled": True,
                "model": "claude-sonnet-4-5",
                "mode": "cli",
            },
        },
    }
    cfg = load_council_config(_write_yaml(tmp_path, payload))
    assert cfg.members["anthropic"].mode == "cli"
    assert cfg.members["anthropic"].api_key_ref is None


def test_cli_mode_via_defaults_accepted(tmp_path: Path) -> None:
    payload = {
        "enabled": True,
        "defaults": {"mode": "cli"},
        "members": {
            "anthropic": {"enabled": True, "model": "claude-sonnet-4-5"},
        },
    }
    cfg = load_council_config(_write_yaml(tmp_path, payload))
    assert cfg.defaults.mode == "cli"
    assert cfg.members["anthropic"].api_key_ref is None


def test_binary_field_accepted_when_member_is_cli(tmp_path: Path) -> None:
    payload = {
        "enabled": True,
        "defaults": {"mode": "api"},
        "members": {
            "anthropic": {
                "enabled": True,
                "model": "claude-sonnet-4-5",
                "mode": "cli",
                "binary": "/usr/local/bin/claude",
            },
        },
    }
    cfg = load_council_config(_write_yaml(tmp_path, payload))
    assert cfg.members["anthropic"].binary == "/usr/local/bin/claude"


def test_binary_field_rejected_when_effective_mode_is_api(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["members"] = {
        "anthropic": {
            "enabled": True,
            "model": "claude-sonnet-4-5",
            "api_key_ref": "env:ANTHROPIC_API_KEY",
            "binary": "/usr/local/bin/claude",
        },
    }
    with pytest.raises(CouncilConfigError, match="binary.*only valid"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_binary_field_rejected_when_effective_mode_is_manual(tmp_path: Path) -> None:
    payload = {
        "enabled": True,
        "defaults": {"mode": "manual"},
        "members": {
            "anthropic": {
                "enabled": True,
                "model": "claude-sonnet-4-5",
                "binary": "/usr/local/bin/claude",
            },
        },
    }
    with pytest.raises(CouncilConfigError, match="binary.*only valid"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_binary_field_must_be_non_empty_string(tmp_path: Path) -> None:
    payload = {
        "enabled": True,
        "defaults": {"mode": "cli"},
        "members": {
            "anthropic": {
                "enabled": True,
                "model": "claude-sonnet-4-5",
                "binary": "",
            },
        },
    }
    with pytest.raises(CouncilConfigError, match="binary must be a non-empty"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_cli_call_budget_optional_block_defaults_empty(tmp_path: Path) -> None:
    cfg = load_council_config(_write_yaml(tmp_path, _MINIMAL_VALID))
    assert cfg.cli_call_budget.max_calls_per_day == {}


def test_cli_call_budget_per_provider_cap_accepted(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["cli_call_budget"] = {
        "max_calls_per_day": {"anthropic": 50, "openai": 100},
    }
    cfg = load_council_config(_write_yaml(tmp_path, payload))
    assert cfg.cli_call_budget.max_calls_per_day == {"anthropic": 50, "openai": 100}


def test_cli_call_budget_unknown_provider_rejected(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["cli_call_budget"] = {"max_calls_per_day": {"deepmind": 5}}
    with pytest.raises(CouncilConfigError, match="unknown.*provider"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_cli_call_budget_negative_cap_rejected(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["cli_call_budget"] = {"max_calls_per_day": {"anthropic": -1}}
    with pytest.raises(CouncilConfigError, match="non-negative integer"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_cli_call_budget_must_be_mapping(tmp_path: Path) -> None:
    p = tmp_path / "bad.yml"
    p.write_text(
        "enabled: true\ndefaults: {mode: api}\nmembers:\n  anthropic:\n"
        "    enabled: true\n    model: claude-sonnet-4-5\n"
        "    api_key_ref: env:ANTHROPIC_API_KEY\n"
        "cli_call_budget:\n  - foo\n",
        encoding="utf-8",
    )
    with pytest.raises(CouncilConfigError, match="cli_call_budget.*mapping"):
        load_council_config(p)



# ── necessity classifier (Phase 6) ───────────────────────────────────────────


def test_necessity_classifier_defaults_when_omitted(tmp_path: Path) -> None:
    cfg = load_council_config(_write_yaml(tmp_path, _MINIMAL_VALID))
    assert cfg.necessity_classifier.enabled is True
    assert cfg.necessity_classifier.mode == "educate"
    assert cfg.necessity_classifier.user_explicit_mode == "warn-only"
    assert cfg.lens_overrides.necessity_classifier_mode == {}
    assert cfg.lens_overrides.necessity_classifier_user_explicit_mode == {}


def test_necessity_classifier_disabled_via_enabled_flag(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["necessity_classifier"] = {"enabled": False, "mode": "block"}
    cfg = load_council_config(_write_yaml(tmp_path, payload))
    assert cfg.necessity_classifier.enabled is False
    assert cfg.necessity_classifier.mode == "block"


def test_necessity_classifier_invalid_mode_rejected(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["necessity_classifier"] = {"mode": "shrug"}
    with pytest.raises(CouncilConfigError, match="necessity_classifier.mode"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_necessity_classifier_user_explicit_mode_accepts_warn_only(
    tmp_path: Path,
) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["necessity_classifier"] = {
        "mode": "block", "user_explicit_mode": "educate",
    }
    cfg = load_council_config(_write_yaml(tmp_path, payload))
    assert cfg.necessity_classifier.mode == "block"
    assert cfg.necessity_classifier.user_explicit_mode == "educate"


def test_necessity_classifier_invalid_user_explicit_mode_rejected(
    tmp_path: Path,
) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["necessity_classifier"] = {"user_explicit_mode": "shrug"}
    with pytest.raises(
        CouncilConfigError, match="user_explicit_mode",
    ):
        load_council_config(_write_yaml(tmp_path, payload))


def test_lens_overrides_per_lens_mode(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["lenses"] = {
        "debate": {"necessity_classifier": {"mode": "block"}},
        "analysis": {"necessity_classifier": {"mode": "off"}},
    }
    cfg = load_council_config(_write_yaml(tmp_path, payload))
    assert cfg.lens_overrides.necessity_classifier_mode == {
        "debate": "block",
        "analysis": "off",
    }


def test_lens_overrides_per_lens_user_explicit_mode(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["lenses"] = {
        "debate": {"necessity_classifier": {"user_explicit_mode": "block"}},
        "analysis": {
            "necessity_classifier": {"user_explicit_mode": "educate"},
        },
    }
    cfg = load_council_config(_write_yaml(tmp_path, payload))
    assert cfg.lens_overrides.necessity_classifier_user_explicit_mode == {
        "debate": "block",
        "analysis": "educate",
    }


def test_lens_overrides_invalid_mode_rejected(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["lenses"] = {
        "debate": {"necessity_classifier": {"mode": "shrug"}},
    }
    with pytest.raises(CouncilConfigError, match="lenses.debate"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_lens_overrides_invalid_user_explicit_mode_rejected(
    tmp_path: Path,
) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["lenses"] = {
        "debate": {"necessity_classifier": {"user_explicit_mode": "shrug"}},
    }
    with pytest.raises(CouncilConfigError, match="user_explicit_mode"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_lens_overrides_must_be_mapping(tmp_path: Path) -> None:
    p = tmp_path / "bad.yml"
    p.write_text(
        "enabled: true\ndefaults: {mode: api}\nmembers:\n  anthropic:\n"
        "    enabled: true\n    model: claude-sonnet-4-5\n"
        "    api_key_ref: env:ANTHROPIC_API_KEY\n"
        "lenses:\n  - foo\n",
        encoding="utf-8",
    )
    with pytest.raises(CouncilConfigError, match="lenses.*mapping"):
        load_council_config(p)


# ── Phase 8: debate cost-visibility + refusal cap ─────────────────────────────


def test_debate_defaults_when_block_omitted(tmp_path: Path) -> None:
    cfg = load_council_config(_write_yaml(tmp_path, dict(_MINIMAL_VALID)))
    assert cfg.debate.max_cost_usd == 5.00
    assert cfg.debate.cost_disclosure.mode == "always"
    assert cfg.debate.cost_disclosure.threshold_usd == 1.00
    assert cfg.debate.cost_disclosure.show_per_member is True


def test_debate_block_parsed_from_yaml(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["debate"] = {
        "max_cost_usd": 2.50,
        "cost_disclosure": {
            "mode": "above_threshold",
            "threshold_usd": 0.25,
            "show_per_member": False,
        },
    }
    cfg = load_council_config(_write_yaml(tmp_path, payload))
    assert cfg.debate.max_cost_usd == 2.50
    assert cfg.debate.cost_disclosure.mode == "above_threshold"
    assert cfg.debate.cost_disclosure.threshold_usd == 0.25
    assert cfg.debate.cost_disclosure.show_per_member is False


def test_debate_max_cost_usd_zero_disables_cap(tmp_path: Path) -> None:
    """``max_cost_usd: 0`` parses fine and signals 'disabled' downstream."""
    payload = dict(_MINIMAL_VALID)
    payload["debate"] = {"max_cost_usd": 0}
    cfg = load_council_config(_write_yaml(tmp_path, payload))
    assert cfg.debate.max_cost_usd == 0


def test_debate_max_cost_usd_negative_rejected(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["debate"] = {"max_cost_usd": -1.0}
    with pytest.raises(CouncilConfigError, match="max_cost_usd"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_debate_cost_disclosure_invalid_mode_rejected(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["debate"] = {"cost_disclosure": {"mode": "sometimes"}}
    with pytest.raises(CouncilConfigError, match="debate.cost_disclosure.mode"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_debate_cost_disclosure_threshold_negative_rejected(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["debate"] = {
        "cost_disclosure": {"mode": "above_threshold", "threshold_usd": -0.10},
    }
    with pytest.raises(CouncilConfigError, match="threshold_usd"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_lens_overrides_cost_disclosure(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["lenses"] = {
        "analysis": {
            "cost_disclosure": {
                "mode": "above_threshold",
                "threshold_usd": 0.50,
                "show_per_member": False,
            },
        },
    }
    cfg = load_council_config(_write_yaml(tmp_path, payload))
    cd = cfg.lens_overrides.cost_disclosure["analysis"]
    assert cd.mode == "above_threshold"
    assert cd.threshold_usd == 0.50
    assert cd.show_per_member is False


def test_lens_overrides_cost_disclosure_invalid_mode_rejected(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["lenses"] = {
        "default": {"cost_disclosure": {"mode": "maybe"}},
    }
    with pytest.raises(CouncilConfigError, match="lenses.default.cost_disclosure"):
        load_council_config(_write_yaml(tmp_path, payload))


# --- Phase 10: decision_resolution schema -------------------------------


def _with_resolution(payload: dict, block: dict) -> dict:
    cp = {k: v for k, v in payload.items()}
    cp["decision_resolution"] = block
    return cp


def test_decision_resolution_defaults_present_without_block(
    tmp_path: Path,
) -> None:
    cfg = load_council_config(_write_yaml(tmp_path, _MINIMAL_VALID))
    assert cfg.decision_resolution.enabled is True
    # All five classes get seeded with defaults.
    for cls in (
        "trivial", "low_impact", "medium_impact",
        "high_impact", "user_required",
    ):
        assert cls in cfg.decision_resolution.classes
    assert cfg.decision_resolution.classes["high_impact"].mode == "user"
    assert cfg.decision_resolution.classes["user_required"].mode == "user"


def test_decision_resolution_user_can_remap_low_impact_to_council(
    tmp_path: Path,
) -> None:
    block = {
        "enabled": True,
        "classes": {"low_impact": {"mode": "council"}},
    }
    cfg = load_council_config(
        _write_yaml(tmp_path, _with_resolution(_MINIMAL_VALID, block)),
    )
    assert cfg.decision_resolution.classes["low_impact"].mode == "council"


def test_decision_resolution_high_impact_locked_to_user(
    tmp_path: Path,
) -> None:
    block = {"classes": {"high_impact": {"mode": "agent"}}}
    with pytest.raises(CouncilConfigError) as exc:
        load_council_config(
            _write_yaml(tmp_path, _with_resolution(_MINIMAL_VALID, block)),
        )
    assert "high_impact" in str(exc.value)
    assert "LOCKED" in str(exc.value) or "Iron Law" in str(exc.value)


def test_decision_resolution_user_required_locked_to_user(
    tmp_path: Path,
) -> None:
    block = {"classes": {"user_required": {"mode": "council"}}}
    with pytest.raises(CouncilConfigError) as exc:
        load_council_config(
            _write_yaml(tmp_path, _with_resolution(_MINIMAL_VALID, block)),
        )
    assert "user_required" in str(exc.value)


def test_decision_resolution_invalid_mode_rejected(tmp_path: Path) -> None:
    block = {"classes": {"trivial": {"mode": "bogus"}}}
    with pytest.raises(CouncilConfigError):
        load_council_config(
            _write_yaml(tmp_path, _with_resolution(_MINIMAL_VALID, block)),
        )


def test_decision_resolution_threshold_out_of_range(tmp_path: Path) -> None:
    block = {"classes": {"low_impact": {"confidence_threshold": 1.5}}}
    with pytest.raises(CouncilConfigError):
        load_council_config(
            _write_yaml(tmp_path, _with_resolution(_MINIMAL_VALID, block)),
        )


def test_decision_resolution_enabled_must_be_bool(tmp_path: Path) -> None:
    block = {"enabled": "yes"}
    with pytest.raises(CouncilConfigError):
        load_council_config(
            _write_yaml(tmp_path, _with_resolution(_MINIMAL_VALID, block)),
        )


# --- Phase 11: fast_path + participate_low_impact ----------------------


def test_fast_path_defaults_present(tmp_path: Path) -> None:
    cfg = load_council_config(_write_yaml(tmp_path, _MINIMAL_VALID))
    fp = cfg.decision_resolution.fast_path
    assert fp.max_members == 2
    assert fp.max_rounds == 1
    assert fp.max_tokens == 2500
    assert fp.max_cost_usd == 0.05


def test_fast_path_user_can_tune_caps(tmp_path: Path) -> None:
    block = {
        "fast_path": {
            "max_members": 1, "max_tokens": 1500, "max_cost_usd": 0.10,
        },
    }
    cfg = load_council_config(
        _write_yaml(tmp_path, _with_resolution(_MINIMAL_VALID, block)),
    )
    fp = cfg.decision_resolution.fast_path
    assert fp.max_members == 1
    assert fp.max_tokens == 1500
    assert fp.max_cost_usd == 0.10


def test_fast_path_max_rounds_locked_to_one(tmp_path: Path) -> None:
    block = {"fast_path": {"max_rounds": 2}}
    with pytest.raises(CouncilConfigError, match="LOCKED"):
        load_council_config(
            _write_yaml(tmp_path, _with_resolution(_MINIMAL_VALID, block)),
        )


def test_fast_path_max_members_out_of_range_rejected(tmp_path: Path) -> None:
    block = {"fast_path": {"max_members": 5}}
    with pytest.raises(CouncilConfigError, match="max_members"):
        load_council_config(
            _write_yaml(tmp_path, _with_resolution(_MINIMAL_VALID, block)),
        )


def test_fast_path_negative_cost_rejected(tmp_path: Path) -> None:
    block = {"fast_path": {"max_cost_usd": 0}}
    with pytest.raises(CouncilConfigError, match="max_cost_usd"):
        load_council_config(
            _write_yaml(tmp_path, _with_resolution(_MINIMAL_VALID, block)),
        )


def test_participate_low_impact_defaults_false(tmp_path: Path) -> None:
    cfg = load_council_config(_write_yaml(tmp_path, _MINIMAL_VALID))
    for m in cfg.members.values():
        assert m.participate_low_impact is False


def test_participate_low_impact_must_be_bool(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["members"] = dict(payload["members"])
    first = next(iter(payload["members"]))
    payload["members"][first] = dict(payload["members"][first])
    payload["members"][first]["participate_low_impact"] = "yes"
    with pytest.raises(CouncilConfigError, match="participate_low_impact"):
        load_council_config(_write_yaml(tmp_path, payload))



# ── step-9 P8: defaults.member_mode ──────────────────────────────────────────


def test_defaults_member_mode_defaults_to_cli(tmp_path: Path) -> None:
    cfg = load_council_config(_write_yaml(tmp_path, _MINIMAL_VALID))
    assert cfg.defaults.member_mode == "cli"


def test_defaults_member_mode_api_round_trip(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["defaults"] = {"mode": "api", "member_mode": "api"}
    cfg = load_council_config(_write_yaml(tmp_path, payload))
    assert cfg.defaults.member_mode == "api"


def test_defaults_member_mode_manual_rejected(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["defaults"] = {"mode": "api", "member_mode": "manual"}
    with pytest.raises(CouncilConfigError, match="defaults.member_mode"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_defaults_member_mode_unknown_rejected(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["defaults"] = {"mode": "api", "member_mode": "telepathic"}
    with pytest.raises(CouncilConfigError, match="defaults.member_mode"):
        load_council_config(_write_yaml(tmp_path, payload))


# ── step-9 P8: routing.solo_member_fallback_chain ───────────────────────────


def test_routing_defaults_to_empty_chain(tmp_path: Path) -> None:
    cfg = load_council_config(_write_yaml(tmp_path, _MINIMAL_VALID))
    assert cfg.routing.solo_member_fallback_chain == ()
    assert cfg.routing.auth_check_timeout_seconds == 3


def test_routing_chain_round_trip(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["routing"] = {"solo_member_fallback_chain": ["anthropic"]}
    cfg = load_council_config(_write_yaml(tmp_path, payload))
    assert cfg.routing.solo_member_fallback_chain == ("anthropic",)


def test_routing_chain_must_be_list(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["routing"] = {"solo_member_fallback_chain": "anthropic"}
    with pytest.raises(CouncilConfigError, match="must be a list"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_routing_chain_rejects_duplicates(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["routing"] = {
        "solo_member_fallback_chain": ["anthropic", "anthropic"],
    }
    with pytest.raises(CouncilConfigError, match="duplicate entry"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_routing_chain_rejects_unknown_member(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["routing"] = {"solo_member_fallback_chain": ["openai"]}
    with pytest.raises(CouncilConfigError, match="no such member"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_routing_chain_rejects_empty_string(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["routing"] = {"solo_member_fallback_chain": [""]}
    with pytest.raises(CouncilConfigError, match="non-empty string"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_routing_auth_timeout_out_of_range(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["routing"] = {"auth_check_timeout_seconds": 0}
    with pytest.raises(CouncilConfigError, match="auth_check_timeout_seconds"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_routing_auth_timeout_too_high(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["routing"] = {"auth_check_timeout_seconds": 31}
    with pytest.raises(CouncilConfigError, match="auth_check_timeout_seconds"):
        load_council_config(_write_yaml(tmp_path, payload))


# ── step-9 P8: low_impact.dispatch ──────────────────────────────────────────


def test_low_impact_defaults_to_full(tmp_path: Path) -> None:
    cfg = load_council_config(_write_yaml(tmp_path, _MINIMAL_VALID))
    assert cfg.low_impact.dispatch == "full"
    assert cfg.low_impact.shadow_sample_rate == pytest.approx(0.1)


def test_low_impact_dispatch_single_requires_chain(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["low_impact"] = {"dispatch": "single"}
    with pytest.raises(CouncilConfigError, match="solo_member_fallback_chain"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_low_impact_dispatch_single_with_chain(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["routing"] = {"solo_member_fallback_chain": ["anthropic"]}
    payload["low_impact"] = {"dispatch": "single"}
    cfg = load_council_config(_write_yaml(tmp_path, payload))
    assert cfg.low_impact.dispatch == "single"


def test_low_impact_dispatch_unknown_rejected(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["low_impact"] = {"dispatch": "telepathic"}
    with pytest.raises(CouncilConfigError, match="low_impact.dispatch"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_low_impact_shadow_rate_out_of_range(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["low_impact"] = {"shadow_sample_rate": 1.5}
    with pytest.raises(CouncilConfigError, match="shadow_sample_rate"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_low_impact_shadow_rate_wrong_type(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["low_impact"] = {"shadow_sample_rate": "half"}
    with pytest.raises(CouncilConfigError, match="shadow_sample_rate"):
        load_council_config(_write_yaml(tmp_path, payload))


# ── step-9 P8: Iron Law — locked-class dispatch rejection ───────────────────


def test_high_impact_dispatch_rejected(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["decision_resolution"] = {
        "classes": {"high_impact": {"dispatch": "single"}},
    }
    with pytest.raises(CouncilConfigError, match="not configurable"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_user_required_dispatch_rejected(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["decision_resolution"] = {
        "classes": {"user_required": {"dispatch": "single"}},
    }
    with pytest.raises(CouncilConfigError, match="not configurable"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_top_level_high_impact_dispatch_rejected(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["high_impact"] = {"dispatch": "single"}
    with pytest.raises(CouncilConfigError, match="not configurable"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_top_level_user_required_dispatch_rejected(tmp_path: Path) -> None:
    payload = dict(_MINIMAL_VALID)
    payload["user_required"] = {"dispatch": "full"}
    with pytest.raises(CouncilConfigError, match="not configurable"):
        load_council_config(_write_yaml(tmp_path, payload))
