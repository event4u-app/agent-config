"""Tests for scripts/ci_summary.py — render dispatcher runs as CI summary."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from ci_summary import load_runs, render_summary, write_output


def _result(name: str, status: str = "success", exit_code: int = 0,
            duration_ms: int = 12, stderr: str = "", error: str | None = None) -> dict:
    return {
        "skill_name": name,
        "handler": "shell",
        "command": ["bash", "-c", "true"],
        "cwd": "/tmp",
        "exit_code": exit_code,
        "stdout": "",
        "stderr": stderr,
        "duration_ms": duration_ms,
        "status": status,
        "timed_out": False,
        "error": error,
        "artifacts": [],
    }


def test_load_runs_missing_directory(tmp_path: Path) -> None:
    assert load_runs(tmp_path / "does-not-exist") == []


def test_load_runs_empty_directory(tmp_path: Path) -> None:
    assert load_runs(tmp_path) == []


def test_load_runs_sorted_by_filename(tmp_path: Path) -> None:
    (tmp_path / "b.json").write_text(json.dumps(_result("b")))
    (tmp_path / "a.json").write_text(json.dumps(_result("a")))
    runs = load_runs(tmp_path)
    assert [r["skill_name"] for r in runs] == ["a", "b"]


def test_load_runs_skips_malformed(tmp_path: Path) -> None:
    (tmp_path / "ok.json").write_text(json.dumps(_result("ok")))
    (tmp_path / "bad.json").write_text("not json at all")
    runs = load_runs(tmp_path)
    assert [r["skill_name"] for r in runs] == ["ok"]


def test_render_summary_empty() -> None:
    md = render_summary([], "Title")
    assert "## Title" in md
    assert "No dispatcher runs" in md


def test_render_summary_all_pass() -> None:
    runs = [_result("lint"), _result("refs")]
    md = render_summary(runs, "Runs")
    assert "Passed: **2**" in md
    assert "Failed: **0**" in md
    assert "| `lint`" in md
    assert "| `refs`" in md
    assert "✅ success" in md


def test_render_summary_failure_details() -> None:
    runs = [
        _result("good"),
        _result("bad", status="failure", exit_code=1,
                stderr="something broke\nstack trace here", error="boom"),
    ]
    md = render_summary(runs, "Runs")
    assert "Passed: **1**" in md
    assert "Failed: **1**" in md
    assert "### Failure details" in md
    assert "<details><summary><code>bad</code>" in md
    assert "**Error:** boom" in md
    assert "something broke" in md


def test_write_output_without_env(monkeypatch, capsys) -> None:
    monkeypatch.delenv("GITHUB_STEP_SUMMARY", raising=False)
    assert write_output("hello\n") is False


def test_write_output_with_env(tmp_path: Path, monkeypatch) -> None:
    target = tmp_path / "summary.md"
    monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(target))
    assert write_output("first\n") is True
    assert write_output("second") is True  # no trailing newline → added
    content = target.read_text(encoding="utf-8")
    assert content == "first\nsecond\n"
