"""Tests for ``migrate_legacy_namespace()`` in ``scripts/_lib/user_global_paths.py``.

Phase 3.3 of road-to-event4u-namespace-and-claude-desktop.md. Covers the
auto-migration shim's contract: no-op when new root already has content,
copy when only the legacy tree exists, mode preservation for 0600 key
files, breadcrumb written into the legacy root, and idempotency on a
second invocation.

Path convention: flat ``tests/`` per project layout (sibling of
``test_installed_lock.py`` etc.), not ``tests/_lib/`` as the roadmap
draft initially proposed.
"""
from __future__ import annotations

import stat
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "src" / "scripts"))

from scripts._lib import user_global_paths  # noqa: E402


def _legacy(tmp_path: Path) -> Path:
    legacy = tmp_path / ".config" / "agent-config"
    legacy.mkdir(parents=True)
    return legacy


def _new_root_env(tmp_path: Path) -> tuple[Path, dict]:
    new_root = tmp_path / ".event4u" / "agent-config"
    env = {user_global_paths.EVENT4U_HOME_ENV: str(new_root)}
    return new_root, env


def test_migration_is_noop_when_legacy_missing(tmp_path: Path) -> None:
    new_root, env = _new_root_env(tmp_path)
    legacy = tmp_path / "absent" / "agent-config"  # never created
    migrated = user_global_paths.migrate_legacy_namespace(
        env=env, legacy_root_override=legacy
    )
    assert migrated is False
    assert not new_root.exists()


def test_migration_is_noop_when_legacy_empty(tmp_path: Path) -> None:
    new_root, env = _new_root_env(tmp_path)
    legacy = _legacy(tmp_path)
    migrated = user_global_paths.migrate_legacy_namespace(
        env=env, legacy_root_override=legacy
    )
    assert migrated is False
    assert not new_root.exists()
    assert not (legacy / user_global_paths.MIGRATION_BREADCRUMB_NAME).exists()


def test_migration_copies_files_when_only_legacy_exists(tmp_path: Path) -> None:
    new_root, env = _new_root_env(tmp_path)
    legacy = _legacy(tmp_path)
    (legacy / "agent-settings.yml").write_text("hello: world\n", encoding="utf-8")
    (legacy / "installed.lock").write_text("schema_version: 1\n", encoding="utf-8")
    nested = legacy / "agents" / "global"
    nested.mkdir(parents=True)
    (nested / "note.md").write_text("# note\n", encoding="utf-8")

    migrated = user_global_paths.migrate_legacy_namespace(
        env=env, legacy_root_override=legacy
    )

    assert migrated is True
    assert (new_root / "agent-settings.yml").read_text(encoding="utf-8") == "hello: world\n"
    assert (new_root / "installed.lock").read_text(encoding="utf-8") == "schema_version: 1\n"
    assert (new_root / "agents" / "global" / "note.md").read_text(encoding="utf-8") == "# note\n"


def test_migration_preserves_0600_mode_on_key_files(tmp_path: Path) -> None:
    new_root, env = _new_root_env(tmp_path)
    legacy = _legacy(tmp_path)
    key_path = legacy / "anthropic.key"
    key_path.write_text("sk-ant-secret\n", encoding="utf-8")
    key_path.chmod(0o600)

    migrated = user_global_paths.migrate_legacy_namespace(
        env=env, legacy_root_override=legacy
    )

    assert migrated is True
    copied = new_root / "anthropic.key"
    assert copied.exists()
    mode = stat.S_IMODE(copied.stat().st_mode)
    assert mode == 0o600, f"expected 0o600, got 0o{mode:o}"


def test_migration_writes_breadcrumb_into_legacy_root(tmp_path: Path) -> None:
    new_root, env = _new_root_env(tmp_path)
    legacy = _legacy(tmp_path)
    (legacy / "agent-settings.yml").write_text("x: 1\n", encoding="utf-8")

    user_global_paths.migrate_legacy_namespace(
        env=env, legacy_root_override=legacy
    )

    breadcrumb = legacy / user_global_paths.MIGRATION_BREADCRUMB_NAME
    assert breadcrumb.exists()
    body = breadcrumb.read_text(encoding="utf-8")
    assert "~/.event4u/agent-config" in body
    assert "rm -rf ~/.config/agent-config" in body


