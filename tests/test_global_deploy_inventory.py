#!/usr/bin/env python3
"""Tests for scripts/_lib/global_deploy_inventory.py (stale reaping).

2026-06 Zed fix follow-up: global deploy anchors are shared directories
(``~/.agents/skills`` holds user-authored Zed skills next to the deployed
bundle), so reaping must delete ONLY paths a previous deploy provably wrote.

Run: python3 -m pytest tests/test_global_deploy_inventory.py -q
"""

import json
import shutil
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src" / "scripts"))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from scripts._lib import global_deploy_inventory as inv  # noqa: E402


# --- inventory_path / load / save ---------------------------------------


def test_inventory_path_honors_env_override(tmp_path):
    override = tmp_path / "custom" / "inv.json"
    p = inv.inventory_path(env={inv.INVENTORY_ENV: str(override)})
    assert p == override


def test_load_inventory_tolerates_missing_and_corrupt(tmp_path):
    missing = tmp_path / "nope.json"
    assert inv.load_inventory(missing) == {
        "schema_version": inv.SCHEMA_VERSION, "tools": {},
    }
    corrupt = tmp_path / "bad.json"
    corrupt.write_text("{not json", encoding="utf-8")
    assert inv.load_inventory(corrupt)["tools"] == {}
    wrong_shape = tmp_path / "shape.json"
    wrong_shape.write_text(json.dumps({"tools": [1, 2]}), encoding="utf-8")
    assert inv.load_inventory(wrong_shape)["tools"] == {}


def test_save_then_load_roundtrip(tmp_path):
    target = tmp_path / "deployed-files.json"
    data = {"schema_version": 1, "tools": {"zedish": {
        "anchor": "/tmp/a", "files": ["skills/x/SKILL.md"]}}}
    inv.save_inventory(data, target)
    assert inv.load_inventory(target) == data


# --- expected_deploy_files ----------------------------------------------


def test_expected_deploy_files_walks_tree_and_resolves_symlinks(tmp_path):
    src = tmp_path / "src" / "skills"
    (src / "alpha").mkdir(parents=True)
    (src / "alpha" / "SKILL.md").write_text("a", encoding="utf-8")
    (src / "beta").mkdir()
    (src / "beta" / "SKILL.md").write_text("b", encoding="utf-8")
    # Symlinked file inside a skill dir resolves to a file entry.
    real = tmp_path / "real.md"
    real.write_text("r", encoding="utf-8")
    (src / "alpha" / "extra.md").symlink_to(real)

    files = inv.expected_deploy_files(src, Path("skills"))
    assert files == {
        "skills/alpha/SKILL.md",
        "skills/alpha/extra.md",
        "skills/beta/SKILL.md",
    }


def test_expected_deploy_files_single_file_source(tmp_path):
    src = tmp_path / "rules.md"
    src.write_text("x", encoding="utf-8")
    assert inv.expected_deploy_files(src, Path(".windsurfrules")) == {
        ".windsurfrules",
    }


def test_expected_deploy_files_missing_source_is_empty(tmp_path):
    assert inv.expected_deploy_files(tmp_path / "ghost", Path("skills")) == set()


# --- reap_stale ----------------------------------------------------------


def _record(tool, anchor, files):
    data = {"schema_version": 1, "tools": {}}
    inv.record_deploy(tool, anchor, set(files), data)
    return data


def test_reap_deletes_only_recorded_orphans(tmp_path):
    anchor = tmp_path / "anchor"
    # Previously deployed (recorded) entries: one stays, one is now stale.
    (anchor / "skills" / "kept").mkdir(parents=True)
    (anchor / "skills" / "kept" / "SKILL.md").write_text("k", encoding="utf-8")
    (anchor / "skills" / "agents-audit").mkdir(parents=True)
    (anchor / "skills" / "agents-audit" / "SKILL.md").write_text(
        "stale colon-named entry", encoding="utf-8")
    # User-authored skill in the SAME shared anchor — never recorded.
    (anchor / "skills" / "my-own-zed-skill").mkdir(parents=True)
    (anchor / "skills" / "my-own-zed-skill" / "SKILL.md").write_text(
        "mine", encoding="utf-8")

    data = _record("zedish", anchor, [
        "skills/kept/SKILL.md", "skills/agents-audit/SKILL.md",
    ])
    deleted = inv.reap_stale(
        "zedish", anchor, {"skills/kept/SKILL.md"}, data,
    )

    assert [p.name for p in deleted] == ["SKILL.md"]
    assert not (anchor / "skills" / "agents-audit").exists(), \
        "stale dir should be pruned once empty"
    assert (anchor / "skills" / "kept" / "SKILL.md").exists()
    assert (anchor / "skills" / "my-own-zed-skill" / "SKILL.md").exists(), \
        "user-authored files must never be touched"


