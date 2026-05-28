"""Lifecycle tests for ``agent-config migrate-to-global``.

Phase 5.4 of ``agents/roadmaps/road-to-global-only-install.md``. Covers:

- detection (``install._detect_legacy_for_migration``) with dev-mode and
  source-repo bypasses,
- happy-path forward migration: copy → verify → move → manifest → bridge,
- idempotency: a second run is a no-op once the bridge marker is in
  place,
- refusal to overwrite a non-empty global file without ``--force`` and
  the explicit ``--force`` opt-in,
- mid-step failure on malformed YAML leaves originals untouched,
- rollback restores the project to a byte-identical pre-migration state.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts._cli import cmd_migrate_to_global as mig  # noqa: E402
from scripts import install  # noqa: E402


_SAMPLE_SETTINGS = "cost_profile: minimal\npersonal:\n  ide: phpstorm\n"
_SAMPLE_USER = "name: Matze\nrole: maintainer\n"


def _sha256(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


class _Base(unittest.TestCase):
    """Hermetic per-test global root + isolated project tree."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.tmpdir = Path(self._tmp.name)

        # Stand-in global root inside the tmpdir.
        self.fake_global = self.tmpdir / "global"
        self.fake_settings = self.fake_global / ".agent-settings.yml"
        self.fake_user = self.fake_global / ".agent-user.yml"
        patches = [
            mock.patch.object(install, "GLOBAL_ROOT", self.fake_global),
            mock.patch.object(install, "GLOBAL_AGENT_SETTINGS_PATH", self.fake_settings),
            mock.patch.object(install, "GLOBAL_USER_SETTINGS_PATH", self.fake_user),
        ]
        # Ensure the dev-mode bypass is off so the production code paths run.
        env_patches = mock.patch.dict(
            os.environ, {k: v for k, v in os.environ.items() if k != "AGENT_CONFIG_DEV_MODE"},
            clear=True,
        )
        env_patches.start()
        self.addCleanup(env_patches.stop)
        for p in patches:
            p.start()
            self.addCleanup(p.stop)

        # Project tree with legacy artefacts.
        self.project = self.tmpdir / "project"
        self.project.mkdir()
        (self.project / ".agent-settings.yml").write_text(_SAMPLE_SETTINGS, encoding="utf-8")
        (self.project / ".agent-user.yml").write_text(_SAMPLE_USER, encoding="utf-8")
        (self.project / ".augment").mkdir()
        (self.project / ".augment" / "marker.txt").write_text("legacy\n", encoding="utf-8")


class DetectionTests(_Base):
    def test_detects_yaml_and_dirs(self) -> None:
        found = install._detect_legacy_for_migration(self.project)
        self.assertIn(".agent-settings.yml", found)
        self.assertIn(".agent-user.yml", found)
        self.assertIn(".augment/", found)

    def test_dev_mode_bypasses_detection(self) -> None:
        with mock.patch.dict(os.environ, {"AGENT_CONFIG_DEV_MODE": "1"}):
            self.assertEqual(install._detect_legacy_for_migration(self.project), [])

    def test_source_repo_bypasses_detection(self) -> None:
        (self.project / ".agent-src.uncondensed").mkdir()
        self.assertEqual(install._detect_legacy_for_migration(self.project), [])

    def test_source_repo_bypasses_via_nested_package_layout(self) -> None:
        # Current layout: `.agent-src.uncondensed/` lives under
        # `packages/<name>/.agent-src.uncondensed/`. The auto-detect must
        # still classify the cwd as the source repo (Q1 of the
        # road-to-claude-code-global-distribution roadmap, council
        # Option D — Hybrid auto-detect).
        (self.project / "packages" / "core" / ".agent-src.uncondensed").mkdir(parents=True)
        self.assertEqual(install._detect_legacy_for_migration(self.project), [])

    def test_source_repo_bypasses_via_package_json_name(self) -> None:
        # Strongest signature: package.json declares the agent-config
        # npm identity. Maintainer clones / forks named differently
        # still match as long as the package.json name is preserved.
        (self.project / "package.json").write_text(
            '{"name": "@event4u/agent-config", "version": "9.9.9"}\n',
            encoding="utf-8",
        )
        self.assertEqual(install._detect_legacy_for_migration(self.project), [])

    def test_consumer_mode_override_re_enables_migration(self) -> None:
        # AGENT_CONFIG_CONSUMER_MODE=1 forces the consumer flow even
        # when the maintainer signatures match — the end-to-end
        # consumer-flow QA path needs this escape hatch.
        (self.project / ".agent-src.uncondensed").mkdir()
        with mock.patch.dict(
            os.environ, {"AGENT_CONFIG_CONSUMER_MODE": "1"}
        ):
            found = install._detect_legacy_for_migration(self.project)
        self.assertIn(".agent-settings.yml", found)

    def test_bridge_marker_bypasses_detection(self) -> None:
        marker = self.project / install.CONSUMER_BRIDGE_MARKER_RELPATH
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.write_text("schema_version: 1\n", encoding="utf-8")
        self.assertEqual(install._detect_legacy_for_migration(self.project), [])

    def test_settings_subdir_yaml_is_detected(self) -> None:
        (self.project / ".agent-settings.yml").unlink()
        (self.project / "settings").mkdir()
        (self.project / "settings" / ".agent-settings.yml").write_text(
            _SAMPLE_SETTINGS, encoding="utf-8",
        )
        found = install._detect_legacy_for_migration(self.project)
        self.assertIn("settings/.agent-settings.yml", found)