def test_migration_is_noop_when_new_root_already_has_content(tmp_path: Path) -> None:
    new_root, env = _new_root_env(tmp_path)
    new_root.mkdir(parents=True)
    (new_root / "agent-settings.yml").write_text("new: 1\n", encoding="utf-8")
    legacy = _legacy(tmp_path)
    (legacy / "agent-settings.yml").write_text("legacy: 1\n", encoding="utf-8")

    migrated = user_global_paths.migrate_legacy_namespace(
        env=env, legacy_root_override=legacy
    )

    assert migrated is False
    # New root not overwritten.
    assert (new_root / "agent-settings.yml").read_text(encoding="utf-8") == "new: 1\n"
    # Breadcrumb still dropped so the user can clean up the legacy tree.
    assert (legacy / user_global_paths.MIGRATION_BREADCRUMB_NAME).exists()


def test_second_invocation_is_noop(tmp_path: Path) -> None:
    new_root, env = _new_root_env(tmp_path)
    legacy = _legacy(tmp_path)
    (legacy / "agent-settings.yml").write_text("once: 1\n", encoding="utf-8")

    first = user_global_paths.migrate_legacy_namespace(
        env=env, legacy_root_override=legacy
    )
    second = user_global_paths.migrate_legacy_namespace(
        env=env, legacy_root_override=legacy
    )

    assert first is True
    assert second is False
    # Breadcrumb still present, only one copy of settings in new root.
    assert (legacy / user_global_paths.MIGRATION_BREADCRUMB_NAME).exists()
    assert (new_root / "agent-settings.yml").read_text(encoding="utf-8") == "once: 1\n"


def test_migration_skips_pre_existing_target_entry(tmp_path: Path) -> None:
    """If new root has a partial subset, existing entries must not be overwritten."""
    new_root, env = _new_root_env(tmp_path)
    new_root.mkdir(parents=True)
    (new_root / "agent-settings.yml").write_text("new: 1\n", encoding="utf-8")
    legacy = _legacy(tmp_path)
    (legacy / "agent-settings.yml").write_text("legacy: 1\n", encoding="utf-8")
    (legacy / "extra.yml").write_text("extra: legacy\n", encoding="utf-8")

    # New root has content → treated as already-migrated; no copy at all.
    migrated = user_global_paths.migrate_legacy_namespace(
        env=env, legacy_root_override=legacy
    )
    assert migrated is False
    assert (new_root / "agent-settings.yml").read_text(encoding="utf-8") == "new: 1\n"
    assert not (new_root / "extra.yml").exists()


def test_migration_recovers_from_partial_copy_leftover(tmp_path: Path) -> None:
    """Crash mid-copytree → next run cleans the .event4u-partial-* debris and retries."""
    new_root, env = _new_root_env(tmp_path)
    new_root.mkdir(parents=True)
    # Simulate a prior interrupted run: only partial-suffixed debris exists,
    # no real entries. The next migration must treat this as "no content"
    # and complete the copy.
    debris = new_root / f"agents{user_global_paths._PARTIAL_SUFFIX}12345"
    debris.mkdir()
    (debris / "halfwritten.md").write_text("partial\n", encoding="utf-8")

    legacy = _legacy(tmp_path)
    (legacy / "agent-settings.yml").write_text("once: 1\n", encoding="utf-8")
    nested = legacy / "agents" / "global"
    nested.mkdir(parents=True)
    (nested / "note.md").write_text("# note\n", encoding="utf-8")

    migrated = user_global_paths.migrate_legacy_namespace(
        env=env, legacy_root_override=legacy
    )

    assert migrated is True
    # Debris from the prior run is purged.
    assert not debris.exists()
    # Real migration completed.
    assert (new_root / "agent-settings.yml").read_text(encoding="utf-8") == "once: 1\n"
    assert (new_root / "agents" / "global" / "note.md").read_text(encoding="utf-8") == "# note\n"
    # No partial siblings remain after success.
    remaining = [p for p in new_root.iterdir() if user_global_paths._PARTIAL_SUFFIX in p.name]
    assert remaining == []
