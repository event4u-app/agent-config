#!/usr/bin/env python3
"""Tests for the P3 conflict-detection layer in scripts/install.py.

Covers:
* ``ConflictPolicy`` construction + env-var wiring (P3.4).
* ``_resolve_file_conflict`` in legacy / known-path / foreign cases (P3.1).
* ``_detect_foreign_pointers`` + ``merge_json_file`` pointer-replace
  semantics (P3.2 / P3.3).
* Non-interactive abort vs ``AGENT_CONFIG_ALLOW_OVERWRITE=1`` (P3.4).

Run: python3 -m unittest tests.test_conflict_policy -v
"""
from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import install  # type: ignore  # noqa: E402


def _make_policy(
    *,
    force: bool = False,
    interactive: bool = False,
    known_paths: set[str] | None = None,
    known_pointers: set[tuple[str, str]] | None = None,
) -> install.ConflictPolicy:
    return install.ConflictPolicy(
        force=force,
        interactive=interactive,
        known_paths=known_paths or set(),
        known_pointers=known_pointers or set(),
    )


class _PolicyCase(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp())
        # Save & clear env so tests don't leak state.
        self._saved_env = os.environ.pop(install.ALLOW_OVERWRITE_ENV, None)
        install._set_conflict_policy(None)

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp, ignore_errors=True)
        install._set_conflict_policy(None)
        if self._saved_env is not None:
            os.environ[install.ALLOW_OVERWRITE_ENV] = self._saved_env


class TestResolveFileConflict(_PolicyCase):
    """P3.1 — pre-write existence check via :func:`_resolve_file_conflict`."""

    def test_missing_target_always_writes(self) -> None:
        target = self.tmp / "nope.txt"
        self.assertEqual(install._resolve_file_conflict(target, force_hint=False), "write")

    def test_legacy_mode_force_writes(self) -> None:
        target = self.tmp / "x.txt"
        target.write_text("old")
        self.assertEqual(install._resolve_file_conflict(target, force_hint=True), "write")

    def test_legacy_mode_no_force_skips(self) -> None:
        target = self.tmp / "x.txt"
        target.write_text("old")
        self.assertEqual(install._resolve_file_conflict(target, force_hint=False), "skip")

    def test_known_path_no_force_skips(self) -> None:
        target = self.tmp / "ours.txt"
        target.write_text("ours")
        install._set_conflict_policy(_make_policy(known_paths={str(target)}))
        self.assertEqual(install._resolve_file_conflict(target, force_hint=False), "skip")

    def test_known_path_with_force_writes(self) -> None:
        target = self.tmp / "ours.txt"
        target.write_text("ours")
        install._set_conflict_policy(_make_policy(known_paths={str(target)}))
        self.assertEqual(install._resolve_file_conflict(target, force_hint=True), "write")

    def test_foreign_target_non_interactive_aborts(self) -> None:
        target = self.tmp / "foreign.txt"
        target.write_text("foreign")
        install._set_conflict_policy(_make_policy())
        with self.assertRaises(install.ConflictAbort):
            install._resolve_file_conflict(target, force_hint=False)

    def test_foreign_target_policy_force_writes(self) -> None:
        target = self.tmp / "foreign.txt"
        target.write_text("foreign")
        install._set_conflict_policy(_make_policy(force=True))
        self.assertEqual(install._resolve_file_conflict(target, force_hint=False), "write")


class TestEnvVarOverride(_PolicyCase):
    """P3.4 — ``AGENT_CONFIG_ALLOW_OVERWRITE=1`` lifts conflicts."""

    def test_env_var_unset_is_not_force(self) -> None:
        self.assertFalse(install._allow_overwrite_env())

    def test_env_var_one_is_force(self) -> None:
        os.environ[install.ALLOW_OVERWRITE_ENV] = "1"
        self.assertTrue(install._allow_overwrite_env())

    def test_load_policy_with_env_var_force(self) -> None:
        os.environ[install.ALLOW_OVERWRITE_ENV] = "1"
        policy = install._load_conflict_policy(self.tmp, force=False)
        self.assertTrue(policy.force)

    def test_load_policy_without_env_var(self) -> None:
        policy = install._load_conflict_policy(self.tmp, force=False)
        self.assertFalse(policy.force)