def test_reap_skips_when_no_prior_record(tmp_path):
    anchor = tmp_path / "anchor"
    (anchor / "skills").mkdir(parents=True)
    (anchor / "skills" / "orphan.md").write_text("o", encoding="utf-8")
    data = {"schema_version": 1, "tools": {}}
    assert inv.reap_stale("zedish", anchor, set(), data) == []
    assert (anchor / "skills" / "orphan.md").exists()


def test_reap_skips_when_anchor_moved(tmp_path):
    old_anchor = tmp_path / "old"
    new_anchor = tmp_path / "new"
    (old_anchor / "skills").mkdir(parents=True)
    (old_anchor / "skills" / "gone.md").write_text("g", encoding="utf-8")
    data = _record("zedish", old_anchor, ["skills/gone.md"])
    deleted = inv.reap_stale("zedish", new_anchor, set(), data)
    assert deleted == []
    assert (old_anchor / "skills" / "gone.md").exists()


def test_reap_refuses_traversal_and_absolute_entries(tmp_path):
    anchor = tmp_path / "anchor"
    anchor.mkdir()
    outside = tmp_path / "outside.md"
    outside.write_text("precious", encoding="utf-8")
    data = {"schema_version": 1, "tools": {"zedish": {
        "anchor": str(anchor),
        "files": ["../outside.md", "/etc/hosts", ""],
    }}}
    assert inv.reap_stale("zedish", anchor, set(), data) == []
    assert outside.exists()


def test_reap_never_deletes_directories(tmp_path):
    anchor = tmp_path / "anchor"
    (anchor / "skills" / "weird").mkdir(parents=True)
    # Recorded path now points at a DIRECTORY (user replaced the file).
    data = {"schema_version": 1, "tools": {"zedish": {
        "anchor": str(anchor), "files": ["skills/weird"],
    }}}
    assert inv.reap_stale("zedish", anchor, set(), data) == []
    assert (anchor / "skills" / "weird").is_dir()


def test_record_deploy_upserts_sorted_relative_paths(tmp_path):
    anchor = tmp_path / "anchor"
    anchor.mkdir()
    data = {"schema_version": 1, "tools": {}}
    inv.record_deploy("zedish", anchor, {"b.md", "a.md"}, data)
    entry = data["tools"]["zedish"]
    assert entry["files"] == ["a.md", "b.md"]
    assert Path(entry["anchor"]).expanduser().resolve() == anchor.resolve()


def test_record_deploy_keeps_anchor_unexpanded(tmp_path):
    # GUI/CLI parity + home portability: the `~` form is stored verbatim
    # and only expanded at reap-comparison time.
    data = {"schema_version": 1, "tools": {}}
    inv.record_deploy("zedish", "~/.agents/", {"skills/a.md"}, data)
    assert data["tools"]["zedish"]["anchor"] == "~/.agents/"


# --- end-to-end: two deploys, second reaps the renamed entry -------------


def test_two_deploy_cycle_reaps_renamed_skill(tmp_path):
    src = tmp_path / "pkg" / "skills"
    (src / "agents-audit").mkdir(parents=True)
    (src / "agents-audit" / "SKILL.md").write_text("v1", encoding="utf-8")
    anchor = tmp_path / "anchor"
    inv_path = tmp_path / "deployed-files.json"

    # Deploy 1: copy + record.
    current1 = inv.expected_deploy_files(src, Path("skills"))
    for rel in current1:
        target = anchor / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("v1", encoding="utf-8")
    data = inv.load_inventory(inv_path)
    inv.reap_stale("zedish", anchor, current1, data)
    inv.record_deploy("zedish", anchor, current1, data)
    inv.save_inventory(data, inv_path)

    # Package renames the skill.
    (src / "agents-audit" / "SKILL.md").unlink()
    (src / "agents-audit").rmdir()
    (src / "agents-review").mkdir()
    (src / "agents-review" / "SKILL.md").write_text("v2", encoding="utf-8")

    # Deploy 2: copy + reap + record.
    current2 = inv.expected_deploy_files(src, Path("skills"))
    for rel in current2:
        target = anchor / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("v2", encoding="utf-8")
    data = inv.load_inventory(inv_path)
    deleted = inv.reap_stale("zedish", anchor, current2, data)
    inv.record_deploy("zedish", anchor, current2, data)
    inv.save_inventory(data, inv_path)

    assert len(deleted) == 1
    assert not (anchor / "skills" / "agents-audit").exists()
    assert (anchor / "skills" / "agents-review" / "SKILL.md").exists()