class InstallHookTests(_Base):
    """Phase 5.2 — first-run prompt + dispatch into the migrator."""

    def test_prompt_non_interactive_defaults_to_yes(self) -> None:
        with mock.patch.object(install, "_is_interactive", return_value=False):
            self.assertTrue(
                install._prompt_migrate_to_global(self.project, [".agent-settings.yml"])
            )

    def test_prompt_interactive_yes_via_empty_reply(self) -> None:
        with mock.patch.object(install, "_is_interactive", return_value=True), \
                mock.patch.object(install, "_read_line", return_value=""):
            self.assertTrue(
                install._prompt_migrate_to_global(self.project, [".agent-settings.yml"])
            )

    def test_prompt_interactive_no_reply_returns_false(self) -> None:
        with mock.patch.object(install, "_is_interactive", return_value=True), \
                mock.patch.object(install, "_read_line", return_value="n"):
            self.assertFalse(
                install._prompt_migrate_to_global(self.project, [".agent-settings.yml"])
            )

    def test_run_migrate_to_global_invokes_do_migrate(self) -> None:
        rc = install._run_migrate_to_global(self.project)
        self.assertEqual(rc, 0)
        # Forward migration ran: bridge marker is the contract success signal.
        self.assertTrue((self.project / install.CONSUMER_BRIDGE_MARKER_RELPATH).is_file())