class TestDetectForeignPointers(_PolicyCase):
    """P3.3 — JSON pointer conflict detection."""

    def test_no_existing_keys_no_foreign(self) -> None:
        install._set_conflict_policy(_make_policy())
        entries = install.build_merge_entries("x.json", {"a": 1})
        self.assertEqual(install._detect_foreign_pointers({}, entries, "x.json", install._get_conflict_policy()), [])

    def test_existing_key_not_in_known_is_foreign(self) -> None:
        install._set_conflict_policy(_make_policy())
        entries = install.build_merge_entries("x.json", {"a": 1})
        self.assertEqual(
            install._detect_foreign_pointers({"a": "old"}, entries, "x.json", install._get_conflict_policy()),
            ["/a"],
        )

    def test_existing_key_in_known_is_not_foreign(self) -> None:
        install._set_conflict_policy(_make_policy(known_pointers={("x.json", "/a")}))
        entries = install.build_merge_entries("x.json", {"a": 1})
        self.assertEqual(
            install._detect_foreign_pointers({"a": "ours"}, entries, "x.json", install._get_conflict_policy()),
            [],
        )

    def test_legacy_mode_disables_detection(self) -> None:
        # No policy set → legacy mode → always empty.
        entries = install.build_merge_entries("x.json", {"a": 1})
        self.assertEqual(
            install._detect_foreign_pointers({"a": "old"}, entries, "x.json", install._get_conflict_policy()),
            [],
        )


class TestMergeJsonFilePointerReplace(_PolicyCase):
    """P3.2 — pointer-replace semantics; sibling keys survive --force."""

    def test_force_preserves_sibling_neighbour_keys(self) -> None:
        target = self.tmp / "settings.json"
        target.parent.mkdir(parents=True, exist_ok=True)
        # Foreign content + one of ours already on disk.
        target.write_text(json.dumps({
            "neighbour": {"keep": True},
            "ours": {"old": 1},
        }))
        # Manifest declares we own the `/ours/old` pointer.
        install._set_conflict_policy(_make_policy(
            force=True,
            known_pointers={("settings.json", "/ours/old")},
        ))
        install.merge_json_file(target, {"ours": {"old": 2}}, force=True, label="settings.json")
        data = json.loads(target.read_text())
        self.assertEqual(data["neighbour"], {"keep": True})
        self.assertEqual(data["ours"], {"old": 2})

    def test_foreign_pointer_non_interactive_aborts(self) -> None:
        target = self.tmp / "settings.json"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps({"foreign_key": "neighbour-wrote-this"}))
        install._set_conflict_policy(_make_policy())  # not force, not interactive
        with self.assertRaises(install.ConflictAbort):
            install.merge_json_file(target, {"foreign_key": "ours"}, force=False, label="settings.json")
        # File untouched.
        self.assertEqual(json.loads(target.read_text()), {"foreign_key": "neighbour-wrote-this"})

    def test_foreign_pointer_with_policy_force_overwrites(self) -> None:
        target = self.tmp / "settings.json"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps({"foreign_key": "neighbour-wrote-this", "keep": "this"}))
        install._set_conflict_policy(_make_policy(force=True))
        install.merge_json_file(target, {"foreign_key": "ours"}, force=False, label="settings.json")
        data = json.loads(target.read_text())
        self.assertEqual(data["foreign_key"], "ours")
        self.assertEqual(data["keep"], "this")  # Sibling preserved.

    def test_legacy_mode_behaves_pre_p3(self) -> None:
        target = self.tmp / "settings.json"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps({"a": "old"}))
        # No policy set; force=False → legacy skip.
        install.merge_json_file(target, {"a": "new"}, force=False, label="settings.json")
        self.assertEqual(json.loads(target.read_text()), {"a": "old"})


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