# --- reap_tagged_orphans (marker-based, runs every deploy) ---------------

TAG = "event4u/agent-config"


def _tagged_md(path: Path, name: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        f"---\nname: {name}\npackage: {TAG}\n---\n\nbody\n", encoding="utf-8",
    )


def test_reap_tagged_orphans_only(tmp_path):
    anchor = tmp_path / "anchor"
    # Tagged orphan (e.g. retired 2026-05-13 command-as-skill entry).
    _tagged_md(anchor / "skills" / "dto-creator" / "SKILL.md", "dto-creator")
    # Tagged file still shipped by the current bundle.
    _tagged_md(anchor / "skills" / "kept" / "SKILL.md", "kept")
    # User-authored skill: no package tag — must survive.
    (anchor / "skills" / "my-zed-skill").mkdir(parents=True)
    (anchor / "skills" / "my-zed-skill" / "SKILL.md").write_text(
        "---\nname: my-zed-skill\n---\n\nmine\n", encoding="utf-8")
    # Untagged loose file — must survive.
    (anchor / "skills" / "notes.md").write_text("plain", encoding="utf-8")

    deleted = inv.reap_tagged_orphans(
        anchor, ["skills"], {"skills/kept/SKILL.md"}, TAG,
    )

    assert [p.parent.name for p in deleted] == ["dto-creator"]
    assert not (anchor / "skills" / "dto-creator").exists()
    assert (anchor / "skills" / "kept" / "SKILL.md").exists()
    assert (anchor / "skills" / "my-zed-skill" / "SKILL.md").exists()
    assert (anchor / "skills" / "notes.md").exists()


def test_reap_tagged_orphans_is_idempotent(tmp_path):
    # Second pass over an already-clean tree deletes nothing and raises
    # nothing — the always-run sweep must be safe to repeat every deploy.
    anchor = tmp_path / "anchor"
    _tagged_md(anchor / "skills" / "kept" / "SKILL.md", "kept")
    current = {"skills/kept/SKILL.md"}
    first = inv.reap_tagged_orphans(anchor, ["skills"], current, TAG)
    second = inv.reap_tagged_orphans(anchor, ["skills"], current, TAG)
    assert first == []
    assert second == []
    assert (anchor / "skills" / "kept" / "SKILL.md").exists()


def test_reap_tagged_orphans_ignores_missing_dest_and_other_tags(tmp_path):
    anchor = tmp_path / "anchor"
    _tagged_md(anchor / "skills" / "foreign" / "SKILL.md", "foreign")
    (anchor / "skills" / "foreign" / "SKILL.md").write_text(
        "---\nname: foreign\npackage: someone/else\n---\n\nbody\n",
        encoding="utf-8")
    deleted = inv.reap_tagged_orphans(
        anchor, ["skills", "rules"], set(), TAG,
    )
    assert deleted == []
    assert (anchor / "skills" / "foreign" / "SKILL.md").exists()


# --- integration: install._deploy_global_content reaps via inventory -----


