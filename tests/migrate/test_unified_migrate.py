"""Fixture-driven coverage for the unified ``agent-config migrate``.

Phase 4 of ``road-to-one-migrate-command.md``. Each test stages a
consumer dir carrying **every** legacy input signal from
``docs/contracts/migrate-command.md`` (composer entry + npm entry +
managed symlinks pointing into ``vendor/`` / ``node_modules/`` + a v0
``.implement-ticket-state.json`` + flat-and-typed legacy YAML config
+ empty ``agent-config/`` shell), then asserts the action matrix the
contract defines.
"""
from __future__ import annotations

import io
import json
import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from scripts._cli import cmd_migrate as m  # noqa: E402


def _make_v0_state(project: Path) -> None:
    (project / ".implement-ticket-state.json").write_text(
        json.dumps(
            {
                "ticket": {
                    "id": "PROJ-123",
                    "title": "fixture ticket",
                    "body": "fixture body",
                    "acceptance_criteria": ["AC-1"],
                },
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def _stage_fixture(project: Path) -> dict[str, Path]:
    """Stage a consumer carrying every legacy signal.

    Returns a dict of the relative paths used by the fixture so test
    bodies can assert against them.
    """
    # 1. npm entry
    (project / "package.json").write_text(
        json.dumps(
            {
                "name": "fixture-consumer",
                "version": "0.1.0",
                "devDependencies": {
                    "@event4u/agent-config": "^1.0.0",
                    "other-dep": "1.2.3",
                },
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    # 2. composer entry
    (project / "composer.json").write_text(
        json.dumps(
            {
                "name": "fixture/consumer",
                "require": {
                    "event4u/agent-config": "^1.0",
                    "psr/log": "^3.0",
                },
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    # 3. managed symlink pointing into node_modules/
    target = project / "node_modules" / "@event4u" / "agent-config" / ".augment"
    target.mkdir(parents=True)
    os.symlink(target, project / ".augment")
    # 4. v0 work-engine state
    _make_v0_state(project)
    # 5. flat legacy settings
    (project / ".agent-settings.yml").write_text(
        'agent_config_version: "1.0.0"\nlegacy: true\n', encoding="utf-8"
    )
    (project / ".agent-user.yml").write_text(
        "personal:\n  autonomy: on\n", encoding="utf-8"
    )
    # 6. typed-subdir legacy settings
    (project / "settings").mkdir(parents=True, exist_ok=True)
    (project / "settings" / ".agent-settings.yml").write_text(
        'agent_config_version: "1.0.0"\nlegacy_typed: true\n', encoding="utf-8"
    )
    # 7. empty agent-config/ shell
    (project / "agent-config").mkdir(parents=True, exist_ok=True)
    return {
        "project": project,
        "pkg_json": project / "package.json",
        "composer_json": project / "composer.json",
        "v0_state": project / ".implement-ticket-state.json",
        "v1_state": project / ".work-state.json",
        "settings_flat": project / ".agent-settings.yml",
        "user_flat": project / ".agent-user.yml",
        "settings_typed": project / "settings" / ".agent-settings.yml",
        "settings_dir": project / "settings",
        "shell_dir": project / "agent-config",
    }


def _snapshot_tree(root: Path) -> dict[str, bytes]:
    """Return a content map of every regular file + symlink under ``root``.

    Symlinks are recorded by their target string (prefixed `symlink:`).
    Used to assert byte-for-byte equality after ``--dry-run``.
    """
    out: dict[str, bytes] = {}
    for path in sorted(root.rglob("*")):
        rel = str(path.relative_to(root))
        if path.is_symlink():
            target = os.readlink(path)
            out[rel] = f"symlink:{target}".encode("utf-8")
        elif path.is_file():
            out[rel] = path.read_bytes()
        else:
            out[rel] = b"<dir>"
    return out


def _run(argv, project, *, out=None):
    out = out or io.StringIO()
    rc = m.main(argv, cwd=project, out=out)
    return rc, out.getvalue()


def test_full_apply_sweeps_every_signal(tmp_path):
    paths = _stage_fixture(tmp_path)
    rc, stdout = _run([], tmp_path)
    assert rc == 0, stdout

    # npm entry removed; sibling key preserved.
    pkg_data = json.loads(paths["pkg_json"].read_text(encoding="utf-8"))
    assert "@event4u/agent-config" not in pkg_data.get("devDependencies", {})
    assert pkg_data["devDependencies"]["other-dep"] == "1.2.3"

    # composer entry removed; sibling key preserved.
    composer_data = json.loads(paths["composer_json"].read_text(encoding="utf-8"))
    assert "event4u/agent-config" not in composer_data.get("require", {})
    assert composer_data["require"]["psr/log"] == "^3.0"

    # Legacy symlink purged.
    assert not (tmp_path / ".augment").exists()

    # v0 state migrated; .bak preserved.
    assert paths["v1_state"].is_file()
    assert (tmp_path / ".implement-ticket-state.json.bak").is_file()
    assert not paths["v0_state"].exists()
    v1_payload = json.loads(paths["v1_state"].read_text(encoding="utf-8"))
    assert v1_payload["version"] == 1
    assert v1_payload["input"]["kind"] == "ticket"
    assert v1_payload["input"]["data"]["id"] == "PROJ-123"

    # Every legacy settings file hard-deleted (flat + typed).
    assert not paths["settings_flat"].exists()
    assert not paths["user_flat"].exists()
    assert not paths["settings_typed"].exists()
    # Empty settings/ dir gone too.
    assert not paths["settings_dir"].exists()

    # Empty agent-config/ shell gone.
    assert not paths["shell_dir"].exists()

    # .gitignore block refreshed.
    gitignore_text = (tmp_path / ".gitignore").read_text(encoding="utf-8")
    assert m.GITIGNORE_BLOCK_START in gitignore_text
    assert ".agent-settings.yml" in gitignore_text

    # Summary lists each action by verb.
    assert "removed @event4u/agent-config from package.json" in stdout
    assert "removed event4u/agent-config from composer.json" in stdout
    assert "removed legacy symlink .augment" in stdout
    assert "migrated .implement-ticket-state.json" in stdout
    assert "deleted legacy config .agent-settings.yml" in stdout
    assert "deleted legacy config .agent-user.yml" in stdout
    assert "deleted legacy config settings/.agent-settings.yml" in stdout
    assert "removed empty agent-config/ shell" in stdout
    assert ".gitignore agent-config block refreshed" in stdout


def test_dry_run_does_not_mutate_filesystem(tmp_path):
    _stage_fixture(tmp_path)
    before = _snapshot_tree(tmp_path)
    rc, stdout = _run(["--dry-run"], tmp_path)
    assert rc == 0
    after = _snapshot_tree(tmp_path)
    # Byte-for-byte identical — no file content drift, no symlinks moved,
    # no directories created or removed.
    assert before == after, "dry-run mutated the filesystem"
    # Summary still describes every action in `would …` voice.
    assert "would remove @event4u/agent-config from package.json" in stdout
    assert "would remove event4u/agent-config from composer.json" in stdout
    assert "would remove legacy symlink .augment" in stdout
    assert "would migrate .implement-ticket-state.json" in stdout
    assert "would delete legacy config .agent-settings.yml" in stdout
    assert "would delete legacy config .agent-user.yml" in stdout
    assert "would delete legacy config settings/.agent-settings.yml" in stdout
    assert "would remove empty agent-config/ shell" in stdout
    assert "would refresh .gitignore agent-config block" in stdout


def test_idempotent_second_run_is_no_op(tmp_path):
    _stage_fixture(tmp_path)
    rc1, _ = _run([], tmp_path)
    assert rc1 == 0
    before = _snapshot_tree(tmp_path)
    rc2, stdout = _run([], tmp_path)
    assert rc2 == 0
    assert "already migrated" in stdout
    after = _snapshot_tree(tmp_path)
    # Second run touches nothing.
    assert before == after, "idempotent re-run mutated the filesystem"


def test_clean_repo_short_circuits(tmp_path):
    """A bare consumer with no legacy signals exits 0 without writes."""
    rc, stdout = _run([], tmp_path)
    assert rc == 0
    assert "already migrated" in stdout
    # No artefacts created (not even .gitignore).
    assert not (tmp_path / ".gitignore").exists()


# ---- Step 18: --check + --from ----

def test_check_on_clean_repo_exits_zero(tmp_path):
    """`--check` on a 6.0-layout consumer reports clean + exits 0, no writes."""
    before = _snapshot_tree(tmp_path)
    rc, stdout = _run(["--check"], tmp_path)
    assert rc == 0, stdout
    assert "on the 6.0 layout" in stdout
    assert _snapshot_tree(tmp_path) == before


def test_check_on_legacy_repo_exits_two(tmp_path):
    """`--check` on a legacy install reports pending actions + exits 2, no writes."""
    _stage_fixture(tmp_path)
    before = _snapshot_tree(tmp_path)
    rc, stdout = _run(["--check"], tmp_path)
    assert rc == 2, stdout
    assert "legacy install detected" in stdout
    assert "pending action(s)" in stdout
    # Probe must not mutate the filesystem.
    assert _snapshot_tree(tmp_path) == before, "--check mutated the filesystem"


def test_check_and_dry_run_are_mutually_exclusive(tmp_path):
    """argparse rejects --check + --dry-run together (SystemExit 2)."""
    with pytest.raises(SystemExit):
        m.main(["--check", "--dry-run"], cwd=tmp_path, out=io.StringIO())


def test_from_major_echoed_and_mismatch_noted(tmp_path):
    """`--from 5` on a composer-only legacy install echoes the major and notes
    the missing npm signal, but still migrates from the detected signals."""
    # composer-only fixture (no package.json agent-config entry).
    (tmp_path / "composer.json").write_text(
        json.dumps({"name": "f/c", "require": {"event4u/agent-config": "^1.0"}}, indent=2)
        + "\n",
        encoding="utf-8",
    )
    rc, stdout = _run(["--dry-run", "--from", "5"], tmp_path)
    assert rc == 0, stdout
    assert "declared source major: 5.x" in stdout
    assert "--from 5 declared but no package.json" in stdout
    assert "would remove event4u/agent-config from composer.json" in stdout


def test_from_rejects_unknown_major(tmp_path):
    """`--from 3` is not in the {4,5} choice set → argparse SystemExit."""
    with pytest.raises(SystemExit):
        m.main(["--from", "3"], cwd=tmp_path, out=io.StringIO())
