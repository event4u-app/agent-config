"""Tests for ``scripts/_cli/cmd_uninstall.py`` (P2.2)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts._cli import cmd_uninstall  # noqa: E402
from scripts._lib import installed_tools as it  # noqa: E402
from scripts._lib.json_pointers import value_hash  # noqa: E402


def _entry(
    name: str,
    marker: str,
    *,
    scope: str = "project",
    files: list[dict] | None = None,
    merged_keys: list[dict] | None = None,
) -> dict:
    e: dict = {
        "name": name,
        "scope": scope,
        "bridge_marker": marker,
        "installed_at": "2026-05-12",
    }
    if files is not None:
        e["files"] = files
    if merged_keys is not None:
        e["merged_keys"] = merged_keys
    return e


def _write_manifest(tmp_path: Path, entries: list[dict]) -> Path:
    manifest = tmp_path / "agents" / "installed-tools.lock"
    it.write_manifest(manifest, "2.1.0", entries)
    return manifest


def _write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


# ---------------------------------------------------------------------------
# v1 fallback (legacy entry without files[])
# ---------------------------------------------------------------------------


def test_v1_fallback_removes_bridge_marker(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    _write_manifest(tmp_path, [_entry("cursor", ".cursor/hooks.json")])
    marker = tmp_path / ".cursor" / "hooks.json"
    marker.parent.mkdir(parents=True, exist_ok=True)
    marker.write_text("{}", encoding="utf-8")

    rc = cmd_uninstall.main([f"--project={tmp_path}"])
    assert rc == 0
    assert not marker.exists()
    out = capsys.readouterr().out
    assert "removed" in out


# ---------------------------------------------------------------------------
# v2: file deletion by kind
# ---------------------------------------------------------------------------


def test_v2_removes_bridge_and_marker_files(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    bridge = tmp_path / ".cursor" / "hooks.json"
    marker = tmp_path / ".legacy" / "MARKER"
    _write_json(bridge, {})
    marker.parent.mkdir(parents=True, exist_ok=True)
    marker.write_text("x", encoding="utf-8")
    _write_manifest(
        tmp_path,
        [_entry(
            "cursor", ".cursor/hooks.json",
            files=[
                {"path": str(bridge), "kind": "bridge", "sha256": None},
                {"path": str(marker), "kind": "marker", "sha256": None},
            ],
        )],
    )
    rc = cmd_uninstall.main([f"--project={tmp_path}"])
    assert rc == 0
    assert not bridge.exists()
    assert not marker.exists()
    # Manifest entry gone.
    new = it.read_manifest(tmp_path / "agents" / "installed-tools.lock")
    assert new is not None
    assert new["tools"] == []


def test_v2_deployed_preserved_without_purge(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    deployed = tmp_path / ".augment" / "rules" / "r1.md"
    _write_json(deployed.parent / "noop.json", {})
    deployed.write_text("body", encoding="utf-8")
    _write_manifest(
        tmp_path,
        [_entry(
            "augment", ".augment/settings.json",
            files=[{"path": str(deployed), "kind": "deployed", "sha256": None}],
        )],
    )
    rc = cmd_uninstall.main([f"--project={tmp_path}"])
    assert rc == 0
    assert deployed.exists(), "deployed content must survive without --purge"
    out = capsys.readouterr().out
    assert "preserved" in out


def test_v2_deployed_removed_with_purge(tmp_path: Path) -> None:
    deployed_dir = tmp_path / ".augment" / "rules"
    deployed_dir.mkdir(parents=True, exist_ok=True)
    (deployed_dir / "r1.md").write_text("body", encoding="utf-8")
    _write_manifest(
        tmp_path,
        [_entry(
            "augment", ".augment/settings.json",
            files=[{"path": str(deployed_dir), "kind": "deployed", "sha256": None}],
        )],
    )
    rc = cmd_uninstall.main([f"--project={tmp_path}", "--purge"])
    assert rc == 0
    assert not deployed_dir.exists()


# ---------------------------------------------------------------------------
# v2: JSON merge round-trip (the multi-package coexistence killer scenario)
# ---------------------------------------------------------------------------


def test_v2_preserves_foreign_json_keys(tmp_path: Path) -> None:
    """Two packages share .cursor/hooks.json; uninstalling one keeps the other's keys."""
    shared = tmp_path / ".cursor" / "hooks.json"
    payload = {
        "hooks": {
            "agent-config": {"cmd": "echo a"},
            "other-package": {"cmd": "echo b"},
        },
    }
    _write_json(shared, payload)
    our_hash = value_hash(payload["hooks"]["agent-config"])
    _write_manifest(
        tmp_path,
        [_entry(
            "cursor", str(shared),
            files=[{"path": str(shared), "kind": "bridge", "sha256": None}],
            merged_keys=[{
                "file": str(shared),
                "json_pointer": "/hooks/agent-config",
                "value_hash": our_hash,
            }],
        )],
    )
    rc = cmd_uninstall.main([f"--project={tmp_path}"])
    assert rc == 0
    assert shared.exists(), "bridge must survive — neighbour package owns keys"
    surviving = json.loads(shared.read_text(encoding="utf-8"))
    assert surviving == {"hooks": {"other-package": {"cmd": "echo b"}}}


def test_v2_removes_empty_bridge_after_subtraction(tmp_path: Path) -> None:
    """Sole owner: subtraction empties the file → bridge is deleted."""
    shared = tmp_path / ".cursor" / "hooks.json"
    payload = {"hooks": {"agent-config": {"cmd": "echo a"}}}
    _write_json(shared, payload)
    our_hash = value_hash(payload["hooks"]["agent-config"])
    _write_manifest(
        tmp_path,
        [_entry(
            "cursor", str(shared),
            files=[{"path": str(shared), "kind": "bridge", "sha256": None}],
            merged_keys=[{
                "file": str(shared),
                "json_pointer": "/hooks/agent-config",
                "value_hash": our_hash,
            }],
        )],
    )
    rc = cmd_uninstall.main([f"--project={tmp_path}"])
    assert rc == 0
    assert not shared.exists()


# ---------------------------------------------------------------------------
# Two-phase commit: status='uninstalling' is flushed before deletions
# ---------------------------------------------------------------------------


def test_v2_dry_run_writes_nothing(tmp_path: Path) -> None:
    """--dry-run must not touch disk, manifest, or shared JSON."""
    shared = tmp_path / ".cursor" / "hooks.json"
    payload = {"hooks": {"agent-config": {"cmd": "echo a"}}}
    _write_json(shared, payload)
    our_hash = value_hash(payload["hooks"]["agent-config"])
    manifest_path = _write_manifest(
        tmp_path,
        [_entry(
            "cursor", str(shared),
            files=[{"path": str(shared), "kind": "bridge", "sha256": None}],
            merged_keys=[{
                "file": str(shared),
                "json_pointer": "/hooks/agent-config",
                "value_hash": our_hash,
            }],
        )],
    )
    before = manifest_path.read_text(encoding="utf-8")
    rc = cmd_uninstall.main([f"--project={tmp_path}", "--dry-run"])
    assert rc == 0
    assert shared.exists()
    assert json.loads(shared.read_text(encoding="utf-8")) == payload
    assert manifest_path.read_text(encoding="utf-8") == before