def test_deploy_global_content_reaps_stale_entries(tmp_path, monkeypatch):
    import install  # noqa: WPS433 — sys.path prepared at module top

    pkg = tmp_path / "pkg"
    (pkg / "dist/agent-src/skills/old-skill").mkdir(parents=True)
    (pkg / "dist/agent-src/skills/old-skill/SKILL.md").write_text(
        "v1", encoding="utf-8")
    anchor = tmp_path / "anchor"
    inv_file = tmp_path / "deployed-files.json"
    monkeypatch.setenv(inv.INVENTORY_ENV, str(inv_file))
    monkeypatch.setitem(
        install.USER_SCOPE_PATHS, "tooltest", str(anchor),
    )
    monkeypatch.setitem(
        install.GLOBAL_DEPLOY_SOURCES, "tooltest",
        [("dist/agent-src/skills", "skills")],
    )
    # User-authored skill already living in the shared anchor.
    (anchor / "skills" / "user-own").mkdir(parents=True)
    (anchor / "skills" / "user-own" / "SKILL.md").write_text(
        "mine", encoding="utf-8")

    results = install._deploy_global_content(
        {"tooltest"}, True, pkg, tmp_path / "installed.lock",
    )
    assert results["tooltest"][2] == "deployed"
    assert (anchor / "skills" / "old-skill" / "SKILL.md").exists()

    # Package renames the skill; redeploy must reap the orphan.
    (pkg / "dist/agent-src/skills/old-skill/SKILL.md").unlink()
    (pkg / "dist/agent-src/skills/old-skill").rmdir()
    (pkg / "dist/agent-src/skills/new-skill").mkdir()
    (pkg / "dist/agent-src/skills/new-skill/SKILL.md").write_text(
        "v2", encoding="utf-8")

    results = install._deploy_global_content(
        {"tooltest"}, True, pkg, tmp_path / "installed.lock",
    )
    assert results["tooltest"][2] == "deployed"
    assert not (anchor / "skills" / "old-skill").exists(), \
        "renamed skill's old entry must be reaped"
    assert (anchor / "skills" / "new-skill" / "SKILL.md").exists()
    assert (anchor / "skills" / "user-own" / "SKILL.md").exists(), \
        "user-authored entry in the shared anchor must survive"


def test_deploy_global_content_bootstrap_reaps_pre_inventory_orphans(
        tmp_path, monkeypatch):
    import install  # noqa: WPS433 — sys.path prepared at module top

    pkg = tmp_path / "pkg"
    (pkg / "dist/agent-src/skills/current").mkdir(parents=True)
    (pkg / "dist/agent-src/skills/current/SKILL.md").write_text(
        "---\nname: current\n---\n\nbody\n", encoding="utf-8")
    anchor = tmp_path / "anchor"
    # Pre-inventory legacy state: tagged orphan + user-authored neighbour.
    _tagged_md(anchor / "skills" / "dto-creator" / "SKILL.md", "dto-creator")
    (anchor / "skills" / "user-own").mkdir(parents=True)
    (anchor / "skills" / "user-own" / "SKILL.md").write_text(
        "---\nname: user-own\n---\n\nmine\n", encoding="utf-8")

    monkeypatch.setenv(inv.INVENTORY_ENV, str(tmp_path / "inv.json"))
    monkeypatch.setitem(
        install.USER_SCOPE_PATHS, "tooltest", str(anchor))
    monkeypatch.setitem(
        install.GLOBAL_DEPLOY_SOURCES, "tooltest",
        [("dist/agent-src/skills", "skills")],
    )

    results = install._deploy_global_content(
        {"tooltest"}, True, pkg, tmp_path / "installed.lock",
    )
    assert results["tooltest"][2] == "deployed"
    assert not (anchor / "skills" / "dto-creator").exists(), \
        "pre-inventory tagged orphan must be bootstrap-reaped on first run"
    assert (anchor / "skills" / "user-own" / "SKILL.md").exists()
    assert (anchor / "skills" / "current" / "SKILL.md").exists()


