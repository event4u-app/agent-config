"""Phase 2 — CLI tests for telemetry:record and telemetry:status.

These import the CLI scripts as modules. The conftest already adds
``.agent-src.uncompressed/templates/scripts/`` to ``sys.path``, so
``import telemetry_record`` and ``import telemetry_status`` work
directly.
"""
from __future__ import annotations

import io
import json
from pathlib import Path

import pytest

import telemetry_record
import telemetry_status
from telemetry.engagement import parse_event


SETTINGS_DISABLED = """\
telemetry:
  artifact_engagement:
    enabled: false
    output:
      path: {log}
"""

SETTINGS_ENABLED = """\
telemetry:
  artifact_engagement:
    enabled: true
    output:
      path: {log}
"""


# --- telemetry:record ---------------------------------------------------


def test_record_disabled_is_silent_zero_io(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    settings = tmp_path / "settings.yml"
    log = tmp_path / ".agent-engagement.jsonl"
    settings.write_text(SETTINGS_DISABLED.format(log=log))

    rc = telemetry_record.main([
        "--settings", str(settings),
        "--task-id", "t1",
        "--consulted", "skills:php-coder",
    ])
    assert rc == 0
    out, err = capsys.readouterr()
    assert out == ""
    assert err == ""
    assert not log.exists()  # zero file IO


def test_record_enabled_appends_one_line(tmp_path: Path) -> None:
    settings = tmp_path / "settings.yml"
    log = tmp_path / ".agent-engagement.jsonl"
    settings.write_text(SETTINGS_ENABLED.format(log=log))

    rc = telemetry_record.main([
        "--settings", str(settings),
        "--task-id", "ticket-7",
        "--boundary", "task",
        "--consulted", "skills:php-coder",
        "--consulted", "rules:scope-control",
        "--applied", "skills:php-coder",
    ])
    assert rc == 0
    assert log.exists()
    lines = [l for l in log.read_text().splitlines() if l.strip()]
    assert len(lines) == 1
    event = parse_event(lines[0] + "\n")
    assert event.task_id == "ticket-7"
    assert event.consulted == {
        "skills": ["php-coder"],
        "rules": ["scope-control"],
    }
    assert event.applied == {"skills": ["php-coder"]}


def test_record_force_bypasses_disabled(tmp_path: Path) -> None:
    settings = tmp_path / "settings.yml"
    log = tmp_path / ".agent-engagement.jsonl"
    settings.write_text(SETTINGS_DISABLED.format(log=log))

    rc = telemetry_record.main([
        "--settings", str(settings),
        "--force",
        "--task-id", "ticket-force",
        "--consulted", "skills:x",
    ])
    assert rc == 0
    assert log.is_file()


def test_record_invalid_kv_returns_nonzero(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    settings = tmp_path / "settings.yml"
    log = tmp_path / ".agent-engagement.jsonl"
    settings.write_text(SETTINGS_ENABLED.format(log=log))

    with pytest.raises(SystemExit) as exc_info:
        telemetry_record.main([
            "--settings", str(settings),
            "--task-id", "t",
            "--consulted", "no-colon-here",
        ])
    assert exc_info.value.code != 0


def test_record_payload_stdin(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    settings = tmp_path / "settings.yml"
    log = tmp_path / ".agent-engagement.jsonl"
    settings.write_text(SETTINGS_ENABLED.format(log=log))

    payload = json.dumps({
        "ts": "2026-04-30T12:00:00Z",
        "task_id": "stdin-1",
        "boundary_kind": "phase-step",
        "consulted": {"skills": ["a", "b"]},
        "applied": {"rules": ["r"]},
    })
    monkeypatch.setattr("sys.stdin", io.StringIO(payload))
    rc = telemetry_record.main([
        "--settings", str(settings),
        "--stdin",
    ])
    assert rc == 0
    lines = [l for l in log.read_text().splitlines() if l.strip()]
    assert len(lines) == 1
    event = parse_event(lines[0] + "\n")
    assert event.task_id == "stdin-1"
    assert event.boundary_kind == "phase-step"


def test_record_outcome_flag_persists_to_log(tmp_path: Path) -> None:
    settings = tmp_path / "settings.yml"
    log = tmp_path / ".agent-engagement.jsonl"
    settings.write_text(SETTINGS_ENABLED.format(log=log))

    rc = telemetry_record.main([
        "--settings", str(settings),
        "--task-id", "ticket-outcome",
        "--consulted", "rules:scope-control",
        "--outcome", "blocked",
        "--outcome", "verification_failed",
    ])
    assert rc == 0
    lines = [l for l in log.read_text().splitlines() if l.strip()]
    event = parse_event(lines[0] + "\n")
    assert event.outcomes == ["blocked", "verification_failed"]


def test_record_outcome_unknown_label_rejected(tmp_path: Path) -> None:
    settings = tmp_path / "settings.yml"
    log = tmp_path / ".agent-engagement.jsonl"
    settings.write_text(SETTINGS_ENABLED.format(log=log))

    with pytest.raises(SystemExit) as exc_info:
        telemetry_record.main([
            "--settings", str(settings),
            "--task-id", "t",
            "--consulted", "skills:x",
            "--outcome", "nope",
        ])
    assert exc_info.value.code != 0


def test_record_payload_schema_failure_returns_1(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    settings = tmp_path / "settings.yml"
    log = tmp_path / ".agent-engagement.jsonl"
    settings.write_text(SETTINGS_ENABLED.format(log=log))

    payload = json.dumps({
        "task_id": "",  # invalid
        "boundary_kind": "task",
    })
    monkeypatch.setattr("sys.stdin", io.StringIO(payload))
    rc = telemetry_record.main([
        "--settings", str(settings),
        "--stdin",
    ])
    assert rc == 1
    err = capsys.readouterr().err
    assert "schema validation failed" in err
    assert not log.exists()


# --- telemetry:status ---------------------------------------------------


def test_status_disabled_no_log_file(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    settings = tmp_path / "settings.yml"
    log = tmp_path / ".agent-engagement.jsonl"
    settings.write_text(SETTINGS_DISABLED.format(log=log))

    rc = telemetry_status.main([
        "--settings", str(settings),
        "--format", "json",
    ])
    assert rc == 0
    out = capsys.readouterr().out
    report = json.loads(out)
    assert report["enabled"] is False
    assert report["section_present"] is True
    assert report["log"]["exists"] is False
    # Crucial: status is read-only — never creates the log
    assert not log.exists()


def test_status_enabled_with_events(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    settings = tmp_path / "settings.yml"
    log = tmp_path / ".agent-engagement.jsonl"
    settings.write_text(SETTINGS_ENABLED.format(log=log))

    # Pre-populate via record
    telemetry_record.main([
        "--settings", str(settings),
        "--task-id", "t-status",
        "--ts", "2026-04-30T10:00:00Z",
        "--consulted", "skills:x",
    ])

    rc = telemetry_status.main([
        "--settings", str(settings),
        "--format", "json",
    ])
    assert rc == 0
    report = json.loads(capsys.readouterr().out)
    assert report["enabled"] is True
    assert report["log"]["exists"] is True
    assert report["log"]["line_count"] == 1
    assert report["log"]["last_event_ts"] == "2026-04-30T10:00:00Z"


def test_status_text_format(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    settings = tmp_path / "settings.yml"
    log = tmp_path / ".agent-engagement.jsonl"
    settings.write_text(SETTINGS_DISABLED.format(log=log))

    rc = telemetry_status.main(["--settings", str(settings)])
    assert rc == 0
    out = capsys.readouterr().out
    assert "artifact-engagement" in out
    assert "disabled" in out


def test_status_no_settings_file_renders_defaults(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    rc = telemetry_status.main([
        "--settings", str(tmp_path / "no-such.yml"),
        "--format", "json",
    ])
    assert rc == 0
    report = json.loads(capsys.readouterr().out)
    assert report["enabled"] is False
    assert report["section_present"] is False