class MigrationLifecycleTests(_Base):
    """Forward path: copy → verify → move → manifest → bridge marker."""

    def _migrate(self, *extra: str) -> int:
        argv = ["--from", str(self.project), "--skip-perms-gate", *extra]
        return mig.main(argv)

    def test_happy_path_copies_verifies_moves_and_bridges(self) -> None:
        rc = self._migrate()
        self.assertEqual(rc, 0)

        # Global copies exist with mode 0600 and round-trip parse.
        for global_path, expected in (
            (self.fake_settings, _SAMPLE_SETTINGS),
            (self.fake_user, _SAMPLE_USER),
        ):
            self.assertTrue(global_path.is_file(), global_path)
            self.assertEqual(global_path.read_text(encoding="utf-8"), expected)
            self.assertEqual(global_path.stat().st_mode & 0o777, 0o600)

        # Originals moved into the snapshot tree.
        self.assertFalse((self.project / ".agent-settings.yml").exists())
        self.assertFalse((self.project / ".agent-user.yml").exists())
        self.assertFalse((self.project / ".augment").exists())

        snap_root = self.project / mig.SNAPSHOT_DIRNAME
        self.assertTrue(snap_root.is_dir())
        stamps = list(snap_root.iterdir())
        self.assertEqual(len(stamps), 1)
        manifest_path = stamps[0] / mig.MANIFEST_NAME
        self.assertTrue(manifest_path.is_file())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual(manifest["schema"], "event4u-migrate-snapshot/v1")
        self.assertEqual(len(manifest["moved_yaml"]), 2)
        self.assertEqual(len(manifest["moved_dirs"]), 1)
        self.assertEqual(len(manifest["global_copies"]), 2)

        # Bridge marker is the last write.
        marker = self.project / install.CONSUMER_BRIDGE_MARKER_RELPATH
        self.assertTrue(marker.is_file())

    def test_idempotent_second_run_is_noop(self) -> None:
        self.assertEqual(self._migrate(), 0)
        # Second run: nothing left to migrate (marker present, originals gone).
        rc = self._migrate()
        self.assertEqual(rc, 0)
        # Still exactly one snapshot directory.
        snap_root = self.project / mig.SNAPSHOT_DIRNAME
        self.assertEqual(len(list(snap_root.iterdir())), 1)

    def test_refuses_to_overwrite_non_empty_global_without_force(self) -> None:
        self.fake_global.mkdir(parents=True, exist_ok=True)
        self.fake_settings.write_text("cost_profile: full\n", encoding="utf-8")
        rc = self._migrate()
        self.assertEqual(rc, 1)
        # Local originals untouched.
        self.assertTrue((self.project / ".agent-settings.yml").is_file())
        self.assertTrue((self.project / ".augment").is_dir())
        # Existing global content preserved verbatim.
        self.assertEqual(
            self.fake_settings.read_text(encoding="utf-8"),
            "cost_profile: full\n",
        )

    def test_force_overwrites_non_empty_global(self) -> None:
        self.fake_global.mkdir(parents=True, exist_ok=True)
        self.fake_settings.write_text("cost_profile: full\n", encoding="utf-8")
        rc = self._migrate("--force")
        self.assertEqual(rc, 0)
        self.assertIn("cost_profile: minimal", self.fake_settings.read_text(encoding="utf-8"))

    def test_malformed_yaml_aborts_before_moving(self) -> None:
        (self.project / ".agent-settings.yml").write_text(
            "cost_profile: : broken\n  - [ : :\n", encoding="utf-8",
        )
        rc = self._migrate()
        self.assertEqual(rc, 1)
        # Originals still present, snapshot dir never created.
        self.assertTrue((self.project / ".agent-settings.yml").is_file())
        self.assertTrue((self.project / ".augment").is_dir())
        self.assertFalse((self.project / mig.SNAPSHOT_DIRNAME).exists())

    def test_dry_run_writes_nothing(self) -> None:
        argv = ["--from", str(self.project), "--skip-perms-gate", "--dry-run"]
        rc = mig.main(argv)
        self.assertEqual(rc, 0)
        self.assertFalse(self.fake_settings.exists())
        self.assertTrue((self.project / ".agent-settings.yml").is_file())
        self.assertFalse((self.project / mig.SNAPSHOT_DIRNAME).exists())


class RollbackTests(_Base):
    """Forward-then-rollback yields a byte-identical project tree."""

    def _migrate(self) -> int:
        argv = ["--from", str(self.project), "--skip-perms-gate"]
        return mig.main(argv)

    def _rollback(self) -> int:
        argv = ["--from", str(self.project), "--skip-perms-gate", "--rollback"]
        return mig.main(argv)

    def test_round_trip_restores_byte_identical_state(self) -> None:
        pre = {
            ".agent-settings.yml": _sha256(self.project / ".agent-settings.yml"),
            ".agent-user.yml": _sha256(self.project / ".agent-user.yml"),
            ".augment/marker.txt": _sha256(self.project / ".augment" / "marker.txt"),
        }

        self.assertEqual(self._migrate(), 0)
        self.assertEqual(self._rollback(), 0)

        for rel, digest in pre.items():
            restored = self.project / rel
            self.assertTrue(restored.exists(), rel)
            self.assertEqual(_sha256(restored), digest, rel)

        # Global copies removed; bridge marker dropped.
        self.assertFalse(self.fake_settings.exists())
        self.assertFalse(self.fake_user.exists())
        self.assertFalse((self.project / install.CONSUMER_BRIDGE_MARKER_RELPATH).exists())

    def test_rollback_without_snapshot_exits_1(self) -> None:
        rc = self._rollback()
        self.assertEqual(rc, 1)

    def test_rollback_dry_run_writes_nothing(self) -> None:
        self.assertEqual(self._migrate(), 0)
        # Capture state right after the forward migration.
        global_existed = self.fake_settings.is_file()
        marker_existed = (self.project / install.CONSUMER_BRIDGE_MARKER_RELPATH).is_file()

        argv = ["--from", str(self.project), "--skip-perms-gate", "--rollback", "--dry-run"]
        rc = mig.main(argv)
        self.assertEqual(rc, 0)
        # Nothing changed.
        self.assertEqual(self.fake_settings.is_file(), global_existed)
        self.assertEqual(
            (self.project / install.CONSUMER_BRIDGE_MARKER_RELPATH).is_file(),
            marker_existed,
        )


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