def test_deploy_reaps_tagged_orphan_absent_from_recorded_inventory(
        tmp_path, monkeypatch):
    """Regression: a package-tagged orphan that no inventory ever recorded
    (a pre-inventory deploy leftover, or a post-6.0.0 rename like
    create-pr -> pr/create) must be reaped on redeploy.

    The old code reaped via the inventory diff ONLY once a tool had an
    entry, and ran the tag sweep ONLY when the tool was absent from the
    inventory. So a tagged orphan that the recorded inventory never knew
    about rotted forever. The always-run tag sweep closes that gap.
    """
    import install  # noqa: WPS433 — sys.path prepared at module top

    pkg = tmp_path / "pkg"
    (pkg / "dist/agent-src/skills/current").mkdir(parents=True)
    (pkg / "dist/agent-src/skills/current/SKILL.md").write_text(
        "---\nname: current\n---\n\nbody\n", encoding="utf-8")
    anchor = tmp_path / "anchor"
    monkeypatch.setenv(inv.INVENTORY_ENV, str(tmp_path / "inv.json"))
    monkeypatch.setitem(
        install.USER_SCOPE_PATHS, "tooltest", str(anchor))
    monkeypatch.setitem(
        install.GLOBAL_DEPLOY_SOURCES, "tooltest",
        [("dist/agent-src/skills", "skills")],
    )

    # First deploy: establishes an inventory entry for tooltest.
    install._deploy_global_content(
        {"tooltest"}, True, pkg, tmp_path / "installed.lock",
    )
    assert (anchor / "skills" / "current" / "SKILL.md").exists()

    # Simulate a pre-inventory tagged orphan the recorded inventory never
    # knew about (deployed by an installer predating the sidecar).
    _tagged_md(anchor / "skills" / "create-pr" / "SKILL.md", "create-pr")
    # User-authored neighbour must survive.
    (anchor / "skills" / "user-own").mkdir(parents=True)
    (anchor / "skills" / "user-own" / "SKILL.md").write_text(
        "---\nname: user-own\n---\n\nmine\n", encoding="utf-8")

    # Redeploy: tooltest already has an inventory entry, so reap_stale alone
    # (the old behaviour) would NOT see this orphan. The always-run tag
    # sweep must.
    results = install._deploy_global_content(
        {"tooltest"}, True, pkg, tmp_path / "installed.lock",
    )
    assert results["tooltest"][2] == "deployed"
    assert not (anchor / "skills" / "create-pr").exists(), \
        "tagged orphan absent from recorded inventory must be reaped"
    assert (anchor / "skills" / "current" / "SKILL.md").exists()
    assert (anchor / "skills" / "user-own" / "SKILL.md").exists(), \
        "user-authored entry in the shared anchor must survive"


def test_deploy_reaps_both_inventory_and_tagged_orphans_in_one_pass(
        tmp_path, monkeypatch):
    """Union proof: one redeploy must reap BOTH an inventory-recorded file
    the bundle dropped (``reap_stale`` path) AND a pre-inventory tagged
    orphan the inventory never knew (``reap_tagged_orphans`` path).

    Guards against a regression to the old exclusive ``if/else`` that ran
    only one of the two paths per deploy.
    """
    import install  # noqa: WPS433 — sys.path prepared at module top

    pkg = tmp_path / "pkg"
    (pkg / "dist/agent-src/skills/keep").mkdir(parents=True)
    (pkg / "dist/agent-src/skills/keep/SKILL.md").write_text(
        "---\nname: keep\n---\n\nbody\n", encoding="utf-8")
    (pkg / "dist/agent-src/skills/drop-me").mkdir(parents=True)
    (pkg / "dist/agent-src/skills/drop-me/SKILL.md").write_text(
        "---\nname: drop-me\n---\n\nbody\n", encoding="utf-8")
    anchor = tmp_path / "anchor"
    monkeypatch.setenv(inv.INVENTORY_ENV, str(tmp_path / "inv.json"))
    monkeypatch.setitem(install.USER_SCOPE_PATHS, "tooltest", str(anchor))
    monkeypatch.setitem(
        install.GLOBAL_DEPLOY_SOURCES, "tooltest",
        [("dist/agent-src/skills", "skills")],
    )

    # First deploy records keep + drop-me in the inventory.
    install._deploy_global_content(
        {"tooltest"}, True, pkg, tmp_path / "lock",
    )
    assert (anchor / "skills" / "drop-me" / "SKILL.md").exists()

    # The bundle drops drop-me (a reap_stale target — it was recorded) ...
    shutil.rmtree(pkg / "dist/agent-src/skills/drop-me")
    # ... and a pre-inventory tagged orphan appears that no inventory ever
    # recorded (a reap_tagged_orphans target).
    _tagged_md(anchor / "skills" / "ghost" / "SKILL.md", "ghost")

    install._deploy_global_content(
        {"tooltest"}, True, pkg, tmp_path / "lock",
    )
    assert not (anchor / "skills" / "drop-me").exists(), \
        "inventory-recorded drop must be reaped (reap_stale path)"
    assert not (anchor / "skills" / "ghost").exists(), \
        "pre-inventory tagged orphan must be reaped (reap_tagged_orphans path)"
    assert (anchor / "skills" / "keep" / "SKILL.md").exists()


