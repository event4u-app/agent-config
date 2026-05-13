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


def test_all_missing_lock_removes_every_known_marker(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    """P2.4: with no lockfile and --all-missing-lock, every PROJECT_BRIDGE_MARKERS path
    present on disk is pruned via the legacy disk-scan path (pre-manifest fallback)."""
    from scripts.install import PROJECT_BRIDGE_MARKERS
    touched: list[Path] = []
    for rel in PROJECT_BRIDGE_MARKERS.values():
        touched.append(_touch(tmp_path, rel))
    rc = cmd_prune.main([f"--project={tmp_path}", "--all-missing-lock"])
    assert rc == 0
    for path in touched:
        assert not path.exists(), f"expected {path} to be pruned"


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


# ---------------------------------------------------------------------------
# Schema v2 — manifest files[] inventory (P2.1)
# ---------------------------------------------------------------------------


def _entry_v2(name: str, marker: str, *, files: list[dict] | None = None,
              status: str | None = None, scope: str = "project") -> dict:
    entry = _entry(name, marker, scope)
    if files is not None:
        entry["files"] = files
    if status is not None:
        entry["status"] = status
    return entry


def test_v2_status_uninstalling_files_are_orphaned(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    """P2.2 forward-compat: tool with status='uninstalling' surfaces files[] as orphans."""
    _touch(tmp_path, ".cursor/hooks.json")
    _write_manifest(tmp_path, [
        _entry_v2(
            "cursor", ".cursor/hooks.json",
            status="uninstalling",
            files=[{"path": ".cursor/hooks.json", "kind": "bridge", "sha256": None}],
        ),
    ])
    rc = cmd_prune.main([f"--project={tmp_path}"])
    assert rc == 0
    assert not (tmp_path / ".cursor" / "hooks.json").exists()
    out = capsys.readouterr().out
    assert "1 orphaned" in out
    assert "cursor" in out


def test_v2_installed_tool_with_files_is_not_orphaned(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    """Healthy v2 entry (status=installed, files[] populated) → no orphan."""
    _touch(tmp_path, ".cursor/hooks.json")
    _write_manifest(tmp_path, [
        _entry_v2(
            "cursor", ".cursor/hooks.json",
            files=[{"path": ".cursor/hooks.json", "kind": "bridge", "sha256": None}],
        ),
    ])
    rc = cmd_prune.main([f"--project={tmp_path}"])
    assert rc == 0
    assert (tmp_path / ".cursor" / "hooks.json").exists()
    out = capsys.readouterr().out
    assert "no orphaned bridges" in out


def test_v2_deduplicates_disk_scan_and_manifest_scan(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    """Disk-scan + manifest-scan must not surface the same path twice."""
    _touch(tmp_path, ".cursor/hooks.json")
    _write_manifest(tmp_path, [
        _entry_v2(
            "cursor", ".cursor/hooks.json",
            status="uninstalling",
            files=[{"path": ".cursor/hooks.json", "kind": "bridge", "sha256": None}],
        ),
    ])
    rc = cmd_prune.main([f"--project={tmp_path}", "--dry-run", "--json"])
    assert rc == 0
    payload = json.loads(capsys.readouterr().out)
    paths = [o["path"] for o in payload["orphans"]]
    assert paths.count(".cursor/hooks.json") == 1


def test_v2_marker_kind_outside_bridge_markers_is_orphaned(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    """files[] of kind 'marker' for uninstalling tool gets pruned even when not in PROJECT_BRIDGE_MARKERS."""
    _touch(tmp_path, ".legacy-sentinel/MARKER")
    _write_manifest(tmp_path, [
        _entry_v2(
            "cursor", ".legacy-sentinel/MARKER",
            status="uninstalling",
            files=[{"path": ".legacy-sentinel/MARKER", "kind": "marker", "sha256": None}],
        ),
    ])
    rc = cmd_prune.main([f"--project={tmp_path}"])
    assert rc == 0
    assert not (tmp_path / ".legacy-sentinel" / "MARKER").exists()


def test_v2_deployed_drift_is_modified_not_orphan(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    """P2.3: deployed file with mismatching sha256 surfaces as modified, skip delete."""
    _touch(tmp_path, ".augment/rules/r1.md")
    _write_manifest(tmp_path, [
        _entry_v2(
            "augment", ".augment/PROJECT_MANAGED_BY_AGENT_CONFIG",
            status="uninstalling",
            files=[{"path": ".augment/rules/r1.md", "kind": "deployed",
                    "sha256": "00" * 32}],
        ),
    ])
    rc = cmd_prune.main([f"--project={tmp_path}"])
    assert rc == 0
    # Drift detection: user-edited file is preserved
    assert (tmp_path / ".augment" / "rules" / "r1.md").exists()
    out = capsys.readouterr().out
    assert "modified" in out
    assert "skipped" in out


def test_v2_deployed_matching_sha_is_pruned(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    """P2.3: deployed file whose sha matches the manifest is treated as orphan + removed."""
    target = _touch(tmp_path, ".augment/rules/r1.md")
    import hashlib
    sha = hashlib.sha256(target.read_bytes()).hexdigest()
    _write_manifest(tmp_path, [
        _entry_v2(
            "augment", ".augment/PROJECT_MANAGED_BY_AGENT_CONFIG",
            status="uninstalling",
            files=[{"path": ".augment/rules/r1.md", "kind": "deployed",
                    "sha256": sha}],
        ),
    ])
    rc = cmd_prune.main([f"--project={tmp_path}"])
    assert rc == 0
    assert not target.exists()
    out = capsys.readouterr().out
    assert "1 orphaned" in out


def test_v2_drift_emits_state_modified_in_json(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    """P2.3: --json payload exposes per-orphan ``state`` (orphan / modified)."""
    _touch(tmp_path, ".augment/rules/r1.md")
    _write_manifest(tmp_path, [
        _entry_v2(
            "augment", ".augment/PROJECT_MANAGED_BY_AGENT_CONFIG",
            status="uninstalling",
            files=[{"path": ".augment/rules/r1.md", "kind": "deployed",
                    "sha256": "deadbeef" * 8}],
        ),
    ])
    rc = cmd_prune.main([f"--project={tmp_path}", "--json"])
    assert rc == 0
    payload = json.loads(capsys.readouterr().out)
    assert len(payload["orphans"]) == 1
    assert payload["orphans"][0]["state"] == "modified"
    assert payload["orphans"][0]["ok"] is True  # skip is not failure
    assert (tmp_path / ".augment" / "rules" / "r1.md").exists()


def test_v1_fallback_when_no_files_in_manifest(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    """Manifests without files[] (legacy v1-shaped) use the disk-scan path unchanged."""
    _write_manifest(tmp_path, [_entry("cursor", ".cursor/hooks.json")])
    _touch(tmp_path, ".cursor/hooks.json")  # declared → keep
    _touch(tmp_path, ".windsurf/hooks.json")  # orphan → remove
    rc = cmd_prune.main([f"--project={tmp_path}"])
    assert rc == 0
    assert (tmp_path / ".cursor" / "hooks.json").exists()
    assert not (tmp_path / ".windsurf" / "hooks.json").exists()
