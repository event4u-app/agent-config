"""Tests for `scripts/hooks_status.py` — runtime hook matrix.

Phase 7.12, hook-architecture-v1.md. Verifies:
  * `collect()` walks every platform listed in PLATFORM_BRIDGES.
  * Bridge presence is detected from disk (file or non-empty dir).
  * Copilot row carries the `degraded` marker (rule-only fallback).
  * `--strict` mode returns non-zero only when a platform with declared
    bindings is missing its bridge.
  * JSON output is well-formed and round-trips through `json.loads`.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
sys.path.insert(0, str(REPO_ROOT / "scripts" / "hooks"))

import dispatch_hook  # noqa: E402
import hooks_status  # noqa: E402


@pytest.fixture
def manifest() -> dict:
    return dispatch_hook._load_yaml(dispatch_hook.MANIFEST_PATH)


def test_collect_returns_every_platform(tmp_path: Path, manifest: dict) -> None:
    matrix = hooks_status.collect(tmp_path, manifest)
    assert matrix["schema_version"] == 1
    platforms = {row["platform"] for row in matrix["platforms"]}
    assert platforms == set(hooks_status.PLATFORM_BRIDGES.keys())


def test_missing_bridges_reported_when_project_empty(tmp_path: Path, manifest: dict) -> None:
    matrix = hooks_status.collect(tmp_path, manifest)
    by_platform = {row["platform"]: row for row in matrix["platforms"]}
    # All non-Copilot, non-Cowork platforms have a real bridge_path and
    # should report 'missing' in a fresh tmp dir.
    for platform in ("augment", "claude", "cursor", "cline", "windsurf", "gemini"):
        row = by_platform[platform]
        assert row["status"] == "missing", row
        assert row["bindings"], f"{platform} has no manifest bindings"
    # Copilot is always degraded.
    assert by_platform["copilot"]["status"] == "degraded"
    assert by_platform["copilot"]["fallback_only"] is True
    # Cowork has manifest bindings but no project-scope bridge path
    # (upstream-blocked by anthropics/claude-code#40495 + #27398).
    # The empty bridge path resolves to status="n/a"; strict mode
    # never fails on n/a (matches Copilot's no-bridge posture).
    cowork = by_platform["cowork"]
    assert cowork["status"] == "n/a", cowork
    assert cowork["bridge_path"] is None
    assert cowork["bindings"], "cowork must declare manifest bindings"
    assert cowork["fallback_only"] is False
    assert "upstream-blocked" in (cowork["hint"] or "")


def test_installed_bridge_detected(tmp_path: Path, manifest: dict) -> None:
    (tmp_path / ".claude").mkdir()
    (tmp_path / ".claude" / "settings.json").write_text("{}", encoding="utf-8")
    matrix = hooks_status.collect(tmp_path, manifest)
    claude = next(r for r in matrix["platforms"] if r["platform"] == "claude")
    assert claude["status"] == "installed"
    assert claude["hint"] is None


def test_cline_directory_bridge_detected(tmp_path: Path, manifest: dict) -> None:
    cline_dir = tmp_path / ".clinerules" / "hooks"
    cline_dir.mkdir(parents=True)
    (cline_dir / "TaskStart").write_text("#!/bin/sh\n", encoding="utf-8")
    matrix = hooks_status.collect(tmp_path, manifest)
    cline = next(r for r in matrix["platforms"] if r["platform"] == "cline")
    assert cline["status"] == "installed"


def test_empty_cline_directory_marked_empty(tmp_path: Path, manifest: dict) -> None:
    (tmp_path / ".clinerules" / "hooks").mkdir(parents=True)
    matrix = hooks_status.collect(tmp_path, manifest)
    cline = next(r for r in matrix["platforms"] if r["platform"] == "cline")
    assert cline["status"] == "empty"


def test_strict_mode_fails_on_missing_bridge(tmp_path: Path, capsys, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path)
    rc = hooks_status.main([
        "--project-root", str(tmp_path),
        "--manifest", str(dispatch_hook.MANIFEST_PATH),
        "--strict",
        "--format", "json",
    ])
    assert rc == 1
    out = json.loads(capsys.readouterr().out)
    assert out["schema_version"] == 1


def test_strict_mode_passes_when_all_bridges_installed(tmp_path: Path, capsys) -> None:
    # Create every expected bridge so strict mode passes. Copilot is
    # exempt — fallback_only platforms never trip strict.
    bridges_to_create = {
        ".augment/settings.json": "{}",
        ".claude/settings.json": "{}",
        ".cursor/hooks.json": "{}",
        ".windsurf/hooks.json": "{}",
        ".gemini/settings.json": "{}",
    }
    for rel, body in bridges_to_create.items():
        target = tmp_path / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(body, encoding="utf-8")
    cline_dir = tmp_path / ".clinerules" / "hooks"
    cline_dir.mkdir(parents=True)
    (cline_dir / "TaskStart").write_text("#!/bin/sh\n", encoding="utf-8")

    rc = hooks_status.main([
        "--project-root", str(tmp_path),
        "--manifest", str(dispatch_hook.MANIFEST_PATH),
        "--strict",
        "--format", "json",
    ])
    assert rc == 0
    capsys.readouterr()  # drain


def test_table_renders_copilot_degraded_marker(tmp_path: Path, capsys) -> None:
    rc = hooks_status.main([
        "--project-root", str(tmp_path),
        "--manifest", str(dispatch_hook.MANIFEST_PATH),
    ])
    assert rc == 0
    out = capsys.readouterr().out
    assert "copilot" in out
    assert "degraded" in out
    assert "rule-only fallback" in out


def test_json_format_is_parseable(tmp_path: Path, capsys) -> None:
    rc = hooks_status.main([
        "--project-root", str(tmp_path),
        "--manifest", str(dispatch_hook.MANIFEST_PATH),
        "--format", "json",
    ])
    assert rc == 0
    payload = json.loads(capsys.readouterr().out)
    assert "platforms" in payload
    assert {"platform", "status", "bindings"}.issubset(set(payload["platforms"][0]))
