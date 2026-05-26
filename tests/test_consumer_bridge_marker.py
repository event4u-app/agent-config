#!/usr/bin/env python3
"""Unit tests for the consumer bridge marker writer.

road-to-global-only-install § Phase 4.2. Verifies that
``_write_consumer_bridge_marker`` honors the writer contract in
``docs/contracts/consumer-bridge.md``: atomic write, ``0o644`` mode,
``event4u-bridge/v1`` schema body, idempotent refresh, dev-mode +
source-repo skips. Run:

    python3 -m unittest tests.test_consumer_bridge_marker -v
"""

import os
import stat
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import install  # type: ignore  # noqa: E402


FIXED_NOW = datetime(2026, 5, 23, 14, 0, 0, tzinfo=timezone.utc)


class TestWriteConsumerBridgeMarker(unittest.TestCase):
    """`_write_consumer_bridge_marker` — Phase 4.2 writer contract."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.project_root = Path(self._tmp.name)
        # Pretend $HOME lives elsewhere so ``~``-rendering uses the
        # standard ``~/.event4u/agent-config`` shape without depending
        # on the test runner's actual home dir.
        self._home = tempfile.TemporaryDirectory()
        self.addCleanup(self._home.cleanup)
        self.home_env = {"HOME": self._home.name}

    def _read_marker(self) -> str:
        return (self.project_root / "agents" / ".event4u-bridge.yml").read_text(
            encoding="utf-8",
        )

    def test_writes_marker_with_v1_schema_body(self) -> None:
        path = install._write_consumer_bridge_marker(
            self.project_root, "2.4.0", env=self.home_env, now=FIXED_NOW,
        )
        self.assertIsNotNone(path)
        body = self._read_marker()
        self.assertIn("schema: event4u-bridge/v1", body)
        self.assertIn("global_root: ~/.event4u/agent-config", body)
        self.assertIn("installed_at: 2026-05-23T14:00:00Z", body)
        self.assertIn("installer_version: 2.4.0", body)

    def test_marker_mode_is_0644(self) -> None:
        path = install._write_consumer_bridge_marker(
            self.project_root, "2.4.0", env=self.home_env, now=FIXED_NOW,
        )
        assert path is not None
        mode = stat.S_IMODE(os.stat(path).st_mode)
        self.assertEqual(mode, 0o644)

    def test_creates_agents_directory_if_missing(self) -> None:
        # ``agents/`` does not yet exist.
        self.assertFalse((self.project_root / "agents").exists())
        install._write_consumer_bridge_marker(
            self.project_root, "2.4.0", env=self.home_env, now=FIXED_NOW,
        )
        self.assertTrue((self.project_root / "agents").is_dir())

    def test_idempotent_refresh_updates_installed_at(self) -> None:
        install._write_consumer_bridge_marker(
            self.project_root, "2.4.0", env=self.home_env, now=FIXED_NOW,
        )
        later = datetime(2026, 6, 1, 9, 30, 0, tzinfo=timezone.utc)
        install._write_consumer_bridge_marker(
            self.project_root, "2.4.1", env=self.home_env, now=later,
        )
        body = self._read_marker()
        self.assertIn("installed_at: 2026-06-01T09:30:00Z", body)
        self.assertIn("installer_version: 2.4.1", body)
        # No duplicate keys after refresh.
        self.assertEqual(body.count("schema:"), 1)
        self.assertEqual(body.count("installed_at:"), 1)

    def test_skipped_when_dev_mode_active(self) -> None:
        env = dict(self.home_env)
        env["AGENT_CONFIG_DEV_MODE"] = "1"
        path = install._write_consumer_bridge_marker(
            self.project_root, "2.4.0", env=env, now=FIXED_NOW,
        )
        self.assertIsNone(path)
        self.assertFalse((self.project_root / "agents" / ".event4u-bridge.yml").exists())

    def test_skipped_inside_source_repo(self) -> None:
        # Presence of ``.agent-src.uncondensed/`` marks the maintainer
        # source repo; the marker must never land here.
        (self.project_root / ".agent-src.uncondensed").mkdir()
        path = install._write_consumer_bridge_marker(
            self.project_root, "2.4.0", env=self.home_env, now=FIXED_NOW,
        )
        self.assertIsNone(path)
        self.assertFalse((self.project_root / "agents" / ".event4u-bridge.yml").exists())

    def test_global_root_outside_home_renders_absolute(self) -> None:
        # ``EVENT4U_CONFIG_HOME`` override pointing outside ``$HOME``
        # must render as an absolute path (no spurious ``~/`` prefix).
        external = tempfile.TemporaryDirectory()
        self.addCleanup(external.cleanup)
        env = dict(self.home_env)
        env["EVENT4U_CONFIG_HOME"] = external.name
        install._write_consumer_bridge_marker(
            self.project_root, "2.4.0", env=env, now=FIXED_NOW,
        )
        body = self._read_marker()
        self.assertIn(f"global_root: {external.name}", body)
        self.assertNotIn("global_root: ~/", body)

    def test_no_tmp_files_left_behind_on_success(self) -> None:
        install._write_consumer_bridge_marker(
            self.project_root, "2.4.0", env=self.home_env, now=FIXED_NOW,
        )
        leftovers = list((self.project_root / "agents").glob(".event4u-bridge.*.tmp"))
        self.assertEqual(leftovers, [])


if __name__ == "__main__":
    unittest.main()
