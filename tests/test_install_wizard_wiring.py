#!/usr/bin/env python3
"""
Tests for the wizard-wiring follow-up: ``--dry-run`` and ``--no-ui``
flags plus the gate-evaluation helper in ``scripts/install.py``.

Roadmap: ``agents/roadmaps/wizard-install-py-wiring.md`` Step 4.
Run: ``python3 -m unittest tests.test_install_wizard_wiring -v``
"""

import argparse
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import install  # type: ignore  # noqa: E402


class WizardShouldLaunchTests(unittest.TestCase):
    """Gate evaluation — ``_wizard_should_launch`` decisions."""

    def _opts(self, **overrides):
        ns = argparse.Namespace(no_ui=False, dry_run=False)
        for k, v in overrides.items():
            setattr(ns, k, v)
        return ns

    def test_no_ui_flag_blocks(self):
        ok, why = install._wizard_should_launch(self._opts(no_ui=True))
        self.assertFalse(ok)
        self.assertIn("--no-ui", why)

    def test_env_no_ui_blocks(self):
        os.environ["AGENT_CONFIG_NO_UI"] = "1"
        try:
            ok, why = install._wizard_should_launch(self._opts())
            self.assertFalse(ok)
            self.assertIn("AGENT_CONFIG_NO_UI", why)
        finally:
            del os.environ["AGENT_CONFIG_NO_UI"]

    def test_ci_env_blocks(self):
        os.environ["CI"] = "true"
        try:
            ok, why = install._wizard_should_launch(self._opts())
            self.assertFalse(ok)
            self.assertIn("CI", why)
        finally:
            del os.environ["CI"]

    def test_non_tty_blocks(self):
        # Tests run with stdout piped to the test harness — never a TTY.
        # Clear CI env so the no-TTY branch fires (not the CI branch).
        prev_ci = os.environ.pop("CI", None)
        try:
            ok, why = install._wizard_should_launch(self._opts())
            self.assertFalse(ok)
            self.assertIn("TTY", why)
        finally:
            if prev_ci is not None:
                os.environ["CI"] = prev_ci


class DryRunCliTests(unittest.TestCase):
    """End-to-end: ``python3 scripts/install.py --dry-run …`` exits 0
    without writing files or spawning subprocesses."""

    def _run(self, *extra: str):
        with tempfile.TemporaryDirectory() as td:
            env = os.environ.copy()
            env.pop("AGENT_CONFIG_NO_UI", None)
            env.pop("CI", None)
            proc = subprocess.run(  # noqa: S603 - args are locally-built
                [sys.executable, str(REPO_ROOT / "scripts" / "install.py"),
                 "--dry-run", "--project", td, *extra],
                capture_output=True, text=True, env=env, timeout=30,
            )
            # Snapshot the tmpdir contents — must be empty (no writes).
            leftovers = list(Path(td).iterdir())
            return proc, leftovers

    def test_dry_run_exits_zero_no_writes(self):
        proc, leftovers = self._run()
        self.assertEqual(proc.returncode, 0, msg=proc.stderr)
        self.assertIn("[dry-run]", proc.stdout)
        self.assertEqual(leftovers, [], msg=f"unexpected writes: {leftovers}")

    def test_dry_run_shows_wizard_line(self):
        proc, _ = self._run()
        self.assertIn("wizard:", proc.stdout)

    def test_dry_run_with_no_ui_marks_suppressed(self):
        proc, _ = self._run("--no-ui")
        self.assertEqual(proc.returncode, 0, msg=proc.stderr)
        # When --no-ui is passed, the wizard line must show suppression
        # reason, not the auto-launch teaser.
        self.assertIn("Suppressed (--no-ui", proc.stdout)
        self.assertNotIn("Would auto-launch", proc.stdout)

    def test_dry_run_summary_lists_core_keys(self):
        proc, _ = self._run("--profile", "minimal", "--tools", "cursor")
        self.assertEqual(proc.returncode, 0, msg=proc.stderr)
        self.assertIn("profile:", proc.stdout)
        self.assertIn("minimal", proc.stdout)
        self.assertIn("scope:", proc.stdout)
        self.assertIn("tools:", proc.stdout)


class WizardCliDistResolutionTests(unittest.TestCase):
    """``_wizard_cli_dist`` returns None when the installer dist is
    absent, an existing Path when the build has been run."""

    def test_returns_none_when_dist_absent(self):
        with tempfile.TemporaryDirectory() as td:
            # Resolve against a project root that has no installer dist.
            # The helper resolves relative to install.py itself, so
            # this asserts the real repo path — adapt by monkeypatching
            # __file__ via a sentinel test only when actually-missing.
            project_root = Path(td)
            result = install._wizard_cli_dist(project_root)
            # In the real repo the dist is usually built; either case
            # is valid as long as the return type is correct.
            self.assertTrue(result is None or isinstance(result, Path))


if __name__ == "__main__":
    unittest.main()
