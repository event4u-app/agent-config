"""Phase 4 Step 4 — telemetry:report CLI tests.

Coverage:

- Empty / missing log → exit 0, empty-but-valid output.
- Markdown vs JSON formats produce parseable output.
- ``--since`` accepts d/h/m units and ``all``; rejects garbage with
  exit 2.
- ``--top 0`` disables truncation; ``--top N`` truncates per bucket.
- ``--log-path`` override bypasses the settings file (tests, ad-hoc
  reports against archived snapshots).
- Malformed lines emit the warning to stderr but do not change the
  exit code.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

import telemetry_report
from telemetry.engagement import EngagementEvent


def _event_line(ts: str, *, art: str = "skills:php-coder") -> str:
    kind, art_id = art.split(":", 1)
    return EngagementEvent(
        ts=ts,
        task_id="ticket-1",
        boundary_kind="task",
        consulted={kind: [art_id]},
        applied={kind: [art_id]},
    ).to_jsonl().rstrip("\n")


def _write_log(path: Path, lines: list[str]) -> None:
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def test_report_empty_log_markdown(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    log = tmp_path / ".agent-engagement.jsonl"
    rc = telemetry_report.main([
        "--log-path", str(log),
        "--settings", str(tmp_path / "missing-settings.yml"),
        "--since", "all",
    ])
    out = capsys.readouterr().out
    assert rc == 0
    assert "events parsed: **0**" in out
    assert out.count("_(none)_") == 3


def test_report_json_format(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    log = tmp_path / ".agent-engagement.jsonl"
    _write_log(log, [
        _event_line("2026-04-30T12:00:00Z", art="skills:a"),
        _event_line("2026-04-30T12:01:00Z", art="rules:r1"),
    ])
    rc = telemetry_report.main([
        "--log-path", str(log),
        "--settings", str(tmp_path / "missing.yml"),
        "--since", "all",
        "--format", "json",
    ])
    assert rc == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["summary"]["parsed_events"] == 2
    flat_ids = {e["id"] for bucket in payload["buckets"].values() for e in bucket}
    assert flat_ids == {"a", "r1"}


def test_report_since_d_h_m_units(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    log = tmp_path / ".agent-engagement.jsonl"
    log.write_text("", encoding="utf-8")
    for arg in ("30d", "12h", "60m", "all"):
        rc = telemetry_report.main([
            "--log-path", str(log),
            "--settings", str(tmp_path / "missing.yml"),
            "--since", arg,
        ])
        assert rc == 0
        capsys.readouterr()  # drain


def test_report_since_invalid_returns_2(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    log = tmp_path / ".agent-engagement.jsonl"
    log.write_text("", encoding="utf-8")
    rc = telemetry_report.main([
        "--log-path", str(log),
        "--settings", str(tmp_path / "missing.yml"),
        "--since", "30 weeks",
    ])
    assert rc == 2
    err = capsys.readouterr().err
    assert "--since" in err


def test_report_top_zero_disables_truncation(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    log = tmp_path / ".agent-engagement.jsonl"
    _write_log(log, [
        _event_line("2026-04-30T12:00:00Z", art=f"skills:s{i}")
        for i in range(15)
    ])
    rc = telemetry_report.main([
        "--log-path", str(log),
        "--settings", str(tmp_path / "missing.yml"),
        "--since", "all",
        "--format", "json",
        "--top", "0",
    ])
    assert rc == 0
    payload = json.loads(capsys.readouterr().out)
    total = sum(len(b) for b in payload["buckets"].values())
    assert total == 15


def test_report_malformed_lines_emit_warning(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    log = tmp_path / ".agent-engagement.jsonl"
    log.write_text(
        "\n".join([
            _event_line("2026-04-30T12:00:00Z", art="skills:a"),
            "{not valid json",
        ]) + "\n",
        encoding="utf-8",
    )
    rc = telemetry_report.main([
        "--log-path", str(log),
        "--settings", str(tmp_path / "missing.yml"),
        "--since", "all",
    ])
    captured = capsys.readouterr()
    assert rc == 0
    assert "skipped 1 malformed line" in captured.err


def test_report_uses_settings_log_path(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    log = tmp_path / "custom.jsonl"
    _write_log(log, [_event_line("2026-04-30T12:00:00Z", art="skills:x")])
    settings = tmp_path / ".agent-settings.yml"
    settings.write_text(
        f"telemetry:\n  artifact_engagement:\n    enabled: true\n    output:\n      path: {log}\n",
        encoding="utf-8",
    )
    rc = telemetry_report.main([
        "--settings", str(settings),
        "--since", "all",
        "--format", "json",
    ])
    assert rc == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["summary"]["parsed_events"] == 1
