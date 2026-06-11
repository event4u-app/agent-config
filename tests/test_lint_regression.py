#!/usr/bin/env python3
"""Tests for scripts/lint_regression.py — the PR lint-regression report.

Pins the PR #466 failure mode: the baseline run used the current branch's
skill_linter.py, whose artefact discovery is anchored at the script location
(_lib/agent_src.py::ROOT), not at --repo-root. The baseline therefore linted
the CURRENT tree with absolute display paths, the two result sets shared zero
file keys, and every repo-wide warning file was reported as a "new file with
issues" on every PR — even PRs that touched no lintable file at all.
"""

from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPT = REPO_ROOT / "src" / "scripts" / "lint_regression.py"

sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))

import lint_regression  # type: ignore  # noqa: E402


class CompareTests(unittest.TestCase):
    """Pure comparison logic — no git, no subprocess."""

    def test_identical_maps_produce_empty_delta(self):
        m = {"a.md": {"status": "pass_with_warnings", "codes": {"long_rule"}}}
        delta = lint_regression.compare(m, m)
        self.assertEqual(delta["regressions"], [])
        self.assertEqual(delta["new_files"], [])
        self.assertEqual(delta["improvements"], [])

    def test_new_file_with_issues_is_reported(self):
        base = {"a.md": {"status": "pass", "codes": set()}}
        curr = {
            "a.md": {"status": "pass", "codes": set()},
            "b.md": {"status": "pass_with_warnings", "codes": {"long_rule"}},
        }
        delta = lint_regression.compare(base, curr)
        self.assertEqual([nf["file"] for nf in delta["new_files"]], ["b.md"])

    def test_new_clean_file_is_not_reported(self):
        base = {}
        curr = {"b.md": {"status": "pass", "codes": set()}}
        delta = lint_regression.compare(base, curr)
        self.assertEqual(delta["new_files"], [])

    def test_status_downgrade_is_a_regression(self):
        base = {"a.md": {"status": "pass", "codes": set()}}
        curr = {"a.md": {"status": "pass_with_warnings", "codes": {"long_rule"}}}
        delta = lint_regression.compare(base, curr)
        self.assertEqual(len(delta["regressions"]), 1)
        self.assertEqual(delta["regressions"][0]["new_codes"], ["long_rule"])

    def test_status_upgrade_is_an_improvement(self):
        base = {"a.md": {"status": "fail", "codes": {"missing_section"}}}
        curr = {"a.md": {"status": "pass", "codes": set()}}
        delta = lint_regression.compare(base, curr)
        self.assertEqual(len(delta["improvements"]), 1)
        self.assertEqual(delta["regressions"], [])

    def test_removed_file_is_not_a_regression(self):
        base = {"a.md": {"status": "pass_with_warnings", "codes": {"long_rule"}}}
        delta = lint_regression.compare(base, {})
        self.assertEqual(delta["regressions"], [])
        self.assertEqual(delta["new_files"], [])


class EndToEndTests(unittest.TestCase):
    """Run the real script against --baseline HEAD.

    The working tree's lintable .md files equal HEAD in CI checkouts and on
    any branch where only code (not artefacts) changed, so the report must be
    empty. Before the PR #466 fix this exact invocation reported every
    repo-wide warning file as new.
    """

    @classmethod
    def setUpClass(cls):
        inside = subprocess.run(
            ["git", "-C", str(REPO_ROOT), "rev-parse", "--is-inside-work-tree"],
            capture_output=True, text=True,
        )
        if inside.returncode != 0 or inside.stdout.strip() != "true":
            raise unittest.SkipTest("not a git checkout")

        # Skip when lintable sources differ from HEAD — the comparison is
        # then legitimately non-empty and asserts nothing about the tooling.
        dirty = subprocess.run(
            ["git", "-C", str(REPO_ROOT), "status", "--porcelain",
             "src/skills", "src/rules", "src/agent-src"],
            capture_output=True, text=True,
        )
        if dirty.stdout.strip():
            raise unittest.SkipTest("lintable sources dirty vs HEAD")

        cls.proc = subprocess.run(
            [sys.executable, str(SCRIPT), "--baseline", "HEAD",
             "--format", "json", "--repo-root", str(REPO_ROOT)],
            capture_output=True, text=True,
        )

    def test_zero_diff_baseline_reports_nothing(self):
        self.assertEqual(
            self.proc.returncode, 0,
            f"expected clean report, got rc={self.proc.returncode}:\n"
            f"{self.proc.stdout}\n{self.proc.stderr}",
        )
        delta = json.loads(self.proc.stdout)
        self.assertEqual(delta["regressions"], [], delta)
        self.assertEqual(delta["new_files"], [], delta)

    def test_baseline_results_are_comparable_not_disjoint(self):
        # The disjoint-guard exits 2 with this message when baseline and
        # current runs share no file keys — the PR #466 failure shape.
        self.assertNotIn("share no files", self.proc.stderr)


if __name__ == "__main__":
    unittest.main()
