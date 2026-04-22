"""Tests for scripts/memory_report.py — quarterly + operational-store sections."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import memory_report  # noqa: E402


@pytest.fixture(autouse=True)
def _chdir(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(memory_report, "MEMORY_ROOT",
                        tmp_path / "agents/memory")
    monkeypatch.setattr(memory_report, "INTAKE_ROOT",
                        tmp_path / "agents/memory/intake")


def _write_curated(tmp_path: Path, mtype: str, hash_name: str,
                   entry: dict) -> None:
    pytest.importorskip("yaml")
    import yaml
    target = tmp_path / "agents/memory" / mtype
    target.mkdir(parents=True, exist_ok=True)
    (target / f"{hash_name}.yml").write_text(yaml.safe_dump(entry))


def _write_intake_supersede(tmp_path: Path, month: str, ts: str) -> None:
    intake = tmp_path / "agents/memory/intake"
    intake.mkdir(parents=True, exist_ok=True)
    (intake / f"signals-{month}.jsonl").write_text(
        json.dumps({"type": "supersede", "ts": ts,
                    "old_id": "x", "new_id": "y"}) + "\n",
    )


def test_quarter_of_groups_dates_correctly():
    assert memory_report._quarter_of("2026-01-15") == "2026Q1"
    assert memory_report._quarter_of("2026-04-01") == "2026Q2"
    assert memory_report._quarter_of("2026-09-30") == "2026Q3"
    assert memory_report._quarter_of("2026-12-31") == "2026Q4"
    assert memory_report._quarter_of("not-a-date") == "unknown"


def test_quarterly_accepted_counted_by_created_date(tmp_path, monkeypatch):
    pytest.importorskip("yaml")
    monkeypatch.setattr(memory_report.memory_status, "status",
                        lambda: type("S", (), {
                            "status": "absent", "backend": "file",
                            "reason": "", "cli_path": "",
                        })())
    _write_curated(tmp_path, "domain-invariants", "aaa",
                   {"id": "one", "created": "2026-01-10",
                    "rule": "x", "status": "active"})
    _write_curated(tmp_path, "domain-invariants", "bbb",
                   {"id": "two", "created": "2026-04-05",
                    "rule": "y", "status": "active"})
    report = memory_report.build_report()
    assert report["quarterly"]["accepted_by_quarter"] == {
        "2026Q1": 1, "2026Q2": 1,
    }


def test_quarterly_retired_counted_from_supersede(tmp_path, monkeypatch):
    monkeypatch.setattr(memory_report.memory_status, "status",
                        lambda: type("S", (), {
                            "status": "absent", "backend": "file",
                            "reason": "", "cli_path": "",
                        })())
    _write_intake_supersede(tmp_path, "2026-03", "2026-03-15T10:00:00+00:00")
    _write_intake_supersede(tmp_path, "2026-05", "2026-05-02T09:00:00+00:00")
    report = memory_report.build_report()
    assert report["quarterly"]["retired_by_quarter"] == {
        "2026Q1": 1, "2026Q2": 1,
    }


def test_operational_store_null_when_backend_absent(monkeypatch):
    monkeypatch.setattr(memory_report.memory_status, "status",
                        lambda: type("S", (), {
                            "status": "absent", "backend": "file",
                            "reason": "not on PATH", "cli_path": "",
                        })())
    report = memory_report.build_report()
    assert report["operational_store"] is None


def test_operational_store_present_returns_stub(monkeypatch):
    monkeypatch.setattr(memory_report.memory_status, "status",
                        lambda: type("S", (), {
                            "status": "present", "backend": "agent-memory",
                            "reason": "", "cli_path": "/usr/bin/am",
                        })())
    report = memory_report.build_report()
    assert report["operational_store"]["enabled"] is True
    assert "note" in report["operational_store"]



def _write_scan_file(tmp_path: Path, rel: str, body: str) -> None:
    target = tmp_path / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(body, encoding="utf-8")


def test_role_mode_stats_counts_known_modes(tmp_path):
    _write_scan_file(
        tmp_path, "agents/sessions/s1.md",
        "Some text.\n\n<!-- role-mode: developer | contract: goal/plan -->\n",
    )
    _write_scan_file(
        tmp_path, "agents/reports/r1.md",
        "<!-- role-mode: reviewer | contract: summary/risks -->\n"
        "<!-- role-mode: reviewer | contract: summary/risks -->\n",
    )
    stats = memory_report._role_mode_stats()
    assert stats["total_markers"] == 3
    assert stats["files_scanned"] == 2
    assert stats["by_mode"] == {"developer": 1, "reviewer": 2}
    assert stats["unknown_modes"] == []


def test_role_mode_stats_flags_unknown_mode(tmp_path):
    _write_scan_file(
        tmp_path, "agents/handoffs/h1.md",
        "<!-- role-mode: saboteur | contract: x/y -->\n",
    )
    stats = memory_report._role_mode_stats()
    assert stats["by_mode"] == {"saboteur": 1}
    assert stats["unknown_modes"] == ["saboteur"]


def test_role_mode_stats_empty_when_no_dirs(tmp_path):
    stats = memory_report._role_mode_stats()
    assert stats["total_markers"] == 0
    assert stats["files_scanned"] == 0
    assert stats["by_mode"] == {}


def test_build_report_includes_role_modes(monkeypatch, tmp_path):
    monkeypatch.setattr(memory_report.memory_status, "status",
                        lambda: type("S", (), {
                            "status": "absent", "backend": "file",
                            "reason": "", "cli_path": "",
                        })())
    _write_scan_file(
        tmp_path, "agents/learnings/l1.md",
        "<!-- role-mode: planner | contract: goal -->\n",
    )
    report = memory_report.build_report()
    assert report["role_modes"]["total_markers"] == 1
    assert report["role_modes"]["by_mode"] == {"planner": 1}
