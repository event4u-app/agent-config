#!/usr/bin/env python3
"""Regression tests for the consumer-facing global-only scope gate.

road-to-global-only-install § Phase 3.2 / 3.5. Verifies that
``_enforce_consumer_global_only`` honors ``AGENT_CONFIG_DEV_MODE=1`` and
hard-rejects the project scope otherwise. Run:

    python3 -m unittest tests.test_install_scope_global_only -v
"""

import io
import sys
import tempfile
import textwrap
import unittest
from contextlib import redirect_stderr
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import install  # type: ignore  # noqa: E402


class TestEnforceConsumerGlobalOnly(unittest.TestCase):
    """`_enforce_consumer_global_only` — Phase 3.2 dev-mode gate."""

    def test_global_scope_is_always_allowed(self) -> None:
        with mock.patch.dict("os.environ", {}, clear=False):
            install.os.environ.pop("AGENT_CONFIG_DEV_MODE", None)
            install._enforce_consumer_global_only("global")

    def test_global_scope_with_dev_mode_is_allowed(self) -> None:
        with mock.patch.dict("os.environ", {"AGENT_CONFIG_DEV_MODE": "1"}):
            install._enforce_consumer_global_only("global")

    def test_project_scope_with_dev_mode_is_allowed(self) -> None:
        with mock.patch.dict("os.environ", {"AGENT_CONFIG_DEV_MODE": "1"}):
            install._enforce_consumer_global_only("project")

    def test_project_scope_without_dev_mode_is_rejected(self) -> None:
        env = {k: v for k, v in install.os.environ.items() if k != "AGENT_CONFIG_DEV_MODE"}
        with mock.patch.dict("os.environ", env, clear=True):
            with redirect_stderr(io.StringIO()) as buf:
                with self.assertRaises(SystemExit):
                    install._enforce_consumer_global_only("project")
            self.assertIn("AGENT_CONFIG_DEV_MODE", buf.getvalue())

    def test_project_scope_with_dev_mode_other_value_is_rejected(self) -> None:
        # Only the literal "1" opts in. "true", "yes", "on" do not.
        with mock.patch.dict("os.environ", {"AGENT_CONFIG_DEV_MODE": "true"}):
            with redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit):
                    install._enforce_consumer_global_only("project")


class TestGlobalPathConstants(unittest.TestCase):
    """Phase 2.1 — canonical global path constants."""

    def test_global_root_resolves_under_home(self) -> None:
        self.assertEqual(install.GLOBAL_ROOT, Path.home() / ".event4u" / "agent-config")

    def test_user_settings_path(self) -> None:
        self.assertEqual(
            install.GLOBAL_USER_SETTINGS_PATH,
            install.GLOBAL_ROOT / ".agent-user.yml",
        )

    def test_agent_settings_path(self) -> None:
        self.assertEqual(
            install.GLOBAL_AGENT_SETTINGS_PATH,
            install.GLOBAL_ROOT / ".agent-settings.yml",
        )


class TestLayeredSettingsReader(unittest.TestCase):
    """Phase 2.2 — ``defaults < global < project-overrides`` merge order."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.tmpdir = Path(self._tmp.name)
        self.package_root = self.tmpdir / "pkg"
        (self.package_root / "config").mkdir(parents=True)
        # Minimal template body — the rendered version must be valid YAML
        # after placeholder substitution.
        (self.package_root / "config" / "agent-settings.template.yml").write_text(
            textwrap.dedent(
                """\
                cost_profile: __COST_PROFILE__
                personal:
                  user_type: "__USER_TYPE__"
                  ide: vscode
                project:
                  pr_template: short
                """
            ),
            encoding="utf-8",
        )
        self.fake_global = self.tmpdir / "global.yml"
        self._patch = mock.patch.object(install, "GLOBAL_AGENT_SETTINGS_PATH", self.fake_global)
        self._patch.start()
        self.addCleanup(self._patch.stop)

    def test_defaults_only_when_no_global_no_project(self) -> None:
        merged = install.read_layered_settings(self.package_root, project_root=None)
        self.assertEqual(merged["cost_profile"], install.DEFAULT_PROFILE)
        self.assertEqual(merged["personal"]["ide"], "vscode")

    def test_global_overrides_defaults(self) -> None:
        self.fake_global.write_text(
            "cost_profile: full\npersonal:\n  ide: cursor\n",
            encoding="utf-8",
        )
        merged = install.read_layered_settings(self.package_root, project_root=None)
        self.assertEqual(merged["cost_profile"], "full")
        self.assertEqual(merged["personal"]["ide"], "cursor")
        # Untouched defaults still surface.
        self.assertEqual(merged["project"]["pr_template"], "short")

    def test_project_overrides_global_and_defaults(self) -> None:
        self.fake_global.write_text(
            "cost_profile: full\npersonal:\n  ide: cursor\n",
            encoding="utf-8",
        )
        project_root = self.tmpdir / "proj"
        project_root.mkdir()
        (project_root / install.SETTINGS_FILE).write_text(
            "cost_profile: minimal\nproject:\n  pr_template: detailed\n",
            encoding="utf-8",
        )
        merged = install.read_layered_settings(self.package_root, project_root=project_root)
        # Project wins over global wins over defaults.
        self.assertEqual(merged["cost_profile"], "minimal")
        self.assertEqual(merged["project"]["pr_template"], "detailed")
        # Global-only keys still leak through the merge.
        self.assertEqual(merged["personal"]["ide"], "cursor")

    def test_missing_project_layer_collapses_to_two_layer_merge(self) -> None:
        self.fake_global.write_text("cost_profile: full\n", encoding="utf-8")
        project_root = self.tmpdir / "proj-without-file"
        project_root.mkdir()
        merged = install.read_layered_settings(self.package_root, project_root=project_root)
        self.assertEqual(merged["cost_profile"], "full")
        self.assertEqual(merged["personal"]["ide"], "vscode")

    def test_unparseable_global_falls_back_silently(self) -> None:
        self.fake_global.write_text("::: not yaml :::\n", encoding="utf-8")
        merged = install.read_layered_settings(self.package_root, project_root=None)
        self.assertEqual(merged["cost_profile"], install.DEFAULT_PROFILE)


if __name__ == "__main__":
    unittest.main()
