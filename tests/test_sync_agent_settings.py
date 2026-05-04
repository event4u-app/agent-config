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


def test_user_block_round_trip_is_idempotent(workspace: Path):
    """Regression: unknown keys under `_user:` must not re-prefix on each sync.

    Pre-fix bug: every sync prepended another ``_user.`` segment to each
    dotted key, so after N syncs the leaf carried ``_user. * N`` prefixes.
    """
    target = workspace / ".agent-settings.yml"
    target.write_text(
        "cost_profile: minimal\n"
        "legacy_thing:\n"
        "  flag: custom_value\n"
        "  nested:\n"
        "    deep: 42\n",
        encoding="utf-8",
    )
    # Run sync many times; output must stabilize after the first write.
    assert _run(workspace) == 0
    snapshots = [target.read_text(encoding="utf-8")]
    for _ in range(5):
        assert _run(workspace) == 0
        snapshots.append(target.read_text(encoding="utf-8"))
    # All snapshots after the first sync are byte-identical.
    assert all(s == snapshots[1] for s in snapshots[1:])
    # No `_user._user.` accumulation in the body.
    assert "_user._user." not in snapshots[-1]
    # Original dotted keys still present, single level only.
    assert "  legacy_thing.flag: custom_value" in snapshots[-1]
    assert "  legacy_thing.nested.deep: 42" in snapshots[-1]


def test_user_block_repairs_legacy_corruption(workspace: Path):
    """A file that was corrupted by the old bug must heal on next sync."""
    target = workspace / ".agent-settings.yml"
    # Simulate the worst-case pre-fix corruption: a dotted key carrying
    # many leading `_user.` segments accumulated over many sync runs.
    corrupted_key = "_user." * 50 + "legacy_thing.flag"
    target.write_text(
        "cost_profile: minimal\n"
        "_user:\n"
        f"  {corrupted_key}: custom_value\n",
        encoding="utf-8",
    )
    assert _run(workspace) == 0
    body = target.read_text(encoding="utf-8")
    # The leading `_user.` chain is fully stripped on the first heal pass.
    assert "_user._user." not in body
    assert "  legacy_thing.flag: custom_value" in body
    # Subsequent runs are no-ops.
    first = body
    assert _run(workspace) == 0
    assert target.read_text(encoding="utf-8") == first


def test_bare_identifier_not_requoted(workspace: Path):
    """Regression: cosmetic requoting would break idempotency."""
    assert _run(workspace) == 0
    body = (workspace / ".agent-settings.yml").read_text(encoding="utf-8")
    # Profile-driven value must be emitted bare, not quoted
    assert "frequency: per_turn\n" in body
    assert 'frequency: "per_turn"' not in body


# --- 3-level nesting + list values (regression for commands.suggestion.*) ---

NESTED_TEMPLATE = """\
cost_profile: __COST_PROFILE__

commands:
  suggestion:
    enabled: true
    confidence_floor: 0.6
    cooldown_seconds: 600
    max_options: 4
    blocklist: []
"""


@pytest.fixture
def nested_workspace(tmp_path: Path) -> Path:
    (tmp_path / "config" / "profiles").mkdir(parents=True)
    (tmp_path / "config" / "agent-settings.template.yml").write_text(
        NESTED_TEMPLATE, encoding="utf-8"
    )
    (tmp_path / "config" / "profiles" / "minimal.ini").write_text(
        "cost_profile=minimal\n", encoding="utf-8"
    )
    return tmp_path


def test_three_level_user_values_preserved(nested_workspace: Path):
    """Regression: commands.suggestion.* (3-level) must round-trip cleanly."""
    target = nested_workspace / ".agent-settings.yml"
    target.write_text(
        "cost_profile: minimal\n"
        "commands:\n"
        "  suggestion:\n"
        "    enabled: false\n"
        "    confidence_floor: 0.8\n"
        "    cooldown_seconds: 300\n"
        "    max_options: 2\n"
        "    blocklist: []\n",
        encoding="utf-8",
    )
    assert _run(nested_workspace) == 0
    body = target.read_text(encoding="utf-8")
    # Must remain valid YAML (the bug emitted a Python dict repr string)
    data = yaml.safe_load(body)
    assert data["commands"]["suggestion"]["enabled"] is False
    assert data["commands"]["suggestion"]["confidence_floor"] == 0.8
    assert data["commands"]["suggestion"]["cooldown_seconds"] == 300
    assert data["commands"]["suggestion"]["max_options"] == 2
    # No corruption marker — the bug produced a string starting with "{'enabled"
    assert "suggestion: \"{" not in body


def test_three_level_idempotent(nested_workspace: Path):
    target = nested_workspace / ".agent-settings.yml"
    target.write_text(
        "cost_profile: minimal\n"
        "commands:\n"
        "  suggestion:\n"
        "    enabled: false\n"
        "    confidence_floor: 0.8\n"
        "    cooldown_seconds: 300\n"
        "    max_options: 2\n"
        "    blocklist: []\n",
        encoding="utf-8",
    )
    assert _run(nested_workspace) == 0
    first = target.read_text(encoding="utf-8")
    assert _run(nested_workspace) == 0
    second = target.read_text(encoding="utf-8")
    assert first == second


def test_list_values_round_trip(nested_workspace: Path):
    """Non-empty list values must serialize back as flow-style YAML."""
    target = nested_workspace / ".agent-settings.yml"
    target.write_text(
        "cost_profile: minimal\n"
        "commands:\n"
        "  suggestion:\n"
        "    enabled: true\n"
        "    confidence_floor: 0.6\n"
        "    cooldown_seconds: 600\n"
        "    max_options: 4\n"
        "    blocklist: [\"/refine-ticket\", \"/work\"]\n",
        encoding="utf-8",
    )
    assert _run(nested_workspace) == 0
    body = target.read_text(encoding="utf-8")
    data = yaml.safe_load(body)
    assert data["commands"]["suggestion"]["blocklist"] == ["/refine-ticket", "/work"]
    # The corrupted-emit bug stringified the list with Python repr (single quotes)
    assert "blocklist: \"['" not in body
