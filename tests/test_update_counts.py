#!/usr/bin/env python3
"""Tests for scripts/update_counts.py

Run: python3 -m pytest tests/test_update_counts.py -v
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import update_counts  # noqa: E402


class TestApplyToText(unittest.TestCase):
    def test_replaces_single_number_in_match(self):
        text = "Browse all 54 commands] today."
        counts = {"commands": 57}
        patterns = [(r"(Browse all )(\d+)( commands\])", "commands")]
        new_text, drifts = update_counts.apply_to_text(text, patterns, counts)
        self.assertIn("Browse all 57 commands]", new_text)
        self.assertEqual(drifts, [("commands", 54, 57)])

    def test_no_drift_when_number_matches(self):
        text = "Browse all 57 commands]."
        counts = {"commands": 57}
        patterns = [(r"(Browse all )(\d+)( commands\])", "commands")]
        new_text, drifts = update_counts.apply_to_text(text, patterns, counts)
        self.assertEqual(new_text, text)
        self.assertEqual(drifts, [])

    def test_missing_pattern_does_not_crash(self):
        text = "unrelated content"
        counts = {"commands": 57}
        patterns = [(r"(Browse all )(\d+)( commands\])", "commands")]
        new_text, drifts = update_counts.apply_to_text(text, patterns, counts)
        self.assertEqual(new_text, text)
        self.assertEqual(drifts, [])

    def test_multiple_patterns_applied_independently(self):
        text = "Has 100 skills and 54 commands."
        counts = {"skills": 112, "commands": 57}
        patterns = [
            (r"(Has )(\d+)( skills)", "skills"),
            (r"(and )(\d+)( commands)", "commands"),
        ]
        new_text, drifts = update_counts.apply_to_text(text, patterns, counts)
        self.assertIn("Has 112 skills", new_text)
        self.assertIn("and 57 commands", new_text)
        self.assertEqual(
            sorted(drifts), sorted([("skills", 100, 112), ("commands", 54, 57)])
        )

    def test_same_pattern_multiple_matches_all_updated(self):
        text = "Browse all 54 commands] and Browse all 54 commands] later."
        counts = {"commands": 57}
        patterns = [(r"(Browse all )(\d+)( commands\])", "commands")]
        new_text, drifts = update_counts.apply_to_text(text, patterns, counts)
        self.assertEqual(new_text.count("Browse all 57 commands]"), 2)
        self.assertEqual(len(drifts), 2)


class TestCount(unittest.TestCase):
    """Sanity-check the count() function against the real package tree."""

    def test_skills_non_zero(self):
        self.assertGreater(update_counts.count("skills"), 0)

    def test_rules_non_zero(self):
        self.assertGreater(update_counts.count("rules"), 0)

    def test_commands_non_zero(self):
        self.assertGreater(update_counts.count("commands"), 0)

    def test_guidelines_counts_nested(self):
        # Guidelines live in topic subdirectories; recursive walk is required.
        self.assertGreater(update_counts.count("guidelines"), 0)


class TestEndToEnd(unittest.TestCase):
    """The --check mode must pass on a clean working tree."""

    def test_check_mode_exits_zero_on_clean_tree(self):
        import subprocess

        repo_root = Path(__file__).resolve().parent.parent
        result = subprocess.run(
            ["python3", "scripts/update_counts.py", "--check"],
            cwd=repo_root,
            capture_output=True,
            text=True,
        )
        self.assertEqual(
            result.returncode,
            0,
            f"counts-check failed unexpectedly.\nstdout: {result.stdout}\nstderr: {result.stderr}",
        )


if __name__ == "__main__":
    unittest.main()
