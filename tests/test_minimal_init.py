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

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import install  # type: ignore  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent
INSTALL_BASH = REPO_ROOT / "scripts" / "install"


class _Silent(unittest.TestCase):
    def setUp(self) -> None:
        install.QUIET = True

    def tearDown(self) -> None:
        install.QUIET = False


# --- Python-level: install_minimal() ---


class TestInstallMinimalPayload(_Silent):
    def test_writes_exactly_three_artifacts_on_clean_target(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "fresh"
            rc = install.install_minimal(target, force=False)
            self.assertEqual(rc, 0)
            self.assertTrue((target / ".agent-settings.yml").is_file())
            self.assertTrue((target / "agents" / ".gitkeep").is_file())
            # install_minimal itself does not write the wrapper — that
            # lives in scripts/install.sh's --minimal short-circuit.
            self.assertFalse((target / "agent-config").exists())
            # No bridge payload.
            self.assertFalse((target / ".augment").exists())
            self.assertFalse((target / "AGENTS.md").exists())

    def test_settings_stub_has_cost_profile(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "fresh"
            install.install_minimal(target, force=False)
            content = (target / ".agent-settings.yml").read_text(encoding="utf-8")
            self.assertIn("cost_profile", content)
            # D4 — version pin commented out by default.
            self.assertNotRegex(content, r"^agent_config_version:")

    def test_rerun_is_idempotent_without_force(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "fresh"
            install.install_minimal(target, force=False)
            (target / ".agent-settings.yml").write_text(
                "cost_profile: minimal\n# user edit\n", encoding="utf-8"
            )
            rc = install.install_minimal(target, force=False)
            self.assertEqual(rc, 0)
            content = (target / ".agent-settings.yml").read_text(encoding="utf-8")
            self.assertIn("# user edit", content)

    def test_force_overwrites_existing_settings(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "fresh"
            install.install_minimal(target, force=False)
            (target / ".agent-settings.yml").write_text("user_only: 1\n", encoding="utf-8")
            install.install_minimal(target, force=True)
            content = (target / ".agent-settings.yml").read_text(encoding="utf-8")
            self.assertNotIn("user_only", content)
            self.assertIn("cost_profile", content)


# --- Nested-install guard ---


class TestNestedInstallGuard(_Silent):
    def test_refuses_install_inside_existing_agent_settings_layer(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            outer = Path(tmp) / "outer"
            install.install_minimal(outer, force=False)
            nested = outer / "sub" / "deep"
            with self.assertRaises(SystemExit) as ctx:
                install.install_minimal(nested, force=False)
            self.assertEqual(ctx.exception.code, 1)
            self.assertFalse((nested / ".agent-settings.yml").exists())
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

    def test_clean_install_writes_wrapper_and_settings(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "fresh"
            result = self._run(target)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertTrue((target / ".agent-settings.yml").is_file())
            self.assertTrue((target / "agents" / ".gitkeep").is_file())
            self.assertTrue((target / "agent-config").is_file())
            self.assertTrue(os.access(target / "agent-config", os.X_OK))
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
            self.assertFalse((nested / ".agent-settings.yml").exists())


if __name__ == "__main__":
    unittest.main()
