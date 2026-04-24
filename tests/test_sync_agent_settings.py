"""Tests for scripts/sync_agent_settings.py — settings sync helper."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import sync_agent_settings as sas  # noqa: E402


MINIMAL_TEMPLATE = """\
# Header
cost_profile: __COST_PROFILE__

# --- Personal preferences ---
personal:
  # IDE preference
  ide: ""

  # Name
  user_name: ""

# --- Chat history ---
chat_history:
  enabled: true
  frequency: __CHAT_HISTORY_FREQUENCY__
  max_size_kb: __CHAT_HISTORY_MAX_SIZE_KB__

# --- Onboarding ---
onboarding:
  onboarded: false
"""

MINIMAL_INI = """\
cost_profile=minimal
chat_history_frequency=per_turn
chat_history_max_size_kb=128
chat_history_on_overflow=rotate
"""


@pytest.fixture
def workspace(tmp_path: Path) -> Path:
    (tmp_path / "config" / "profiles").mkdir(parents=True)
    (tmp_path / "config" / "agent-settings.template.yml").write_text(
        MINIMAL_TEMPLATE, encoding="utf-8"
    )
    (tmp_path / "config" / "profiles" / "minimal.ini").write_text(
        MINIMAL_INI, encoding="utf-8"
    )
    return tmp_path


def _run(workspace: Path, extra: list[str] | None = None) -> int:
    args = [
        "--path", str(workspace / ".agent-settings.yml"),
        "--template", str(workspace / "config" / "agent-settings.template.yml"),
        "--profile-dir", str(workspace / "config" / "profiles"),
        "--quiet",
    ]
    return sas.main(args + (extra or []))


def test_creates_file_from_template_when_missing(workspace: Path):
    target = workspace / ".agent-settings.yml"
    assert not target.exists()
    assert _run(workspace) == 0
    data = yaml.safe_load(target.read_text(encoding="utf-8"))
    assert data["cost_profile"] == "minimal"
    assert data["chat_history"]["frequency"] == "per_turn"
    assert data["chat_history"]["max_size_kb"] == 128
    assert data["onboarding"]["onboarded"] is False


def test_preserves_user_values_and_adds_missing_sections(workspace: Path):
    target = workspace / ".agent-settings.yml"
    target.write_text(
        "cost_profile: minimal\n"
        "personal:\n"
        "  ide: phpstorm\n"
        "  user_name: Matze\n",
        encoding="utf-8",
    )
    assert _run(workspace) == 0
    data = yaml.safe_load(target.read_text(encoding="utf-8"))
    assert data["personal"]["ide"] == "phpstorm"
    assert data["personal"]["user_name"] == "Matze"
    # New sections from template seeded with defaults
    assert data["chat_history"]["frequency"] == "per_turn"
    assert data["onboarding"]["onboarded"] is False


def test_idempotent_second_run_is_noop(workspace: Path, capsys):
    assert _run(workspace) == 0
    first = (workspace / ".agent-settings.yml").read_text(encoding="utf-8")
    capsys.readouterr()
    assert _run(workspace) == 0
    second = (workspace / ".agent-settings.yml").read_text(encoding="utf-8")
    assert first == second


def test_check_exits_2_on_drift(workspace: Path):
    target = workspace / ".agent-settings.yml"
    target.write_text("cost_profile: minimal\n", encoding="utf-8")
    assert _run(workspace, ["--check"]) == 2
    # File must not be modified under --check
    assert target.read_text(encoding="utf-8") == "cost_profile: minimal\n"


def test_check_exits_0_when_in_sync(workspace: Path):
    assert _run(workspace) == 0
    assert _run(workspace, ["--check"]) == 0


def test_dry_run_does_not_write(workspace: Path):
    target = workspace / ".agent-settings.yml"
    target.write_text("cost_profile: minimal\n", encoding="utf-8")
    before = target.read_text(encoding="utf-8")
    assert _run(workspace, ["--dry-run"]) == 0
    assert target.read_text(encoding="utf-8") == before


def test_unknown_user_keys_preserved_under_user_block(workspace: Path):
    target = workspace / ".agent-settings.yml"
    target.write_text(
        "cost_profile: minimal\n"
        "legacy_thing:\n"
        "  flag: custom_value\n",
        encoding="utf-8",
    )
    assert _run(workspace) == 0
    body = target.read_text(encoding="utf-8")
    assert "_user:" in body
    assert "legacy_thing.flag: custom_value" in body


def test_bare_identifier_not_requoted(workspace: Path):
    """Regression: cosmetic requoting would break idempotency."""
    assert _run(workspace) == 0
    body = (workspace / ".agent-settings.yml").read_text(encoding="utf-8")
    # Profile-driven value must be emitted bare, not quoted
    assert "frequency: per_turn\n" in body
    assert 'frequency: "per_turn"' not in body
