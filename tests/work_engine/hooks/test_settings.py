"""Unit tests for ``work_engine.hooks.settings``.

Covers the loader contract documented in the module docstring:

- Missing file / malformed YAML / missing block → all-off defaults.
- Master switch ``hooks.enabled: false`` → all-off, regardless of
  per-hook fields.
- Master switch ``hooks.enabled: true`` → per-hook fields control
  individual registration; defaults match Phase 6 Step 1 schema
  (defense-in-depth hooks default-on, trace default-off).
- Chat-history hooks gate on **both** ``hooks.chat_history.enabled``
  and the global ``chat_history.enabled``.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from work_engine.hooks.settings import (
    DEFAULT_CHAT_HISTORY_SCRIPT,
    HookSettings,
    load_hook_settings,
)


def _write(path: Path, body: str) -> Path:
    path.write_text(body, encoding="utf-8")
    return path


def test_missing_file_returns_default_all_off(tmp_path: Path) -> None:
    settings = load_hook_settings(tmp_path / "missing.yml")
    assert settings == HookSettings()
    assert settings.enabled is False


def test_empty_file_returns_default(tmp_path: Path) -> None:
    cfg = _write(tmp_path / "settings.yml", "")
    assert load_hook_settings(cfg).enabled is False


def test_missing_hooks_block_returns_default(tmp_path: Path) -> None:
    cfg = _write(
        tmp_path / "settings.yml",
        "cost_profile: minimal\nchat_history:\n  enabled: true\n",
    )
    assert load_hook_settings(cfg) == HookSettings()


def test_master_switch_off_disables_everything(tmp_path: Path) -> None:
    cfg = _write(
        tmp_path / "settings.yml",
        "hooks:\n"
        "  enabled: false\n"
        "  trace: true\n"
        "  halt_surface_audit: true\n"
        "  state_shape_validation: true\n"
        "  directive_set_guard: true\n"
        "  chat_history:\n"
        "    enabled: true\n"
        "chat_history:\n  enabled: true\n",
    )
    settings = load_hook_settings(cfg)
    assert settings.enabled is False
    assert settings.trace is False
    assert settings.halt_surface_audit is False


def test_master_switch_on_with_defaults(tmp_path: Path) -> None:
    cfg = _write(
        tmp_path / "settings.yml",
        "hooks:\n  enabled: true\n",
    )
    settings = load_hook_settings(cfg)
    assert settings.enabled is True
    # Defense-in-depth defaults per Phase 6 Step 1 schema.
    assert settings.halt_surface_audit is True
    assert settings.state_shape_validation is True
    assert settings.directive_set_guard is True
    # Trace and chat-history default off when not declared.
    assert settings.trace is False
    assert settings.chat_history_enabled is False


def test_per_hook_overrides(tmp_path: Path) -> None:
    cfg = _write(
        tmp_path / "settings.yml",
        "hooks:\n"
        "  enabled: true\n"
        "  trace: true\n"
        "  halt_surface_audit: false\n"
        "  state_shape_validation: false\n"
        "  directive_set_guard: false\n",
    )
    settings = load_hook_settings(cfg)
    assert settings.trace is True
    assert settings.halt_surface_audit is False
    assert settings.state_shape_validation is False
    assert settings.directive_set_guard is False


def test_chat_history_requires_both_switches(tmp_path: Path) -> None:
    body_only_hook_block = _write(
        tmp_path / "a.yml",
        "hooks:\n  enabled: true\n  chat_history:\n    enabled: true\n",
    )
    assert load_hook_settings(body_only_hook_block).chat_history_enabled is False

    body_only_global = _write(
        tmp_path / "b.yml",
        "hooks:\n  enabled: true\nchat_history:\n  enabled: true\n",
    )
    # Implicit chat_history block under hooks → defaults to True →
    # combined with the global switch this enables the hooks.
    assert load_hook_settings(body_only_global).chat_history_enabled is True

    body_both_off = _write(
        tmp_path / "c.yml",
        "hooks:\n"
        "  enabled: true\n"
        "  chat_history:\n    enabled: false\n"
        "chat_history:\n  enabled: true\n",
    )
    assert load_hook_settings(body_both_off).chat_history_enabled is False

    body_both_on = _write(
        tmp_path / "d.yml",
        "hooks:\n"
        "  enabled: true\n"
        "  chat_history:\n    enabled: true\n"
        "chat_history:\n  enabled: true\n",
    )
    assert load_hook_settings(body_both_on).chat_history_enabled is True


def test_chat_history_script_override(tmp_path: Path) -> None:
    cfg = _write(
        tmp_path / "settings.yml",
        "hooks:\n"
        "  enabled: true\n"
        "  chat_history:\n    enabled: true\n    script: bin/ch.py\n"
        "chat_history:\n  enabled: true\n",
    )
    settings = load_hook_settings(cfg)
    assert settings.chat_history_script == "bin/ch.py"


def test_default_script_path() -> None:
    assert HookSettings().chat_history_script == DEFAULT_CHAT_HISTORY_SCRIPT


def test_malformed_yaml_returns_default(tmp_path: Path) -> None:
    cfg = _write(tmp_path / "bad.yml", "hooks: [: invalid\n")
    assert load_hook_settings(cfg) == HookSettings()


def test_non_dict_root_returns_default(tmp_path: Path) -> None:
    cfg = _write(tmp_path / "list.yml", "- one\n- two\n")
    assert load_hook_settings(cfg) == HookSettings()


def test_string_booleans_are_coerced(tmp_path: Path) -> None:
    cfg = _write(
        tmp_path / "settings.yml",
        'hooks:\n  enabled: "true"\n  trace: "yes"\n',
    )
    settings = load_hook_settings(cfg)
    assert settings.enabled is True
    assert settings.trace is True


@pytest.mark.parametrize("flag", ["off", "no", "false", "0"])
def test_string_falsy_disables_master(flag: str, tmp_path: Path) -> None:
    cfg = _write(tmp_path / "settings.yml", f"hooks:\n  enabled: \"{flag}\"\n")
    assert load_hook_settings(cfg).enabled is False


def test_decision_trace_default_off(tmp_path: Path) -> None:
    cfg = _write(tmp_path / "settings.yml", "hooks:\n  enabled: true\n")
    assert load_hook_settings(cfg).decision_trace is False


def test_decision_trace_opt_in_via_decision_engine_block(tmp_path: Path) -> None:
    cfg = _write(
        tmp_path / "settings.yml",
        "hooks:\n  enabled: true\n"
        "decision_engine:\n  surface_traces: true\n",
    )
    assert load_hook_settings(cfg).decision_trace is True


def test_decision_trace_off_when_master_off(tmp_path: Path) -> None:
    cfg = _write(
        tmp_path / "settings.yml",
        "hooks:\n  enabled: false\n"
        "decision_engine:\n  surface_traces: true\n",
    )
    assert load_hook_settings(cfg).decision_trace is False
