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



# ---------------------------------------------------------------------------
# Health-check registry (Phase 2 of road-to-surface-discipline)
# ---------------------------------------------------------------------------


def _checks_by_id(payload: dict) -> dict:
    return {c["id"]: c for c in payload.get("checks", [])}


def _run_json(tmp_path: Path, capsys: pytest.CaptureFixture) -> dict:
    cmd_doctor.main([f"--project={tmp_path}", "--json"])
    return json.loads(capsys.readouterr().out)


def _clean_project(tmp_path: Path) -> None:
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


def test_check_registry_emits_all_ids(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    _clean_project(tmp_path)
    payload = _run_json(tmp_path, capsys)
    ids = [c["id"] for c in payload["checks"]]
    assert ids == list(cmd_doctor.CHECK_IDS)
    assert len(ids) == len(cmd_doctor.CHECK_IDS)


def test_check_scope_standalone(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    _clean_project(tmp_path)
    payload = _run_json(tmp_path, capsys)
    scope = _checks_by_id(payload)["scope"]
    assert scope["status"] == "ok"
    assert "standalone" in scope["message"]


def _seed_inventory(tmp_path: Path, monkeypatch, anchor: Path,
                    recorded: list[str]) -> None:
    from scripts._lib import global_deploy_inventory as gdi
    inv_file = tmp_path / "deployed-files.json"
    monkeypatch.setenv(gdi.INVENTORY_ENV, str(inv_file))
    inv = gdi.record_deploy("tooltest", str(anchor), set(recorded), {})
    gdi.save_inventory(inv, inv_file)


def _write_tagged_md(path: Path, name: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        f"---\nname: {name}\npackage: {cmd_doctor.PACKAGE_TAG_ID}\n---\n\nx\n",
        encoding="utf-8",
    )


def test_stale_orphans_ok_when_no_inventory(monkeypatch, tmp_path) -> None:
    from scripts._lib import global_deploy_inventory as gdi
    monkeypatch.setenv(gdi.INVENTORY_ENV, str(tmp_path / "missing.json"))
    result = cmd_doctor._check_stale_orphans()
    assert result["status"] == "ok"


def test_stale_orphans_warns_on_tagged_orphan(monkeypatch, tmp_path) -> None:
    anchor = tmp_path / "anchor"
    _write_tagged_md(anchor / "commands" / "pr" / "create.md", "create")     # recorded
    _write_tagged_md(anchor / "commands" / "create-pr.md", "create-pr")       # orphan
    # User-authored, untagged — must not register.
    (anchor / "commands").mkdir(parents=True, exist_ok=True)
    (anchor / "commands" / "mine.md").write_text(
        "---\nname: mine\n---\n\nx\n", encoding="utf-8")
    _seed_inventory(tmp_path, monkeypatch, anchor, ["commands/pr/create.md"])

    result = cmd_doctor._check_stale_orphans()
    assert result["status"] == "warn"
    assert "create-pr.md" in result["message"]
    assert "agent-config global" in result["remedy"]


def test_stale_orphans_ok_when_clean(monkeypatch, tmp_path) -> None:
    anchor = tmp_path / "anchor"
    _write_tagged_md(anchor / "commands" / "pr" / "create.md", "create")
    _seed_inventory(tmp_path, monkeypatch, anchor, ["commands/pr/create.md"])
    result = cmd_doctor._check_stale_orphans()
    assert result["status"] == "ok"


def test_doctor_pipeline_surfaces_stale_orphans(
    monkeypatch, tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    """End-to-end through ``main`` (--check + --json): the registered
    ``stale-orphans`` check must report ``warn`` when a tagged orphan sits
    under a recorded anchor. Locks the runner-dict wiring, not just the
    bare check function.
    """
    anchor = tmp_path / "anchor"
    _write_tagged_md(anchor / "commands" / "pr" / "create.md", "create")
    _write_tagged_md(anchor / "commands" / "create-pr.md", "create-pr")  # orphan
    _seed_inventory(tmp_path, monkeypatch, anchor, ["commands/pr/create.md"])

    # Global-only consumer (bridge marker, no lockfile) so the no-manifest
    # path runs the global checks — stale-orphans among them.
    project = tmp_path / "proj"
    (project / "agents").mkdir(parents=True)
    (project / "agents" / ".event4u-bridge.yml").write_text(
        "schema: 1\n", encoding="utf-8")

    cmd_doctor.main([
        f"--project={project}", "--check", "stale-orphans", "--json",
    ])
    payload = json.loads(capsys.readouterr().out)
    check = {c["id"]: c for c in payload["checks"]}["stale-orphans"]
    assert check["status"] == "warn"
    assert "create-pr.md" in check["message"]
    assert "agent-config global" in check["remedy"]


def test_check_lockfile_freshness_drift(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    # Manifest writer "2.1.0" vs current package version → warn.
    _clean_project(tmp_path)
    payload = _run_json(tmp_path, capsys)
    fresh = _checks_by_id(payload)["lockfile-freshness"]
    current = cmd_doctor._current_package_version()
    if current == "2.1.0":
        assert fresh["status"] == "ok"
    else:
        assert fresh["status"] == "warn"
        assert "2.1.0" in fresh["message"]
        assert "sync" in fresh["remedy"]


def test_check_bridge_drift_ok(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    _clean_project(tmp_path)
    payload = _run_json(tmp_path, capsys)
    bridge = _checks_by_id(payload)["bridge-drift"]
    assert bridge["status"] == "ok"


def test_check_bridge_drift_fail_on_missing(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    body = b"rule body\n"
    _write_manifest(
        tmp_path,
        [_entry("augment", files=[{
            "path": ".augment/rules/missing.md",
            "kind": "deployed",
            "sha256": _sha(body),
        }])],
        deploy_roots=[".augment/rules"],
    )
    payload = _run_json(tmp_path, capsys)
    bridge = _checks_by_id(payload)["bridge-drift"]
    assert bridge["status"] == "fail"
    assert "missing" in bridge["message"]


def test_check_mcp_mode_absent(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    _clean_project(tmp_path)
    payload = _run_json(tmp_path, capsys)
    mcp = _checks_by_id(payload)["mcp-mode"]
    assert mcp["status"] == "ok"
    assert "no MCP config present" in mcp["message"]


def test_check_mcp_mode_invalid_json(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    _clean_project(tmp_path)
    _touch(tmp_path, ".cursor/mcp.json", b"{not json")
    payload = _run_json(tmp_path, capsys)
    mcp = _checks_by_id(payload)["mcp-mode"]
    assert mcp["status"] == "warn"
    assert "not valid JSON" in mcp["message"]


def test_check_mcp_mode_detects_cursor(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    _clean_project(tmp_path)
    _touch(tmp_path, ".cursor/mcp.json", b'{"servers": {}}')
    payload = _run_json(tmp_path, capsys)
    mcp = _checks_by_id(payload)["mcp-mode"]
    assert mcp["status"] == "ok"
    assert "cursor" in mcp["message"]


def test_check_offline_readiness_present(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    _clean_project(tmp_path)
    payload = _run_json(tmp_path, capsys)
    off = _checks_by_id(payload)["offline-readiness"]
    # This repo ships scripts/hermetic-install.sh, so the check is ok.
    assert off["status"] == "ok"


def test_check_unsupported_combos_ok(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    _clean_project(tmp_path)
    payload = _run_json(tmp_path, capsys)
    combo = _checks_by_id(payload)["unsupported-combos"]
    assert combo["status"] == "ok"



def test_check_mcp_beta_readiness_warn_when_artefacts_missing(
    tmp_path: Path,
) -> None:
    """A bare project has no MCP beta artefacts — all 6 gates pending."""
    result = cmd_doctor._check_mcp_beta_readiness(tmp_path)
    assert result["id"] == "mcp-beta-readiness"
    assert result["status"] == "warn"
    assert "6/6" in result["message"]
    assert "mcp-beta-criteria.md" in result["remedy"]


def test_check_mcp_beta_readiness_ok_when_all_artefacts_present(
    tmp_path: Path,
) -> None:
    """All 6 gate artefacts present → status ok, promotion authorized."""
    for _gate_id, rel in cmd_doctor.MCP_BETA_GATES:
        target = tmp_path / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        if rel.endswith((".js", ".md", ".yml")):
            target.write_text("placeholder", encoding="utf-8")
        else:
            target.mkdir(parents=True, exist_ok=True)
    result = cmd_doctor._check_mcp_beta_readiness(tmp_path)
    assert result["status"] == "ok"
    assert "promotion authorized" in result["message"]