def test_deploy_real_bundle_reaps_planted_orphan_and_is_idempotent(
        tmp_path, monkeypatch):
    """End-to-end against the REAL dist bundle: deploy actual
    rules+commands+personas, plant a package-tagged orphan under a deployed
    root, redeploy, and assert the orphan is reaped while real shipped files
    survive — then a third pass is a clean no-op.

    Catches packaging / deploy-plan regressions the synthetic tests cannot.
    Bounded and fast (~0.2s for ~280 files) so it never blocks CI.
    """
    import install  # noqa: WPS433 — sys.path prepared at module top

    repo_root = Path(__file__).resolve().parent.parent
    if not (repo_root / "dist" / "agent-src" / "rules").is_dir():
        pytest.skip("dist/agent-src bundle not built in this checkout")

    anchor = tmp_path / "anchor"
    monkeypatch.setenv(inv.INVENTORY_ENV, str(tmp_path / "inv.json"))
    monkeypatch.setitem(install.USER_SCOPE_PATHS, "bundletest", str(anchor))
    monkeypatch.setitem(
        install.GLOBAL_DEPLOY_SOURCES, "bundletest",
        [
            ("dist/agent-src/rules", "rules"),
            ("dist/agent-src/commands", "commands"),
            ("dist/agent-src/personas", "personas"),
        ],
    )

    install._deploy_global_content(
        {"bundletest"}, True, repo_root, tmp_path / "lock",
    )
    real_files = list((anchor / "rules").glob("*.md"))
    assert real_files, "real bundle should deploy rule files"
    sentinel = real_files[0]

    # Plant a package-tagged orphan under a deployed root (simulates a
    # renamed/removed artefact from a prior version, e.g. create-pr).
    orphan = anchor / "commands" / "__removed_in_next_version__.md"
    orphan.write_text(
        f"---\nname: gone\npackage: {install.PACKAGE_TAG_ID}\n---\n\nx\n",
        encoding="utf-8",
    )

    install._deploy_global_content(
        {"bundletest"}, True, repo_root, tmp_path / "lock",
    )
    assert not orphan.exists(), \
        "planted tagged orphan must be reaped on redeploy of the real bundle"
    assert sentinel.exists(), "real shipped file must survive reaping"

    # Idempotent third pass: nothing left to reap, no error raised.
    install._deploy_global_content(
        {"bundletest"}, True, repo_root, tmp_path / "lock",
    )
    assert sentinel.exists()


# --- dry-run preview (road-to-6.0.0-final-readiness Phase 2) -------------
#
# The reaper gained a `dry_run` mode so `install.py --dry-run` can list
# exactly what a real deploy would remove BEFORE any deletion. The exit
# criterion: the dry-run set equals the live-delete set, and dry-run
# touches nothing on disk.


def test_reap_stale_dry_run_lists_without_deleting(tmp_path):
    anchor = tmp_path / "anchor"
    orphan = anchor / "skills" / "old" / "SKILL.md"
    orphan.parent.mkdir(parents=True)
    orphan.write_text("v1", encoding="utf-8")
    inventory = {
        "schema_version": 1,
        "tools": {"z": {"anchor": str(anchor),
                        "files": ["skills/old/SKILL.md"]}},
    }
    would = inv.reap_stale("z", anchor, set(), inventory, dry_run=True)
    assert would == [anchor.resolve() / "skills" / "old" / "SKILL.md"]
    assert orphan.exists(), "dry_run must NOT delete"


def test_reap_tagged_orphans_dry_run_lists_without_deleting(tmp_path):
    anchor = tmp_path / "anchor"
    _tagged_md(anchor / "skills" / "gone" / "SKILL.md", "gone")
    would = inv.reap_tagged_orphans(
        anchor, ["skills"], set(), TAG, dry_run=True,
    )
    assert [p.parent.name for p in would] == ["gone"]
    assert (anchor / "skills" / "gone" / "SKILL.md").exists(), \
        "dry_run must NOT delete"


