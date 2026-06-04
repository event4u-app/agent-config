#!/usr/bin/env python3
"""Unit tests for the per-tool project anchor writer.

road-to-global-only-install § Phase 4.3. Verifies that
``_write_per_tool_project_anchors`` plants thin pointer files for the
tools listed in :data:`install.PROJECT_ANCHOR_TOOLS` (Windsurf, Cline,
Gemini-CLI), each pointing at the bridge marker via a portable
relative path; honours the dev-mode + source-repo skip; and writes
atomically at ``0o644``. Run:

    python3 -m unittest tests.test_per_tool_project_anchors -v
"""

import os
import stat
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))

import install  # type: ignore  # noqa: E402


FIXED_NOW = datetime(2026, 5, 23, 14, 0, 0, tzinfo=timezone.utc)
ALL_ANCHOR_TOOLS = set(install.PROJECT_ANCHOR_TOOLS.keys())


class TestWritePerToolProjectAnchors(unittest.TestCase):
    """`_write_per_tool_project_anchors` — Phase 4.3 writer contract."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.project_root = Path(self._tmp.name)
        self._home = tempfile.TemporaryDirectory()
        self.addCleanup(self._home.cleanup)
        self.home_env = {"HOME": self._home.name}

    def test_writes_anchors_for_each_listed_tool(self) -> None:
        written = install._write_per_tool_project_anchors(
            self.project_root, ALL_ANCHOR_TOOLS, env=self.home_env, now=FIXED_NOW,
        )
        self.assertEqual(len(written), len(install.PROJECT_ANCHOR_TOOLS))
        for tool_id, rel in install.PROJECT_ANCHOR_TOOLS.items():
            target = self.project_root / rel
            self.assertTrue(target.is_file(), f"missing anchor for {tool_id}: {target}")
            body = target.read_text(encoding="utf-8")
            self.assertIn("schema: event4u-bridge/v1", body)
            self.assertIn(f"tool: {tool_id}", body)
            self.assertIn("global_root: ~/.event4u/agent-config", body)
            self.assertIn("installed_at: 2026-05-23T14:00:00Z", body)

    def test_bridge_field_is_relative_to_anchor_location(self) -> None:
        install._write_per_tool_project_anchors(
            self.project_root, {"windsurf"}, env=self.home_env, now=FIXED_NOW,
        )
        body = (self.project_root / ".windsurf" / "agent-config.bridge.yml").read_text(
            encoding="utf-8",
        )
        # ``.windsurf/agent-config.bridge.yml`` → ``../agents/.event4u-bridge.yml``.
        self.assertIn("bridge: ../agents/.event4u-bridge.yml", body)
        # Never absolute — must be portable.
        self.assertNotIn("bridge: /", body)

    def test_anchor_mode_is_0644(self) -> None:
        written = install._write_per_tool_project_anchors(
            self.project_root, ALL_ANCHOR_TOOLS, env=self.home_env, now=FIXED_NOW,
        )
        for p in written:
            mode = stat.S_IMODE(os.stat(p).st_mode)
            self.assertEqual(mode, 0o644, f"wrong mode for {p}")

    def test_filters_to_requested_tools(self) -> None:
        written = install._write_per_tool_project_anchors(
            self.project_root, {"windsurf"}, env=self.home_env, now=FIXED_NOW,
        )
        self.assertEqual(len(written), 1)
        self.assertTrue((self.project_root / ".windsurf" / "agent-config.bridge.yml").is_file())
        self.assertFalse((self.project_root / ".clinerules" / "agent-config.bridge.yml").exists())
        self.assertFalse((self.project_root / ".gemini" / "agent-config.bridge.yml").exists())

    def test_ignores_tools_without_project_anchor(self) -> None:
        # ``claude-code`` / ``cursor`` / ``augment`` load from user-scope;
        # they must NOT receive a per-project anchor file.
        written = install._write_per_tool_project_anchors(
            self.project_root,
            {"claude-code", "cursor", "augment"},
            env=self.home_env, now=FIXED_NOW,
        )
        self.assertEqual(written, [])
        for sub in (".claude", ".cursor", ".augment"):
            self.assertFalse((self.project_root / sub / "agent-config.bridge.yml").exists())

    def test_idempotent_refresh(self) -> None:
        install._write_per_tool_project_anchors(
            self.project_root, {"cline"}, env=self.home_env, now=FIXED_NOW,
        )
        later = datetime(2026, 6, 1, 9, 30, 0, tzinfo=timezone.utc)
        install._write_per_tool_project_anchors(
            self.project_root, {"cline"}, env=self.home_env, now=later,
        )
        body = (self.project_root / ".clinerules" / "agent-config.bridge.yml").read_text(
            encoding="utf-8",
        )
        self.assertIn("installed_at: 2026-06-01T09:30:00Z", body)
        self.assertEqual(body.count("schema:"), 1)
        self.assertEqual(body.count("tool: cline"), 1)

    def test_skipped_when_dev_mode_active(self) -> None:
        env = dict(self.home_env)
        env["AGENT_CONFIG_DEV_MODE"] = "1"
        written = install._write_per_tool_project_anchors(
            self.project_root, ALL_ANCHOR_TOOLS, env=env, now=FIXED_NOW,
        )
        self.assertEqual(written, [])
        for rel in install.PROJECT_ANCHOR_TOOLS.values():
            self.assertFalse((self.project_root / rel).exists())

    def test_skipped_inside_source_repo(self) -> None:
        (self.project_root / ".agent-src.uncondensed").mkdir()
        written = install._write_per_tool_project_anchors(
            self.project_root, ALL_ANCHOR_TOOLS, env=self.home_env, now=FIXED_NOW,
        )
        self.assertEqual(written, [])

    def test_no_tmp_files_left_behind_on_success(self) -> None:
        install._write_per_tool_project_anchors(
            self.project_root, ALL_ANCHOR_TOOLS, env=self.home_env, now=FIXED_NOW,
        )
        for rel in install.PROJECT_ANCHOR_TOOLS.values():
            parent = (self.project_root / rel).parent
            leftovers = list(parent.glob(".agent-config.bridge.*.tmp"))
            self.assertEqual(leftovers, [], f"tmp leftovers in {parent}")


if __name__ == "__main__":
    unittest.main()
