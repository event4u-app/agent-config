"""Tests for ``scripts/_cli/cmd_prune.py``."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts._cli import cmd_prune  # noqa: E402
from scripts._lib import installed_tools as it  # noqa: E402


def _entry(name: str, marker: str, scope: str = "project") -> dict:
    return {
        "name": name,
        "scope": scope,
        "bridge_marker": marker,
        "installed_at": "2026-05-12",
    }


def _write_manifest(tmp_path: Path, entries: list[dict]) -> Path:
    manifest = tmp_path / "agents" / "installed-tools.lock"
    it.write_manifest(manifest, "2.1.0", entries)
    return manifest


def _touch(tmp_path: Path, rel: str) -> Path:
    target = tmp_path / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("bridge", encoding="utf-8")
    return target


# ---------------------------------------------------------------------------
# Hard floor: missing lockfile
# ---------------------------------------------------------------------------


def test_missing_lockfile_returns_1(tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
    rc = cmd_prune.main([f"--project={tmp_path}"])
    assert rc == 1
    err = capsys.readouterr().err
    assert "no project lockfile" in err
    assert "--all-missing-lock" in err


def test_all_missing_lock_treats_as_empty(tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
    _touch(tmp_path, ".cursor/hooks.json")
    rc = cmd_prune.main([f"--project={tmp_path}", "--all-missing-lock", "--dry-run"])
    assert rc == 0
    out = capsys.readouterr().out
    assert "cursor" in out
    assert "would remove" in out
    # dry-run: file still on disk
    assert (tmp_path / ".cursor" / "hooks.json").exists()


# ---------------------------------------------------------------------------
# No drift → no-op
# ---------------------------------------------------------------------------


def test_clean_project_no_op(tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
    _write_manifest(tmp_path, [_entry("cursor", ".cursor/hooks.json")])
    _touch(tmp_path, ".cursor/hooks.json")
    rc = cmd_prune.main([f"--project={tmp_path}"])
    assert rc == 0
    out = capsys.readouterr().out
    assert "no orphaned bridges" in out
    assert (tmp_path / ".cursor" / "hooks.json").exists()


# ---------------------------------------------------------------------------
# Orphan detection + removal
# ---------------------------------------------------------------------------


def test_removes_orphans_not_in_manifest(tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
    _write_manifest(tmp_path, [_entry("cursor", ".cursor/hooks.json")])
    _touch(tmp_path, ".cursor/hooks.json")  # declared — keep
    _touch(tmp_path, ".roo/rules/agent-config.md")  # orphan — remove
    _touch(tmp_path, ".windsurf/hooks.json")  # orphan — remove
    rc = cmd_prune.main([f"--project={tmp_path}"])
    assert rc == 0
    assert (tmp_path / ".cursor" / "hooks.json").exists()
    assert not (tmp_path / ".roo" / "rules" / "agent-config.md").exists()
    assert not (tmp_path / ".windsurf" / "hooks.json").exists()
    out = capsys.readouterr().out
    assert "2 orphaned" in out


def test_dry_run_lists_but_does_not_remove(tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
    _write_manifest(tmp_path, [])
    _touch(tmp_path, ".roo/rules/agent-config.md")
    rc = cmd_prune.main([f"--project={tmp_path}", "--dry-run"])
    assert rc == 0
    assert (tmp_path / ".roo" / "rules" / "agent-config.md").exists()
    out = capsys.readouterr().out
    assert "[dry-run]" in out
    assert "would remove" in out


def test_global_scope_entries_do_not_protect_project_markers(
    tmp_path: Path, capsys: pytest.CaptureFixture
) -> None:
    # cursor declared global → project marker on disk is still orphaned
    _write_manifest(tmp_path, [_entry("cursor", "~/.cursor/", scope="global")])
    _touch(tmp_path, ".cursor/hooks.json")
    rc = cmd_prune.main([f"--project={tmp_path}"])
    assert rc == 0
    assert not (tmp_path / ".cursor" / "hooks.json").exists()


# ---------------------------------------------------------------------------
# JSON output
# ---------------------------------------------------------------------------


def test_json_emits_machine_payload(tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
    _write_manifest(tmp_path, [])
    _touch(tmp_path, ".roo/rules/agent-config.md")
    rc = cmd_prune.main([f"--project={tmp_path}", "--dry-run", "--json"])
    assert rc == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["dry_run"] is True
    assert payload["project_root"] == str(tmp_path)
    names = {o["tool"] for o in payload["orphans"]}
    assert "roocode" in names
    for orphan in payload["orphans"]:
        assert orphan["ok"] is True
        assert orphan["status"] == "would remove"


def test_json_clean_project_empty_orphans(tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
    _write_manifest(tmp_path, [])
    rc = cmd_prune.main([f"--project={tmp_path}", "--json"])
    assert rc == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["orphans"] == []
