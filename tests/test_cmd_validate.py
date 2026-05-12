"""Tests for ``scripts/_cli/cmd_validate.py`` (ADR-008 Phase 3.4)."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts._cli import cmd_validate  # noqa: E402
from scripts._lib import installed_tools as it  # noqa: E402


def _entry(name: str, scope: str, marker: str) -> dict:
    return {
        "name": name,
        "scope": scope,
        "bridge_marker": marker,
        "installed_at": "2026-05-12",
    }


def _write(path: Path, entries: list[dict], version: str = "2.1.0") -> None:
    it.write_manifest(path, version, entries)


# ---------------------------------------------------------------------------
# missing manifest
# ---------------------------------------------------------------------------


def test_missing_manifest_returns_1(tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
    rc = cmd_validate.main([f"--project={tmp_path}"])
    assert rc == 1
    assert "No manifest found" in capsys.readouterr().out


# ---------------------------------------------------------------------------
# clean manifest
# ---------------------------------------------------------------------------


def test_all_markers_present_no_drift(
    tmp_path: Path,
    capsys: pytest.CaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(cmd_validate.installed_lock, "current_package_version", lambda: "2.1.0")
    manifest = tmp_path / "agents" / "installed-tools.lock"
    marker = tmp_path / ".roo" / "rules" / "agent-config.md"
    marker.parent.mkdir(parents=True)
    marker.write_text("ok", encoding="utf-8")
    _write(manifest, [_entry("roocode", "project", ".roo/rules/agent-config.md")])
    rc = cmd_validate.main([f"--project={tmp_path}"])
    out = capsys.readouterr().out
    assert rc == 0
    assert "No drift detected" in out


# ---------------------------------------------------------------------------
# marker missing
# ---------------------------------------------------------------------------


def test_marker_missing_reported(
    tmp_path: Path,
    capsys: pytest.CaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(cmd_validate.installed_lock, "current_package_version", lambda: "2.1.0")
    monkeypatch.setenv("HOME", str(tmp_path / "home_void"))
    manifest = tmp_path / "agents" / "installed-tools.lock"
    _write(manifest, [_entry("aider", "project", ".aider/agent-config.md")])
    rc = cmd_validate.main([f"--project={tmp_path}"])
    out = capsys.readouterr().out
    assert rc == 1
    assert "marker_missing" in out
    assert "aider" in out


# ---------------------------------------------------------------------------
# scope divergence
# ---------------------------------------------------------------------------


def test_scope_divergence_project_missing_but_global_present(
    tmp_path: Path,
    capsys: pytest.CaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(cmd_validate.installed_lock, "current_package_version", lambda: "2.1.0")
    home = tmp_path / "home"
    home.mkdir()
    monkeypatch.setenv("HOME", str(home))
    # roocode project marker missing in repo …
    manifest = tmp_path / "agents" / "installed-tools.lock"
    _write(manifest, [_entry("aider", "project", ".aider/agent-config.md")])
    # … but the global aider conf is there (counterpart).
    (home / ".aider.conf.yml").write_text("ok", encoding="utf-8")
    rc = cmd_validate.main([f"--project={tmp_path}"])
    out = capsys.readouterr().out
    assert rc == 1
    assert "scope_divergence" in out


# ---------------------------------------------------------------------------
# version drift
# ---------------------------------------------------------------------------


def test_version_drift_reported(
    tmp_path: Path,
    capsys: pytest.CaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(cmd_validate.installed_lock, "current_package_version", lambda: "3.0.0")
    manifest = tmp_path / "agents" / "installed-tools.lock"
    marker = tmp_path / ".roo" / "rules" / "agent-config.md"
    marker.parent.mkdir(parents=True)
    marker.write_text("ok", encoding="utf-8")
    _write(manifest, [_entry("roocode", "project", ".roo/rules/agent-config.md")], version="2.1.0")
    rc = cmd_validate.main([f"--project={tmp_path}"])
    out = capsys.readouterr().out
    assert rc == 1
    assert "version_drift" in out
    assert "2.1.0" in out
    assert "3.0.0" in out


def test_skip_version_check_silences_drift(
    tmp_path: Path,
    capsys: pytest.CaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(cmd_validate.installed_lock, "current_package_version", lambda: "3.0.0")
    manifest = tmp_path / "agents" / "installed-tools.lock"
    marker = tmp_path / ".roo" / "rules" / "agent-config.md"
    marker.parent.mkdir(parents=True)
    marker.write_text("ok", encoding="utf-8")
    _write(manifest, [_entry("roocode", "project", ".roo/rules/agent-config.md")], version="2.1.0")
    rc = cmd_validate.main([f"--project={tmp_path}", "--skip-version-check"])
    out = capsys.readouterr().out
    assert rc == 0
    assert "No drift" in out


# ---------------------------------------------------------------------------
# corrupt entry
# ---------------------------------------------------------------------------


def test_corrupt_entry_reported(
    tmp_path: Path,
    capsys: pytest.CaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(cmd_validate.installed_lock, "current_package_version", lambda: "2.1.0")
    manifest = tmp_path / "agents" / "installed-tools.lock"
    _write(manifest, [{"name": "broken", "scope": "", "bridge_marker": "", "installed_at": "x"}])
    rc = cmd_validate.main([f"--project={tmp_path}"])
    out = capsys.readouterr().out
    assert rc == 1
    assert "manifest_corrupt" in out
