"""End-to-end coexistence scenario (Phase 1–5 acceptance, multi-package roadmap).

Two synthetic packages (``pkg_a`` and ``pkg_b``) deploy distinct files
into one temp project. Each writes its own ``tools[]`` entry in the
shared ``agents/installed-tools.lock``. The test verifies the isolation
property the roadmap's acceptance block calls out:

    > uninstalling one leaves the other untouched, prune on the survivor
    > reports zero orphans, doctor reports clean.

Exercises the real CLI mains of ``cmd_uninstall``, ``cmd_prune``, and
``cmd_doctor`` against an isolated temp project (``--project=<path>``).
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts._cli import cmd_doctor, cmd_prune, cmd_uninstall  # noqa: E402
from scripts._lib import installed_tools as it  # noqa: E402


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _write_file(root: Path, rel: str, content: bytes) -> tuple[Path, dict]:
    target = root / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    return target, {"path": rel, "kind": "deployed", "sha256": _sha(content)}


def _entry(name: str, files: list[dict]) -> dict:
    return {
        "name": name,
        "scope": "project",
        "bridge_marker": f".{name}/marker",
        "installed_at": "2026-05-12",
        "files": files,
    }


def test_two_packages_coexist_then_one_uninstall_keeps_other_intact(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    proj = tmp_path / "proj"
    proj.mkdir()

    # --- pkg_a footprint ---------------------------------------------
    a_body = b"pkg-a rule body\n"
    a_path, a_meta = _write_file(proj, ".augment/rules/a1.md", a_body)
    a_marker = proj / ".augment" / "marker"
    a_marker.parent.mkdir(parents=True, exist_ok=True)
    a_marker.write_text("a")

    # --- pkg_b footprint ---------------------------------------------
    b_body = b"pkg-b rule body\n"
    b_path, b_meta = _write_file(proj, ".cursor/rules/b1.md", b_body)
    b_marker = proj / ".cursor" / "marker"
    b_marker.parent.mkdir(parents=True, exist_ok=True)
    b_marker.write_text("b")

    # --- shared manifest, one entry per package ----------------------
    manifest_path = it.manifest_path(proj)
    it.write_manifest(
        manifest_path,
        "2.1.0",
        [
            {**_entry("pkg-a", [a_meta]), "bridge_marker": ".augment/marker"},
            {**_entry("pkg-b", [b_meta]), "bridge_marker": ".cursor/marker"},
        ],
        deploy_roots=[".augment/rules", ".cursor/rules"],
    )

    # --- baseline doctor: both healthy -------------------------------
    rc = cmd_doctor.main([f"--project={proj}", "--json"])
    out = json.loads(capsys.readouterr().out)
    assert rc == 0, out
    assert out["missing"] == []
    assert out["modified"] == []
    assert out["tag_drift"] == []
    # foreign may list the markers; the property we care about is no
    # missing/modified/tag-drift across both pkg-a and pkg-b entries.

    # --- uninstall pkg-b (with --purge to fully remove deployed) -----
    rc = cmd_uninstall.main([
        f"--project={proj}", "--tools=pkg-b", "--purge",
    ])
    capsys.readouterr()
    assert rc == 0

    # v2 uninstall + --purge removes pkg-b's deployed file. pkg-a's
    # deployed file + marker are untouched (isolation property).
    assert not b_path.exists()
    assert a_path.exists() and a_path.read_bytes() == a_body
    assert a_marker.exists()

    # Manifest entry for pkg-b is gone; pkg-a survives.
    survivor = it.read_manifest(manifest_path)
    assert survivor is not None
    surviving_names = {e["name"] for e in survivor.get("tools", [])
                       if e.get("status", "installed") == "installed"}
    assert surviving_names == {"pkg-a"}

    # --- prune on the survivor reports zero orphans ------------------
    # pkg-a still owns its declared file; prune surveys deploy_roots
    # against the remaining declared set and finds nothing extraneous.
    rc = cmd_prune.main([f"--project={proj}"])
    capsys.readouterr()
    assert rc == 0

    # --- doctor on the survivor: clean -------------------------------
    rc = cmd_doctor.main([f"--project={proj}", "--json"])
    out = json.loads(capsys.readouterr().out)
    assert rc == 0
    assert out["missing"] == []
    assert out["modified"] == []
    assert out["tag_drift"] == []


# ---------------------------------------------------------------------------
# Shared-JSON-merge coexistence (P3.3 — merged_keys subtraction)
# ---------------------------------------------------------------------------


def test_two_packages_share_hooks_json_uninstall_preserves_neighbour_keys(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    """Two packages each contribute a top-level key to .cursor/hooks.json
    via ``merged_keys[]``. Uninstalling pkg-b removes only pkg-b's key
    and leaves pkg-a's contribution intact; the file is preserved (not
    deleted) because foreign keys survive subtraction."""
    proj = tmp_path / "proj"
    proj.mkdir()
    hooks_rel = ".cursor/hooks.json"

    # Shared JSON: both packages own one top-level key each.
    hooks_path = proj / hooks_rel
    hooks_path.parent.mkdir(parents=True, exist_ok=True)
    hooks_doc = {
        "pkg-a-hook": {"command": "echo a"},
        "pkg-b-hook": {"command": "echo b"},
    }
    hooks_path.write_text(json.dumps(hooks_doc, indent=2) + "\n", encoding="utf-8")

    # Each tool registers its single pointer + the shared file as a
    # "bridge" entry (existence-tracked). merged_keys carries the
    # ownership claim that drives subtract_pointers on uninstall.
    a_bridge_meta = {"path": hooks_rel, "kind": "bridge", "sha256": None}
    b_bridge_meta = {"path": hooks_rel, "kind": "bridge", "sha256": None}

    manifest_path = it.manifest_path(proj)
    it.write_manifest(
        manifest_path,
        "2.1.0",
        [
            {
                **_entry("pkg-a", [a_bridge_meta]),
                "bridge_marker": hooks_rel,
                "merged_keys": [
                    {"file": hooks_rel, "json_pointer": "/pkg-a-hook"},
                ],
            },
            {
                **_entry("pkg-b", [b_bridge_meta]),
                "bridge_marker": hooks_rel,
                "merged_keys": [
                    {"file": hooks_rel, "json_pointer": "/pkg-b-hook"},
                ],
            },
        ],
        deploy_roots=[".cursor"],
    )

    # Uninstall pkg-b — purge so JSON subtraction runs (no --force needed).
    rc = cmd_uninstall.main([f"--project={proj}", "--tools=pkg-b"])
    capsys.readouterr()
    assert rc == 0

    # Shared file still exists; pkg-a's key untouched, pkg-b's key gone.
    assert hooks_path.exists(), "shared file deleted despite surviving foreign keys"
    survived = json.loads(hooks_path.read_text(encoding="utf-8"))
    assert "pkg-a-hook" in survived
    assert survived["pkg-a-hook"] == {"command": "echo a"}
    assert "pkg-b-hook" not in survived

    # Manifest: only pkg-a remains in installed state.
    state = it.read_manifest(manifest_path)
    assert state is not None
    healthy = {e["name"] for e in state.get("tools", [])
               if e.get("status", "installed") == "installed"}
    assert healthy == {"pkg-a"}


def test_uninstalling_last_owner_of_shared_json_deletes_file(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    """When the uninstall would empty the shared JSON document (no
    foreign keys remain), the bridge file is deleted — there is nothing
    for a neighbour to inherit."""
    proj = tmp_path / "proj"
    proj.mkdir()
    hooks_rel = ".cursor/hooks.json"

    hooks_path = proj / hooks_rel
    hooks_path.parent.mkdir(parents=True, exist_ok=True)
    hooks_path.write_text(
        json.dumps({"pkg-a-hook": {"command": "echo a"}}, indent=2) + "\n",
        encoding="utf-8",
    )

    manifest_path = it.manifest_path(proj)
    it.write_manifest(
        manifest_path,
        "2.1.0",
        [
            {
                **_entry("pkg-a", [{"path": hooks_rel, "kind": "bridge", "sha256": None}]),
                "bridge_marker": hooks_rel,
                "merged_keys": [
                    {"file": hooks_rel, "json_pointer": "/pkg-a-hook"},
                ],
            },
        ],
        deploy_roots=[".cursor"],
    )

    rc = cmd_uninstall.main([f"--project={proj}", "--tools=pkg-a"])
    capsys.readouterr()
    assert rc == 0

    assert not hooks_path.exists(), "sole-owner uninstall left empty JSON behind"


# ---------------------------------------------------------------------------
# Deployed-file overwrite (a setup always applies our own content)
# ---------------------------------------------------------------------------


def test_deployed_file_always_overwrites_regardless_of_manifest(
    tmp_path: Path,
) -> None:
    """A deliberate setup overwrites our own deployed files, always.

    Regression for the wizard-apply abort: every file the installer
    writes comes from our own source tree, so whether the manifest
    records it is irrelevant — the resolver always returns ``"write"``.
    There is no foreign-file gate, no ``--force`` requirement, and the
    ``AGENT_CONFIG_ALLOW_OVERWRITE`` escape hatch (plus ``ConflictAbort``)
    no longer exist.
    """
    sys.path.insert(0, str(ROOT / "src" / "scripts"))
    import install  # type: ignore

    proj = tmp_path / "proj"
    proj.mkdir()
    # An existing file the manifest never recorded ("foreign" under the
    # old gate) and a brand-new path both resolve to a write.
    untracked_path, _ = _write_file(proj, ".augment/rules/squatter.md", b"older copy of ours\n")
    fresh_path = proj / ".augment/rules/new.md"

    assert install._resolve_file_conflict(untracked_path, force_hint=False) == "write"
    assert install._resolve_file_conflict(fresh_path, force_hint=False) == "write"

    # The removed escape hatch and abort exception are gone for good.
    assert not hasattr(install, "ALLOW_OVERWRITE_ENV")
    assert not hasattr(install, "ConflictAbort")
