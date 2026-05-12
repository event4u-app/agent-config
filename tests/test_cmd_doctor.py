"""Tests for ``scripts/_cli/cmd_doctor.py`` (P4)."""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts._cli import cmd_doctor  # noqa: E402
from scripts._lib import installed_tools as it  # noqa: E402


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _entry(
    name: str, *, files: list[dict] | None = None, scope: str = "project",
) -> dict:
    return {
        "name": name,
        "scope": scope,
        "bridge_marker": f".{name}/marker",
        "installed_at": "2026-05-12",
        "files": files or [],
    }


def _write_manifest(
    tmp_path: Path, entries: list[dict], *, deploy_roots: list[str] | None = None,
) -> Path:
    manifest = tmp_path / "agents" / "installed-tools.lock"
    it.write_manifest(manifest, "2.1.0", entries, deploy_roots=deploy_roots)
    return manifest


def _touch(tmp_path: Path, rel: str, content: bytes = b"content") -> Path:
    target = tmp_path / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    return target


# ---------------------------------------------------------------------------
# Hard floor: missing lockfile → exit 2
# ---------------------------------------------------------------------------


def test_missing_lockfile_returns_2(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    rc = cmd_doctor.main([f"--project={tmp_path}"])
    assert rc == 2
    err = capsys.readouterr().err
    assert "no project lockfile" in err


# ---------------------------------------------------------------------------
# Clean state → exit 0
# ---------------------------------------------------------------------------


def test_clean_manifest_no_drift(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    body = b"rule body\n"
    _touch(tmp_path, ".augment/rules/r1.md", body)
    _write_manifest(
        tmp_path,
        [_entry("augment", files=[{
            "path": ".augment/rules/r1.md",
            "kind": "deployed",
            "sha256": _sha(body),
        }])],
        deploy_roots=[".augment/rules"],
    )
    rc = cmd_doctor.main([f"--project={tmp_path}"])
    assert rc == 0
    out = capsys.readouterr().out
    assert "manifest matches filesystem" in out


# ---------------------------------------------------------------------------
# Missing detection
# ---------------------------------------------------------------------------


def test_missing_file_surfaces(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    _write_manifest(
        tmp_path,
        [_entry("augment", files=[{
            "path": ".augment/rules/r1.md",
            "kind": "deployed",
            "sha256": _sha(b"x"),
        }])],
        deploy_roots=[".augment/rules"],
    )
    rc = cmd_doctor.main([f"--project={tmp_path}"])
    assert rc == 1
    out = capsys.readouterr().out
    assert "missing" in out
    assert "r1.md" in out
    assert "sync" in out  # fix hint


# ---------------------------------------------------------------------------
# Modified detection
# ---------------------------------------------------------------------------


def test_modified_file_surfaces(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    original = b"original\n"
    _touch(tmp_path, ".augment/rules/r1.md", b"tampered\n")
    _write_manifest(
        tmp_path,
        [_entry("augment", files=[{
            "path": ".augment/rules/r1.md",
            "kind": "deployed",
            "sha256": _sha(original),
        }])],
        deploy_roots=[".augment/rules"],
    )
    rc = cmd_doctor.main([f"--project={tmp_path}"])
    assert rc == 1
    out = capsys.readouterr().out
    assert "modified" in out
    assert "force" in out  # fix hint


def test_modified_skipped_when_no_sha_recorded(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    """Bridges without recorded sha256 don't trigger modified-drift."""
    _touch(tmp_path, ".augment/rules/r1.md", b"anything")
    _write_manifest(
        tmp_path,
        [_entry("augment", files=[{
            "path": ".augment/rules/r1.md",
            "kind": "bridge",
            "sha256": None,
        }])],
        deploy_roots=[".augment/rules"],
    )
    rc = cmd_doctor.main([f"--project={tmp_path}"])
    assert rc == 0


# ---------------------------------------------------------------------------
# Foreign detection
# ---------------------------------------------------------------------------


def test_foreign_file_surfaces(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    body = b"ours\n"
    _touch(tmp_path, ".augment/rules/ours.md", body)
    _touch(tmp_path, ".augment/rules/foreign.md", b"intruder")
    _write_manifest(
        tmp_path,
        [_entry("augment", files=[{
            "path": ".augment/rules/ours.md",
            "kind": "deployed",
            "sha256": _sha(body),
        }])],
        deploy_roots=[".augment/rules"],
    )
    rc = cmd_doctor.main([f"--project={tmp_path}"])
    assert rc == 1
    out = capsys.readouterr().out
    assert "foreign" in out
    assert "foreign.md" in out
    assert "prune" in out


# ---------------------------------------------------------------------------
# JSON output
# ---------------------------------------------------------------------------


def test_json_output_shape(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    body = b"x\n"
    _touch(tmp_path, ".augment/rules/r1.md", b"tampered")
    _touch(tmp_path, ".augment/rules/foreign.md", b"intruder")
    _write_manifest(
        tmp_path,
        [
            _entry("augment", files=[
                {
                    "path": ".augment/rules/r1.md",
                    "kind": "deployed",
                    "sha256": _sha(body),
                },
                {
                    "path": ".augment/rules/gone.md",
                    "kind": "deployed",
                    "sha256": _sha(body),
                },
            ]),
        ],
        deploy_roots=[".augment/rules"],
    )
    rc = cmd_doctor.main([f"--project={tmp_path}", "--json"])
    assert rc == 1
    payload = json.loads(capsys.readouterr().out)
    assert payload["project_root"] == str(tmp_path)
    assert {p["path"].endswith("gone.md") for p in payload["missing"]} == {True}
    assert {p["path"].endswith("r1.md") for p in payload["modified"]} == {True}
    foreign_paths = [p["path"] for p in payload["foreign"]]
    assert any(p.endswith("foreign.md") for p in foreign_paths)
    # Every entry carries the required keys.
    for cat in ("missing", "modified", "foreign"):
        for item in payload[cat]:
            assert set(item.keys()) >= {"tool", "path", "kind", "fix"}


# ---------------------------------------------------------------------------
# Global-scope entries don't count toward project drift
# ---------------------------------------------------------------------------


def test_global_scope_entries_ignored(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    _write_manifest(
        tmp_path,
        [_entry("augment", scope="global", files=[{
            "path": "~/.augment/rules/g.md",
            "kind": "deployed",
            "sha256": _sha(b"x"),
        }])],
        deploy_roots=[".augment/rules"],
    )
    rc = cmd_doctor.main([f"--project={tmp_path}"])
    assert rc == 0


# ---------------------------------------------------------------------------
# Deploy-roots fallback when manifest omits them
# ---------------------------------------------------------------------------


def test_default_deploy_roots_used_when_absent(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    # Foreign file in a DEFAULT_DEPLOY_ROOTS path, no deploy_roots in manifest.
    _touch(tmp_path, ".cursor/rules/foreign.md", b"intruder")
    _write_manifest(tmp_path, [_entry("cursor", files=[])])
    rc = cmd_doctor.main([f"--project={tmp_path}", "--json"])
    assert rc == 1
    payload = json.loads(capsys.readouterr().out)
    assert any(
        p["path"].endswith("foreign.md") for p in payload["foreign"]
    )


# ---------------------------------------------------------------------------
# Tag-drift detection (P5.2)
# ---------------------------------------------------------------------------


def _tagged(body: str, package: str = "event4u/agent-config") -> bytes:
    return (
        f"---\ntitle: t\npackage: {package}\n---\n{body}".encode("utf-8")
    )


def test_inline_tag_match_no_drift(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    body = _tagged("body\n")
    _touch(tmp_path, ".augment/rules/r1.md", body)
    _write_manifest(
        tmp_path,
        [_entry("augment", files=[{
            "path": ".augment/rules/r1.md",
            "kind": "deployed",
            "sha256": _sha(body),
        }])],
        deploy_roots=[".augment/rules"],
    )
    rc = cmd_doctor.main([f"--project={tmp_path}"])
    assert rc == 0


def test_inline_tag_mismatch_surfaces_drift(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    body = _tagged("body\n", package="someone-else/thing")
    _touch(tmp_path, ".augment/rules/r1.md", body)
    _write_manifest(
        tmp_path,
        [_entry("augment", files=[{
            "path": ".augment/rules/r1.md",
            "kind": "deployed",
            "sha256": _sha(body),
        }])],
        deploy_roots=[".augment/rules"],
    )
    rc = cmd_doctor.main([f"--project={tmp_path}"])
    assert rc == 1
    out = capsys.readouterr().out
    assert "tag-drift" in out
    assert "someone-else/thing" in out


def test_inline_tag_missing_key_surfaces_drift(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    # Frontmatter present but ``package:`` key removed by hand.
    body = b"---\ntitle: t\n---\nbody\n"
    _touch(tmp_path, ".augment/rules/r1.md", body)
    _write_manifest(
        tmp_path,
        [_entry("augment", files=[{
            "path": ".augment/rules/r1.md",
            "kind": "deployed",
            "sha256": _sha(body),
        }])],
        deploy_roots=[".augment/rules"],
    )
    rc = cmd_doctor.main([f"--project={tmp_path}"])
    assert rc == 1
    out = capsys.readouterr().out
    assert "tag-drift" in out


def test_no_frontmatter_not_flagged(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    # P5.1: files without frontmatter are intentionally untagged.
    body = b"# heading only\nbody\n"
    _touch(tmp_path, ".augment/rules/r1.md", body)
    _write_manifest(
        tmp_path,
        [_entry("augment", files=[{
            "path": ".augment/rules/r1.md",
            "kind": "deployed",
            "sha256": _sha(body),
        }])],
        deploy_roots=[".augment/rules"],
    )
    rc = cmd_doctor.main([f"--project={tmp_path}"])
    assert rc == 0


def test_json_output_includes_tag_drift(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    body = _tagged("body\n", package="other/pkg")
    _touch(tmp_path, ".augment/rules/r1.md", body)
    _write_manifest(
        tmp_path,
        [_entry("augment", files=[{
            "path": ".augment/rules/r1.md",
            "kind": "deployed",
            "sha256": _sha(body),
        }])],
        deploy_roots=[".augment/rules"],
    )
    rc = cmd_doctor.main([f"--project={tmp_path}", "--json"])
    assert rc == 1
    payload = json.loads(capsys.readouterr().out)
    assert "tag_drift" in payload
    assert len(payload["tag_drift"]) == 1
    item = payload["tag_drift"][0]
    assert item["expected"] == "event4u/agent-config"
    assert item["found"] == "other/pkg"
    assert set(item.keys()) >= {"tool", "path", "kind", "fix",
                                "expected", "found"}
