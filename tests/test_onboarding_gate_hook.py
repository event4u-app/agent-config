"""Tests for scripts/onboarding_gate_hook.py — state-writer hook."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import onboarding_gate_hook as hook  # noqa: E402


def _write_settings(root: Path, body: str) -> Path:
    settings = root / "agent-settings.yml"  # name irrelevant; we pass the path
    settings.write_text(body, encoding="utf-8")
    return settings


def _state(root: Path) -> dict:
    return json.loads(
        (root / hook.STATE_FILE).read_text(encoding="utf-8"))


def test_required_when_onboarded_false(tmp_path: Path):
    (tmp_path / ".agent-settings.yml").write_text(
        "onboarding:\n  onboarded: false\n", encoding="utf-8")
    assert hook.run(consumer_root=tmp_path) == 0
    s = _state(tmp_path)
    assert s["required"] is True
    assert s["reason"] == "explicit_false"
    assert s["settings_present"] is True


def test_not_required_when_onboarded_true(tmp_path: Path):
    (tmp_path / ".agent-settings.yml").write_text(
        "onboarding:\n  onboarded: true\n", encoding="utf-8")
    assert hook.run(consumer_root=tmp_path) == 0
    s = _state(tmp_path)
    assert s["required"] is False
    assert s["reason"] == "already_onboarded"


def test_legacy_project_no_settings_file(tmp_path: Path):
    assert hook.run(consumer_root=tmp_path) == 0
    s = _state(tmp_path)
    assert s["required"] is False
    assert s["reason"] == "settings_file_missing"
    assert s["settings_present"] is False


def test_legacy_project_no_onboarding_section(tmp_path: Path):
    (tmp_path / ".agent-settings.yml").write_text(
        "user_name: Matze\nide: vscode\n", encoding="utf-8")
    assert hook.run(consumer_root=tmp_path) == 0
    s = _state(tmp_path)
    assert s["required"] is False
    assert s["reason"] == "key_missing"


def test_legacy_project_section_without_onboarded_key(tmp_path: Path):
    (tmp_path / ".agent-settings.yml").write_text(
        "onboarding:\n  hint: legacy\nuser_name: Matze\n",
        encoding="utf-8")
    assert hook.run(consumer_root=tmp_path) == 0
    s = _state(tmp_path)
    assert s["required"] is False
    assert s["reason"] == "key_missing"


def test_yaml_with_comments_and_blank_lines(tmp_path: Path):
    body = (
        "# top comment\n"
        "user_name: Matze\n"
        "\n"
        "onboarding:\n"
        "  # walked through /onboard\n"
        "  onboarded: false  # gate active\n"
    )
    (tmp_path / ".agent-settings.yml").write_text(body, encoding="utf-8")
    assert hook.run(consumer_root=tmp_path) == 0
    assert _state(tmp_path)["required"] is True


def test_unknown_value_is_not_required(tmp_path: Path):
    (tmp_path / ".agent-settings.yml").write_text(
        "onboarding:\n  onboarded: maybe\n", encoding="utf-8")
    assert hook.run(consumer_root=tmp_path) == 0
    s = _state(tmp_path)
    assert s["required"] is False
    assert s["reason"].startswith("unknown_value:")


def test_state_payload_has_iso_timestamp(tmp_path: Path):
    assert hook.run(consumer_root=tmp_path) == 0
    s = _state(tmp_path)
    # ISO-8601 with seconds precision and a UTC offset.
    assert "T" in s["checked_at"]
    assert s["checked_at"].endswith("+00:00")


def test_atomic_write_does_not_leave_tmp(tmp_path: Path):
    (tmp_path / ".agent-settings.yml").write_text(
        "onboarding:\n  onboarded: true\n", encoding="utf-8")
    assert hook.run(consumer_root=tmp_path) == 0
    state_dir = tmp_path / hook.STATE_DIR
    leftovers = [p.name for p in state_dir.iterdir()
                 if p.name.endswith(".tmp")]
    assert leftovers == []


def test_repeat_runs_overwrite(tmp_path: Path):
    settings = tmp_path / ".agent-settings.yml"
    settings.write_text("onboarding:\n  onboarded: false\n",
                        encoding="utf-8")
    hook.run(consumer_root=tmp_path)
    assert _state(tmp_path)["required"] is True

    settings.write_text("onboarding:\n  onboarded: true\n",
                        encoding="utf-8")
    hook.run(consumer_root=tmp_path)
    s = _state(tmp_path)
    assert s["required"] is False
    assert s["reason"] == "already_onboarded"


def test_main_drains_stdin(tmp_path: Path, monkeypatch, capsys):
    monkeypatch.chdir(tmp_path)
    (tmp_path / ".agent-settings.yml").write_text(
        "onboarding:\n  onboarded: true\n", encoding="utf-8")

    # Simulate piped JSON on stdin — main() must drain it without error.
    import io
    monkeypatch.setattr("sys.stdin", io.StringIO('{"foo": "bar"}'))
    assert hook.main(["--platform", "augment"]) == 0
    s = _state(tmp_path)
    assert s["required"] is False


def test_unreadable_settings_does_not_crash(tmp_path: Path, monkeypatch):
    settings = tmp_path / ".agent-settings.yml"
    settings.write_text("onboarding:\n  onboarded: false\n",
                        encoding="utf-8")
    settings.chmod(0o000)
    try:
        assert hook.run(consumer_root=tmp_path) == 0
    finally:
        settings.chmod(0o644)
    s = _state(tmp_path)
    assert s["required"] is False
    assert s["reason"] in ("settings_file_unreadable", "settings_file_missing")
