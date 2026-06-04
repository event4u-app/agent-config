#!/usr/bin/env python3
"""Tests for the install conflict-resolution behaviour in scripts/install.py.

A deliberate setup deploys our own files into our own layout, so there is
no "foreign" file to protect: every write is an overwrite of our own
content. These tests lock that contract.

Covers:
* ``_resolve_file_conflict`` — always ``"write"`` (existing, missing, or
  manifest-untracked targets alike).
* ``merge_json_file`` — create / already-synced skip / update; the additive
  deep-merge preserves sibling-package keys; our keys apply with no
  ``--force`` gate and no abort.
* The removed foreign-file gate surface (``ConflictAbort``,
  ``AGENT_CONFIG_ALLOW_OVERWRITE``, the interactive prompts, the
  foreign-pointer detector) stays removed.

Run: python3 -m unittest tests.test_conflict_policy -v
"""
from __future__ import annotations

import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src" / "scripts"))

import install  # type: ignore  # noqa: E402


class _TmpCase(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp())

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp, ignore_errors=True)


class TestResolveFileConflict(_TmpCase):
    """A deployed file is always overwritten — no skip, no abort, no gate."""

    def test_missing_target_writes(self) -> None:
        target = self.tmp / "nope.txt"
        self.assertEqual(install._resolve_file_conflict(target, force_hint=False), "write")

    def test_existing_target_writes_without_force(self) -> None:
        target = self.tmp / "x.txt"
        target.write_text("old")
        self.assertEqual(install._resolve_file_conflict(target, force_hint=False), "write")

    def test_existing_target_writes_with_force(self) -> None:
        target = self.tmp / "x.txt"
        target.write_text("old")
        self.assertEqual(install._resolve_file_conflict(target, force_hint=True), "write")


class TestGateSurfaceRemoved(unittest.TestCase):
    """The old foreign-file gate and its escape hatch are gone for good."""

    def test_no_conflict_abort_symbol(self) -> None:
        self.assertFalse(hasattr(install, "ConflictAbort"))

    def test_no_allow_overwrite_env(self) -> None:
        self.assertFalse(hasattr(install, "ALLOW_OVERWRITE_ENV"))
        self.assertFalse(hasattr(install, "_allow_overwrite_env"))

    def test_no_conflict_policy(self) -> None:
        self.assertFalse(hasattr(install, "ConflictPolicy"))
        self.assertFalse(hasattr(install, "_load_conflict_policy"))

    def test_no_foreign_pointer_detector(self) -> None:
        self.assertFalse(hasattr(install, "_detect_foreign_pointers"))
        self.assertFalse(hasattr(install, "_resolve_json_conflict"))


class TestMergeJsonFile(_TmpCase):
    """Additive merge: our keys apply, sibling keys survive, no --force gate."""

    def test_creates_when_missing(self) -> None:
        target = self.tmp / "settings.json"
        entries = install.merge_json_file(target, {"a": 1}, force=False, label="settings.json")
        self.assertEqual(json.loads(target.read_text()), {"a": 1})
        self.assertTrue(entries)  # manifest entries returned for uninstall

    def test_already_synced_is_skipped(self) -> None:
        target = self.tmp / "settings.json"
        target.write_text(json.dumps({"a": 1}, indent=4) + "\n")
        install.merge_json_file(target, {"a": 1}, force=False, label="settings.json")
        # Unchanged content — value stays.
        self.assertEqual(json.loads(target.read_text()), {"a": 1})

    def test_updates_our_key_without_force_and_preserves_siblings(self) -> None:
        target = self.tmp / "settings.json"
        target.write_text(json.dumps({
            "neighbour": {"keep": True},
            "ours": {"old": 1},
        }))
        # No --force needed: our overlay applies, neighbour key untouched.
        install.merge_json_file(target, {"ours": {"old": 2}}, force=False, label="settings.json")
        data = json.loads(target.read_text())
        self.assertEqual(data["neighbour"], {"keep": True})
        self.assertEqual(data["ours"], {"old": 2})

    def test_overwrites_preexisting_value_at_our_pointer(self) -> None:
        target = self.tmp / "settings.json"
        target.write_text(json.dumps({"foreign_key": "older-value", "keep": "this"}))
        # Previously this aborted as a "foreign pointer"; now our key wins
        # and the sibling key survives the additive merge.
        install.merge_json_file(target, {"foreign_key": "ours"}, force=False, label="settings.json")
        data = json.loads(target.read_text())
        self.assertEqual(data["foreign_key"], "ours")
        self.assertEqual(data["keep"], "this")


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
