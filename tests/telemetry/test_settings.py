"""Phase 2 — settings reader tests."""
from __future__ import annotations

from pathlib import Path

from telemetry.settings import (
    DEFAULT_GRANULARITY,
    DEFAULT_LOG_PATH,
    read_settings,
)

YAML_DISABLED = """\
telemetry:
  artifact_engagement:
    enabled: false
    granularity: task
    record:
      consulted: true
      applied: true
    output:
      path: .agent-engagement.jsonl
"""

YAML_ENABLED = """\
telemetry:
  artifact_engagement:
    enabled: true
    granularity: phase-step
    record:
      consulted: true
      applied: false
    output:
      path: var/log/engagement.jsonl
"""

YAML_NO_TELEMETRY_SECTION = """\
onboarding:
  onboarded: true
"""


def test_missing_settings_file_disables(tmp_path: Path) -> None:
    settings = read_settings(tmp_path / "no-such.yml")
    assert settings.enabled is False
    assert settings.section_present is False
    assert settings.granularity == DEFAULT_GRANULARITY
    assert settings.log_path == DEFAULT_LOG_PATH


def test_no_telemetry_section_disables(tmp_path: Path) -> None:
    f = tmp_path / "settings.yml"
    f.write_text(YAML_NO_TELEMETRY_SECTION)
    settings = read_settings(f)
    assert settings.enabled is False
    assert settings.section_present is False


def test_explicit_disable_keeps_section_present(tmp_path: Path) -> None:
    f = tmp_path / "settings.yml"
    f.write_text(YAML_DISABLED)
    settings = read_settings(f)
    assert settings.enabled is False
    assert settings.section_present is True
    assert settings.granularity == "task"


def test_enabled_section_parsed(tmp_path: Path) -> None:
    f = tmp_path / "settings.yml"
    f.write_text(YAML_ENABLED)
    settings = read_settings(f)
    assert settings.enabled is True
    assert settings.section_present is True
    assert settings.granularity == "phase-step"
    assert settings.record_consulted is True
    assert settings.record_applied is False
    assert settings.log_path == Path("var/log/engagement.jsonl")


def test_invalid_granularity_falls_back_to_default(tmp_path: Path) -> None:
    f = tmp_path / "settings.yml"
    f.write_text(
        "telemetry:\n"
        "  artifact_engagement:\n"
        "    enabled: true\n"
        "    granularity: weekly\n"  # not allowed
    )
    settings = read_settings(f)
    assert settings.enabled is True
    assert settings.granularity == DEFAULT_GRANULARITY


def test_garbage_yaml_disables(tmp_path: Path) -> None:
    f = tmp_path / "settings.yml"
    f.write_text("not: [valid: yaml: at all")
    settings = read_settings(f)
    assert settings.enabled is False
    assert settings.section_present is False
