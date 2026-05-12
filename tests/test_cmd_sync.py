"""Tests for ``scripts/_cli/cmd_sync.py`` (ADR-008 Phase 3.3)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts._cli import cmd_sync  # noqa: E402
from scripts._lib import installed_tools as it  # noqa: E402


def _write_manifest(path: Path, entries: list[dict]) -> None:
    it.write_manifest(path, "2.1.0", entries)


def _entry(name: str, scope: str, marker: str) -> dict:
    return {
        "name": name,
        "scope": scope,
        "bridge_marker": marker,
        "installed_at": "2026-05-12",
    }


# ---------------------------------------------------------------------------
# missing / empty manifest
# ---------------------------------------------------------------------------


def test_missing_manifest_returns_1(tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
    rc = cmd_sync.main([f"--project={tmp_path}"])
    assert rc == 1
    assert "No manifest found" in capsys.readouterr().out


def test_empty_manifest_returns_0(tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
    manifest = tmp_path / "agents" / "installed-tools.lock"
    _write_manifest(manifest, [])
    rc = cmd_sync.main([f"--project={tmp_path}"])
    assert rc == 0
    assert "Manifest is empty" in capsys.readouterr().out


# ---------------------------------------------------------------------------
# marker resolution
# ---------------------------------------------------------------------------


def test_marker_exists_project_relative(tmp_path: Path) -> None:
    (tmp_path / ".roo" / "rules").mkdir(parents=True)
    (tmp_path / ".roo" / "rules" / "agent-config.md").write_text("ok", encoding="utf-8")
    assert cmd_sync._marker_exists(tmp_path, ".roo/rules/agent-config.md", "project")


def test_marker_missing_project_relative(tmp_path: Path) -> None:
    assert not cmd_sync._marker_exists(tmp_path, ".roo/rules/agent-config.md", "project")


def test_marker_global_expands_tilde(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HOME", str(tmp_path))
    (tmp_path / ".aider.conf.yml").write_text("ok", encoding="utf-8")
    assert cmd_sync._marker_exists(tmp_path, "~/.aider.conf.yml", "global")


def test_marker_global_missing(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HOME", str(tmp_path))
    assert not cmd_sync._marker_exists(tmp_path, "~/.aider.conf.yml", "global")


# ---------------------------------------------------------------------------
# all present → no-op exit 0
# ---------------------------------------------------------------------------


def test_all_present_no_op(tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
    manifest = tmp_path / "agents" / "installed-tools.lock"
    marker = tmp_path / ".roo" / "rules" / "agent-config.md"
    marker.parent.mkdir(parents=True)
    marker.write_text("ok", encoding="utf-8")
    _write_manifest(manifest, [_entry("roocode", "project", ".roo/rules/agent-config.md")])
    rc = cmd_sync.main([f"--project={tmp_path}"])
    out = capsys.readouterr().out
    assert rc == 0
    assert "All bridges already installed" in out


# ---------------------------------------------------------------------------
# dry-run reports without invoking the installer
# ---------------------------------------------------------------------------


def test_dry_run_lists_missing(
    tmp_path: Path,
    capsys: pytest.CaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    manifest = tmp_path / "agents" / "installed-tools.lock"
    _write_manifest(
        manifest,
        [_entry("roocode", "project", ".roo/rules/agent-config.md")],
    )
    called: list[list[str]] = []
    monkeypatch.setattr(cmd_sync, "install_main", lambda argv: called.append(argv) or 0)
    rc = cmd_sync.main([f"--project={tmp_path}", "--dry-run"])
    out = capsys.readouterr().out
    assert rc == 0
    assert "roocode" in out
    assert "missing" in out
    assert "Dry-run" in out
    assert called == []  # installer must not run on dry-run


# ---------------------------------------------------------------------------
# replay groups by scope and forwards correctly
# ---------------------------------------------------------------------------


def test_replay_groups_by_scope(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    manifest = tmp_path / "agents" / "installed-tools.lock"
    _write_manifest(
        manifest,
        [
            _entry("roocode", "project", ".roo/rules/agent-config.md"),
            _entry("aider",   "project", ".aider/agent-config.md"),
            _entry("cursor",  "global",  "~/.cursor/"),
        ],
    )
    monkeypatch.setenv("HOME", str(tmp_path / "home_void"))

    captured: list[list[str]] = []
    monkeypatch.setattr(cmd_sync, "install_main", lambda argv: captured.append(argv) or 0)
    rc = cmd_sync.main([f"--project={tmp_path}"])

    assert rc == 0
    # First call is project scope (both project tools batched).
    project_call = captured[0]
    assert "--scope=project" in project_call
    tools_arg = next(a for a in project_call if a.startswith("--tools="))
    assert sorted(tools_arg.removeprefix("--tools=").split(",")) == ["aider", "roocode"]
    assert any(a.startswith(f"--project={tmp_path}") for a in project_call)
    # Second call is global scope.
    global_call = captured[1]
    assert "--scope=global" in global_call
    assert "--tools=cursor" in global_call


def test_replay_failure_short_circuits(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture,
) -> None:
    manifest = tmp_path / "agents" / "installed-tools.lock"
    _write_manifest(
        manifest,
        [
            _entry("roocode", "project", ".roo/rules/agent-config.md"),
            _entry("cursor",  "global",  "~/.cursor/"),
        ],
    )
    monkeypatch.setenv("HOME", str(tmp_path / "home_void"))

    calls: list[list[str]] = []

    def fake_install(argv: list[str]) -> int:
        calls.append(argv)
        return 1  # simulate failure

    monkeypatch.setattr(cmd_sync, "install_main", fake_install)
    rc = cmd_sync.main([f"--project={tmp_path}"])

    assert rc == 1
    assert len(calls) == 1  # global call must not run after project fails
    assert "Installer failed" in capsys.readouterr().out
