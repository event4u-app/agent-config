"""Tests for ``scripts/_cli/cmd_settings_migrate``.

Phase 2.4 of ``agents/roadmaps/road-to-global-only-install.md``. Covers:

- happy-path copy from project-local ``settings/`` into the global store;
- idempotent refusal to overwrite a non-empty global file without ``--force``;
- ``--dry-run`` produces no writes and exits 0;
- ``--force`` overwrites a non-empty global file;
- empty source tree exits 0 with the no-op summary.
"""
from __future__ import annotations

import sys
import tempfile
import textwrap
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts._cli import cmd_settings_migrate as mig  # noqa: E402
from scripts import install  # noqa: E402


class SettingsMigrateTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.tmpdir = Path(self._tmp.name)
        # Stand-in global root inside the tmpdir so the test is hermetic.
        self.fake_global = self.tmpdir / "global"
        self.fake_settings = self.fake_global / ".agent-settings.yml"
        self.fake_user = self.fake_global / ".agent-user.yml"
        self._patches = [
            mock.patch.object(install, "GLOBAL_ROOT", self.fake_global),
            mock.patch.object(install, "GLOBAL_AGENT_SETTINGS_PATH", self.fake_settings),
            mock.patch.object(install, "GLOBAL_USER_SETTINGS_PATH", self.fake_user),
        ]
        for p in self._patches:
            p.start()
            self.addCleanup(p.stop)

        # Project layout — typed subdir shipped under ./settings/.
        self.project = self.tmpdir / "project"
        (self.project / "settings").mkdir(parents=True)
        (self.project / "settings" / install.SETTINGS_FILE).write_text(
            textwrap.dedent(
                """\
                cost_profile: minimal
                personal:
                  ide: phpstorm
                """
            ),
            encoding="utf-8",
        )

    def _argv(self, *extra: str) -> list[str]:
        return ["--from", str(self.project), *extra]

    def test_happy_path_copies_into_global(self) -> None:
        rc = mig.main(self._argv())
        self.assertEqual(rc, 0)
        self.assertTrue(self.fake_settings.is_file())
        body = self.fake_settings.read_text(encoding="utf-8")
        self.assertIn("cost_profile: minimal", body)
        self.assertIn("ide: phpstorm", body)

    def test_dry_run_writes_nothing(self) -> None:
        rc = mig.main(self._argv("--dry-run"))
        self.assertEqual(rc, 0)
        self.assertFalse(self.fake_settings.exists())

    def test_refuses_to_overwrite_non_empty_global_without_force(self) -> None:
        self.fake_global.mkdir(parents=True, exist_ok=True)
        self.fake_settings.write_text("cost_profile: full\n", encoding="utf-8")
        rc = mig.main(self._argv())
        self.assertEqual(rc, 1)
        # Existing global content is preserved verbatim.
        self.assertEqual(
            self.fake_settings.read_text(encoding="utf-8"),
            "cost_profile: full\n",
        )

    def test_force_overwrites_non_empty_global(self) -> None:
        self.fake_global.mkdir(parents=True, exist_ok=True)
        self.fake_settings.write_text("cost_profile: full\n", encoding="utf-8")
        rc = mig.main(self._argv("--force"))
        self.assertEqual(rc, 0)
        self.assertIn(
            "cost_profile: minimal",
            self.fake_settings.read_text(encoding="utf-8"),
        )

    def test_no_op_when_project_has_no_settings(self) -> None:
        empty_project = self.tmpdir / "empty-project"
        empty_project.mkdir()
        rc = mig.main(["--from", str(empty_project)])
        self.assertEqual(rc, 0)
        self.assertFalse(self.fake_settings.exists())


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