def test_dry_run_set_equals_live_delete_set(tmp_path):
    """Exactness: what dry_run reports is precisely what the live run
    removes — for both reaper paths combined."""
    anchor = tmp_path / "anchor"
    # An inventory-tracked orphan (reap_stale path)...
    tracked = anchor / "skills" / "tracked-old" / "SKILL.md"
    tracked.parent.mkdir(parents=True)
    tracked.write_text("v1", encoding="utf-8")
    # ...and a package-tagged orphan with no inventory record (tag-sweep).
    _tagged_md(anchor / "commands" / "tagged-old.md", "tagged-old")
    inventory = {
        "schema_version": 1,
        "tools": {"z": {"anchor": str(anchor),
                        "files": ["skills/tracked-old/SKILL.md"]}},
    }
    preview = set(
        inv.reap_stale("z", anchor, set(), inventory, dry_run=True)
    ) | set(
        inv.reap_tagged_orphans(anchor, ["commands"], set(), TAG, dry_run=True)
    )
    live = set(
        inv.reap_stale("z", anchor, set(), inventory)
    ) | set(
        inv.reap_tagged_orphans(anchor, ["commands"], set(), TAG)
    )
    assert preview == live
    assert not tracked.exists() and not (
        anchor / "commands" / "tagged-old.md"
    ).exists(), "live run removes exactly the previewed set"


# --- named upgrade scenarios (road-to-6.0.0-final-readiness Phase 2) ------


def test_upgrade_5_10_1_to_6_0_0_reaps_pre_inventory_orphans(tmp_path):
    """A 5.10.1 install predates the inventory sidecar, so on the 6.0.0
    deploy `reap_stale` has no prior record and the always-run tag sweep is
    the cleanup path. Plants the three real upgrade-orphan shapes — an old
    `.agent-src`-projected rule, an old wrapper-style command, and a renamed
    command-as-skill entry — and asserts all are reaped while a user file and
    a still-shipped file survive."""
    anchor = tmp_path / "anchor"
    # Pre-6.0.0 leftovers (all package-tagged, none in the current bundle):
    _tagged_md(anchor / "rules" / "legacy-agent-src-rule.md", "legacy")
    _tagged_md(anchor / "commands" / "old-wrapper.md", "old-wrapper")
    _tagged_md(anchor / "skills" / "create-pr" / "SKILL.md", "create-pr")
    # Still-shipped + user-authored survivors:
    _tagged_md(anchor / "skills" / "kept" / "SKILL.md", "kept")
    (anchor / "skills" / "mine").mkdir(parents=True)
    (anchor / "skills" / "mine" / "SKILL.md").write_text(
        "---\nname: mine\n---\n\nuser\n", encoding="utf-8")

    deleted = inv.reap_tagged_orphans(
        anchor, ["rules", "commands", "skills"],
        {"skills/kept/SKILL.md"}, TAG,
    )
    names = sorted(p.name for p in deleted)
    assert names == ["SKILL.md", "legacy-agent-src-rule.md", "old-wrapper.md"]
    assert not (anchor / "rules" / "legacy-agent-src-rule.md").exists()
    assert not (anchor / "commands" / "old-wrapper.md").exists()
    assert not (anchor / "skills" / "create-pr").exists()
    assert (anchor / "skills" / "kept" / "SKILL.md").exists()
    assert (anchor / "skills" / "mine" / "SKILL.md").exists()


def test_staged_upgrade_late_tool_still_cleaned(tmp_path):
    """Partial/staged upgrade: a tool deployed for the first time AFTER the
    global upgrade still gets its pre-existing tagged orphans cleaned,
    because the tag sweep runs on every deploy regardless of inventory
    history."""
    anchor = tmp_path / "anchor"
    _tagged_md(anchor / "skills" / "stale-from-old-tool" / "SKILL.md", "stale")
    # No inventory entry for this anchor at all (late/first deploy).
    deleted = inv.reap_tagged_orphans(anchor, ["skills"], set(), TAG)
    assert [p.parent.name for p in deleted] == ["stale-from-old-tool"]
    assert not (anchor / "skills" / "stale-from-old-tool").exists()


def test_downgrade_reaped_files_do_not_resurrect(tmp_path):
    """Downgrade posture: files a newer deploy reaped stay gone unless the
    older bundle itself ships them. Re-deploying an old bundle re-creates
    only what that bundle ships; an orphan absent from BOTH bundles never
    resurrects."""
    anchor = tmp_path / "anchor"
    inv_path = tmp_path / "inv.json"
    # 6.0.0 deploy reaps a tagged orphan absent from the bundle.
    _tagged_md(anchor / "skills" / "removed" / "SKILL.md", "removed")
    inv.reap_tagged_orphans(anchor, ["skills"], set(), TAG)
    assert not (anchor / "skills" / "removed").exists()
    # "Downgrade" = a later deploy whose bundle also lacks it: still gone.
    inv.reap_tagged_orphans(anchor, ["skills"], set(), TAG)
    assert not (anchor / "skills" / "removed").exists()


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))
