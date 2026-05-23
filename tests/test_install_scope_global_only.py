#!/usr/bin/env python3
"""Regression tests for the consumer-facing global-only scope gate.

road-to-global-only-install § Phase 3.2 / 3.5. Verifies that
``_enforce_consumer_global_only`` honors ``AGENT_CONFIG_DEV_MODE=1`` and
hard-rejects the project scope otherwise. Run:

    python3 -m unittest tests.test_install_scope_global_only -v
"""

import io
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from contextlib import redirect_stderr
from pathlib import Path
from typing import Dict, Optional
from unittest import mock

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

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


class TestBashOrchestratorScopeGate(unittest.TestCase):
    """Phase 3.3 / 3.5 — `scripts/install` bash gate is the consumer entry point.

    Direct subprocess invocations cover the same surface a real
    ``curl … | bash`` pipeline hits: the gate fires before any work,
    the error message points at the maintainer doc, and ``--dry-run``
    is strictly read-only (no filesystem writes, no env mutation that
    leaks past the process boundary).
    """

    SCRIPT = REPO_ROOT / "scripts" / "install"

    def _run(self, *args: str, env_overrides: Optional[Dict[str, str]] = None,
             cwd: Optional[Path] = None) -> "subprocess.CompletedProcess[str]":
        env = os.environ.copy()
        env.pop("AGENT_CONFIG_DEV_MODE", None)
        if env_overrides:
            env.update(env_overrides)
        return subprocess.run(
            ["bash", str(self.SCRIPT), *args],
            check=False,
            capture_output=True,
            text=True,
            cwd=str(cwd or REPO_ROOT),
            env=env,
            timeout=30,
        )

    def test_scope_project_without_dev_mode_exits_nonzero(self) -> None:
        result = self._run("--scope=project", "--dry-run", "--yes")
        self.assertNotEqual(result.returncode, 0)
        combined = result.stdout + result.stderr
        self.assertIn("reserved for maintainers", combined)
        self.assertIn("docs/maintainers/dev-mode.md", combined)

    def test_scope_project_space_form_without_dev_mode_exits_nonzero(self) -> None:
        # `--scope project` (with space) hits the same gate as `--scope=project`.
        result = self._run("--scope", "project", "--dry-run", "--yes")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("reserved for maintainers", result.stdout + result.stderr)

    def test_scope_project_with_dev_mode_passes_the_scope_gate(self) -> None:
        # In dev mode the scope gate yields. A downstream "refusing to
        # install into own source" guard is allowed to fire — the only
        # assertion here is that the scope-gate message must NOT appear.
        result = self._run(
            "--scope=project",
            "--dry-run",
            "--yes",
            env_overrides={"AGENT_CONFIG_DEV_MODE": "1"},
        )
        self.assertNotIn(
            "reserved for maintainers",
            result.stdout + result.stderr,
        )

    def test_scope_global_is_allowed_without_dev_mode(self) -> None:
        # global is the consumer default and must never trip the gate.
        result = self._run("--scope=global", "--dry-run", "--yes")
        self.assertNotIn("reserved for maintainers", result.stdout + result.stderr)

    def test_dry_run_is_strictly_read_only(self) -> None:
        # `--dry-run` must not write anywhere under the consumer target.
        # Run from a clean temp dir so we can assert zero filesystem
        # side-effects: no agents/, no .augment/, no .claude/ created.
        with tempfile.TemporaryDirectory() as raw:
            target = Path(raw)
            result = self._run(
                "--dry-run",
                "--yes",
                f"--target={target}",
                cwd=target,
            )
            # Exit code is allowed to be nonzero (e.g. missing source
            # detection in an empty cwd) — the only contract is no writes.
            sentinel = sorted(p.name for p in target.iterdir())
            self.assertEqual(
                sentinel,
                [],
                msg=(
                    f"--dry-run leaked files into the target ({sentinel}). "
                    f"stdout={result.stdout!r} stderr={result.stderr!r}"
                ),
            )


if __name__ == "__main__":
    unittest.main()
