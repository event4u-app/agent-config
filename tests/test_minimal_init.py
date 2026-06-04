#!/usr/bin/env python3
"""Tests for ``install.install_minimal`` and the bash orchestrator's
``--minimal`` mode (Step 7 Phase 2).

Run: python3 -m unittest tests.test_minimal_init -v
"""

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src" / "scripts"))

import install  # type: ignore  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent
INSTALL_BASH = REPO_ROOT / "src" / "scripts" / "install"


class _Silent(unittest.TestCase):
    def setUp(self) -> None:
        install.QUIET = True

    def tearDown(self) -> None:
        install.QUIET = False


# --- Python-level: install_minimal() ---


class TestInstallMinimalPayload(_Silent):
    def test_writes_overrides_scaffold_on_clean_target(self) -> None:
        """Default `--minimal` run writes the global-only consumer scaffold
        (ADR-020 § Phase 4.5): overrides subdirs + README + bridge marker.
        No project-local `.agent-settings.yml` unless `user_type` is given.
        """
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "fresh"
            rc = install.install_minimal(target, force=False)
            self.assertEqual(rc, 0)
            # Overrides scaffold — committable per Phase 4.5.
            overrides = target / "agents" / "overrides"
            self.assertTrue((overrides / "rules" / ".gitkeep").is_file())
            self.assertTrue((overrides / "skills" / ".gitkeep").is_file())
            self.assertTrue((overrides / "commands" / ".gitkeep").is_file())
            self.assertTrue((overrides / "README.md").is_file())
            # Bridge marker — Phase 4.2 anchor to the user-global install.
            self.assertTrue((target / "agents" / ".event4u-bridge.yml").is_file())
            # No project-local settings file in the default minimal payload.
            self.assertFalse((install._canonical_settings_target(target)).exists())
            # Legacy artifacts must not appear in the new scaffold.
            self.assertFalse((target / "agents" / ".gitkeep").exists())
            # install_minimal itself does not write the wrapper — that
            # lives in scripts/install.sh's --minimal short-circuit.
            self.assertFalse((target / "agent-config").exists())
            # No bridge payload.
            self.assertFalse((target / ".augment").exists())
            self.assertFalse((target / "AGENTS.md").exists())

    def test_bridge_marker_points_at_global_root(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "fresh"
            install.install_minimal(target, force=False)
            marker = target / "agents" / ".event4u-bridge.yml"
            body = marker.read_text(encoding="utf-8")
            self.assertIn("schema: event4u-bridge/v1", body)
            self.assertIn("global_root:", body)
            self.assertIn("installer_version:", body)

    def test_overrides_readme_explains_layer(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "fresh"
            install.install_minimal(target, force=False)
            body = (target / "agents" / "overrides" / "README.md").read_text(encoding="utf-8")
            # Smoke check: the README names the override layer + bridge.
            self.assertIn("overrides", body.lower())
            self.assertIn("bridge", body.lower())

    def test_user_type_writes_settings_stub(self) -> None:
        """Back-compat: the step-9 interactive flow passes a `user_type`,
        and that still appends a `.agent-settings.yml` stub on top of
        the new overrides scaffold."""
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "fresh"
            install.install_minimal(target, force=False, user_type="developer")
            settings = install._canonical_settings_target(target)
            self.assertTrue(settings.is_file())
            body = settings.read_text(encoding="utf-8")
            self.assertIn("rule_loading_tier", body)
            self.assertIn("user_type: developer", body)
            # D4 — version pin commented out by default.
            self.assertNotRegex(body, r"^agent_config_version:")

    def test_rerun_is_idempotent_without_force(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "fresh"
            install.install_minimal(target, force=False)
            readme = target / "agents" / "overrides" / "README.md"
            readme.write_text("# user edit\n", encoding="utf-8")
            rc = install.install_minimal(target, force=False)
            self.assertEqual(rc, 0)
            self.assertIn("# user edit", readme.read_text(encoding="utf-8"))

    def test_force_overwrites_existing_readme(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "fresh"
            install.install_minimal(target, force=False)
            readme = target / "agents" / "overrides" / "README.md"
            readme.write_text("user_only\n", encoding="utf-8")
            install.install_minimal(target, force=True)
            body = readme.read_text(encoding="utf-8")
            self.assertNotIn("user_only", body)
            self.assertIn("overrides", body.lower())


# --- Nested-install guard ---


class TestNestedInstallGuard(_Silent):
    def test_refuses_install_inside_existing_bridge_anchor(self) -> None:
        """Phase 4.5: the bridge marker is the new project anchor for a
        global-only consumer scaffold. Nesting another `--minimal` below
        it must trip the guard."""
        with tempfile.TemporaryDirectory() as tmp:
            outer = Path(tmp) / "outer"
            install.install_minimal(outer, force=False)
            # Sanity: outer is anchored by the bridge marker.
            self.assertTrue((outer / "agents" / ".event4u-bridge.yml").is_file())
            nested = outer / "sub" / "deep"
            with self.assertRaises(SystemExit) as ctx:
                install.install_minimal(nested, force=False)
            self.assertEqual(ctx.exception.code, 1)
            self.assertFalse((nested / "agents").exists())

    def test_refuses_install_inside_agents_anchor(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            outer = Path(tmp) / "outer"
            (outer / "agents" / "roadmaps").mkdir(parents=True)
            (outer / "agents" / "roadmaps" / "x.md").write_text("x\n", encoding="utf-8")
            nested = outer / "child"
            with self.assertRaises(SystemExit):
                install.install_minimal(nested, force=False)

    def test_allows_rerun_on_same_root(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "fresh"
            install.install_minimal(target, force=False)
            # Same root again must not trip the guard.
            rc = install.install_minimal(target, force=False)
            self.assertEqual(rc, 0)


# --- Orchestrator (bash) end-to-end ---


class TestBashOrchestratorMinimal(unittest.TestCase):
    def _run(self, target: Path) -> subprocess.CompletedProcess:
        return subprocess.run(
            ["bash", str(INSTALL_BASH), "--minimal", "--target", str(target)],
            capture_output=True,
            text=True,
            cwd=str(REPO_ROOT),
            env={**os.environ, "AGENT_CONFIG_NO_UPDATE_CHECK": "1"},
        )

    def test_clean_install_writes_wrapper_and_scaffold(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "fresh"
            result = self._run(target)
            self.assertEqual(result.returncode, 0, result.stderr)
            # Phase 4.5 overrides scaffold + bridge marker.
            overrides = target / "agents" / "overrides"
            self.assertTrue((overrides / "rules" / ".gitkeep").is_file())
            self.assertTrue((overrides / "skills" / ".gitkeep").is_file())
            self.assertTrue((overrides / "commands" / ".gitkeep").is_file())
            self.assertTrue((overrides / "README.md").is_file())
            self.assertTrue((target / "agents" / ".event4u-bridge.yml").is_file())
            # Bash short-circuit installs the wrapper.
            self.assertTrue((target / "agent-config").is_file())
            self.assertTrue(os.access(target / "agent-config", os.X_OK))
            # No project-local settings file in the default minimal payload.
            self.assertFalse((install._canonical_settings_target(target)).exists())
            # No payload.
            self.assertFalse((target / ".augment").exists())

    def test_nested_install_fails_before_writing_wrapper(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            outer = Path(tmp) / "outer"
            self._run(outer)
            nested = outer / "sub" / "deep"
            result = self._run(nested)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse((nested / "agent-config").exists())
            self.assertFalse((nested / "agents").exists())


if __name__ == "__main__":
    unittest.main()
