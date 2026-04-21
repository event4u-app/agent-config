#!/usr/bin/env python3
"""
Tests for scripts/install.py

Run: python3 -m unittest tests.test_install_py -v
"""

import io
import json
import shutil
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

# Make scripts/install.py importable.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import install  # type: ignore  # noqa: E402


# --- Fixture helpers ---

REPO_ROOT = Path(__file__).resolve().parent.parent


def make_fake_package(root: Path) -> Path:
    """Create a minimal agent-config package under ``root``.

    Copies the real template + profile presets from the repo so tests exercise
    the actual rendering code path without depending on the repo layout.
    """
    package = root / "pkg"
    (package / "config" / "profiles").mkdir(parents=True)
    shutil.copy(REPO_ROOT / "config" / "agent-settings.template.ini", package / "config" / "agent-settings.template.ini")
    for profile in install.SUPPORTED_PROFILES:
        shutil.copy(REPO_ROOT / "config" / "profiles" / f"{profile}.ini", package / "config" / "profiles" / f"{profile}.ini")
    return package


class SilentTest(unittest.TestCase):
    """Base class that suppresses install.py's stdout/stderr chatter."""

    def setUp(self) -> None:
        install.QUIET = True

    def tearDown(self) -> None:
        install.QUIET = False


# --- parse_options ---

class TestParseOptions(unittest.TestCase):
    def test_defaults(self) -> None:
        opts = install.parse_options([])
        self.assertEqual(opts.profile, install.DEFAULT_PROFILE)
        self.assertFalse(opts.force)
        self.assertFalse(opts.skip_bridges)
        self.assertFalse(opts.quiet)
        self.assertIsNone(opts.project)
        self.assertIsNone(opts.package)

    def test_all_flags(self) -> None:
        opts = install.parse_options([
            "--profile=balanced", "--force", "--skip-bridges", "--quiet",
            "--project", "/tmp/p", "--package", "/tmp/pkg",
        ])
        self.assertEqual(opts.profile, "balanced")
        self.assertTrue(opts.force)
        self.assertTrue(opts.skip_bridges)
        self.assertTrue(opts.quiet)
        self.assertEqual(opts.project, "/tmp/p")
        self.assertEqual(opts.package, "/tmp/pkg")


# --- deep_merge ---

class TestDeepMerge(unittest.TestCase):
    def test_disjoint_keys_merged(self) -> None:
        self.assertEqual(install.deep_merge({"a": 1}, {"b": 2}), {"a": 1, "b": 2})

    def test_overlay_wins_scalar(self) -> None:
        self.assertEqual(install.deep_merge({"a": 1}, {"a": 2}), {"a": 2})

    def test_nested_dicts_merged(self) -> None:
        base = {"cfg": {"a": 1, "b": 2}}
        overlay = {"cfg": {"b": 99, "c": 3}}
        self.assertEqual(install.deep_merge(base, overlay), {"cfg": {"a": 1, "b": 99, "c": 3}})

    def test_lists_replaced_not_merged(self) -> None:
        self.assertEqual(install.deep_merge({"x": [1, 2]}, {"x": [3]}), {"x": [3]})

    def test_base_not_mutated(self) -> None:
        base = {"cfg": {"a": 1}}
        install.deep_merge(base, {"cfg": {"b": 2}})
        self.assertEqual(base, {"cfg": {"a": 1}})


# --- read_json_file ---

class TestReadJsonFile(SilentTest):
    def setUp(self) -> None:
        super().setUp()
        self.tmpdir = Path(tempfile.mkdtemp())

    def tearDown(self) -> None:
        shutil.rmtree(self.tmpdir)
        super().tearDown()

    def test_valid_json(self) -> None:
        target = self.tmpdir / "a.json"
        target.write_text('{"k": 1}', encoding="utf-8")
        self.assertEqual(install.read_json_file(target), {"k": 1})

    def test_invalid_json_returns_empty(self) -> None:
        target = self.tmpdir / "a.json"
        target.write_text("not json", encoding="utf-8")
        buf = io.StringIO()
        with redirect_stderr(buf):
            self.assertEqual(install.read_json_file(target), {})
        self.assertIn("Invalid JSON", buf.getvalue())

    def test_non_dict_returns_empty(self) -> None:
        target = self.tmpdir / "a.json"
        target.write_text("[1, 2, 3]", encoding="utf-8")
        with redirect_stderr(io.StringIO()):
            self.assertEqual(install.read_json_file(target), {})


# --- detect_package_type ---

class TestDetectPackageType(unittest.TestCase):
    def test_composer(self) -> None:
        self.assertEqual(install.detect_package_type(Path("/p/vendor/event4u/agent-config")), "composer")

    def test_npm(self) -> None:
        self.assertEqual(install.detect_package_type(Path("/p/node_modules/@event4u/agent-config")), "npm")

    def test_local(self) -> None:
        self.assertEqual(install.detect_package_type(Path("/tmp/work/agent-config")), "local")



# --- detect_package_root ---

class TestDetectPackageRoot(SilentTest):
    def setUp(self) -> None:
        super().setUp()
        self.tmpdir = Path(tempfile.mkdtemp())

    def tearDown(self) -> None:
        shutil.rmtree(self.tmpdir)
        super().tearDown()

    def test_finds_composer_layout(self) -> None:
        package = self.tmpdir / "vendor" / "event4u" / "agent-config"
        package.mkdir(parents=True)
        self.assertEqual(install.detect_package_root(self.tmpdir), package.resolve())

    def test_finds_npm_layout(self) -> None:
        package = self.tmpdir / "node_modules" / "@event4u" / "agent-config"
        package.mkdir(parents=True)
        self.assertEqual(install.detect_package_root(self.tmpdir), package.resolve())

    def test_composer_preferred_over_npm(self) -> None:
        composer = self.tmpdir / "vendor" / "event4u" / "agent-config"
        npm = self.tmpdir / "node_modules" / "@event4u" / "agent-config"
        composer.mkdir(parents=True)
        npm.mkdir(parents=True)
        self.assertEqual(install.detect_package_root(self.tmpdir), composer.resolve())

    def test_local_dev_mode(self) -> None:
        (self.tmpdir / "config" / "profiles").mkdir(parents=True)
        (self.tmpdir / "config" / "profiles" / "minimal.ini").write_text("cost_profile=minimal\n", encoding="utf-8")
        self.assertEqual(install.detect_package_root(self.tmpdir), self.tmpdir)

    def test_no_package_fails(self) -> None:
        with redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as ctx:
                install.detect_package_root(self.tmpdir)
        self.assertEqual(ctx.exception.code, 1)


# --- merge_json_file ---

class TestMergeJsonFile(SilentTest):
    def setUp(self) -> None:
        super().setUp()
        self.tmpdir = Path(tempfile.mkdtemp())
        self.target = self.tmpdir / "sub" / "settings.json"

    def tearDown(self) -> None:
        shutil.rmtree(self.tmpdir)
        super().tearDown()

    def test_creates_file_when_missing(self) -> None:
        install.merge_json_file(self.target, {"a": 1}, force=False, label="test")
        self.assertTrue(self.target.exists())
        self.assertEqual(json.loads(self.target.read_text()), {"a": 1})

    def test_skips_when_already_contains_data(self) -> None:
        install.merge_json_file(self.target, {"a": 1, "b": 2}, force=False, label="test")
        install.merge_json_file(self.target, {"a": 1}, force=False, label="test")
        self.assertEqual(json.loads(self.target.read_text()), {"a": 1, "b": 2})

    def test_skips_update_without_force(self) -> None:
        install.merge_json_file(self.target, {"a": 1}, force=False, label="test")
        install.merge_json_file(self.target, {"a": 2}, force=False, label="test")
        self.assertEqual(json.loads(self.target.read_text()), {"a": 1})

    def test_updates_with_force(self) -> None:
        install.merge_json_file(self.target, {"a": 1}, force=False, label="test")
        install.merge_json_file(self.target, {"a": 2, "b": 3}, force=True, label="test")
        self.assertEqual(json.loads(self.target.read_text()), {"a": 2, "b": 3})

    def test_preserves_user_keys_on_force_update(self) -> None:
        self.target.parent.mkdir(parents=True)
        self.target.write_text(json.dumps({"editor.fontSize": 14, "chat.pluginLocations": {"/old": True}}), encoding="utf-8")
        install.merge_json_file(self.target, {"chat.pluginLocations": {"/new": True}}, force=True, label="test")
        data = json.loads(self.target.read_text())
        self.assertEqual(data["editor.fontSize"], 14)
        self.assertEqual(data["chat.pluginLocations"], {"/old": True, "/new": True})



# --- ensure_agent_settings ---

class TestEnsureAgentSettings(SilentTest):
    def setUp(self) -> None:
        super().setUp()
        self.tmpdir = Path(tempfile.mkdtemp())
        self.project = self.tmpdir / "proj"
        self.project.mkdir()
        self.package = make_fake_package(self.tmpdir)

    def tearDown(self) -> None:
        shutil.rmtree(self.tmpdir)
        super().tearDown()

    def test_renders_placeholder(self) -> None:
        install.ensure_agent_settings(self.project, self.package, "balanced", force=False)
        content = (self.project / ".agent-settings").read_text(encoding="utf-8")
        self.assertIn("cost_profile=balanced", content)
        self.assertNotIn(install.COST_PROFILE_PLACEHOLDER, content)

    def test_seeds_subagent_keys(self) -> None:
        install.ensure_agent_settings(self.project, self.package, "balanced", force=False)
        content = (self.project / ".agent-settings").read_text(encoding="utf-8")
        self.assertIn("subagent_implementer_model=", content)
        self.assertIn("subagent_judge_model=", content)
        self.assertIn("subagent_max_parallel=3", content)

    def test_skip_when_exists_without_force(self) -> None:
        target = self.project / ".agent-settings"
        target.write_text("cost_profile=custom\n", encoding="utf-8")
        install.ensure_agent_settings(self.project, self.package, "full", force=False)
        self.assertEqual(target.read_text(encoding="utf-8"), "cost_profile=custom\n")

    def test_force_overwrites(self) -> None:
        target = self.project / ".agent-settings"
        target.write_text("cost_profile=custom\n", encoding="utf-8")
        install.ensure_agent_settings(self.project, self.package, "full", force=True)
        self.assertIn("cost_profile=full", target.read_text(encoding="utf-8"))

    def test_missing_profile_fails(self) -> None:
        with redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                install.ensure_agent_settings(self.project, self.package, "nonexistent", force=False)


# --- bridge generators ---

class TestBridges(SilentTest):
    def setUp(self) -> None:
        super().setUp()
        self.tmpdir = Path(tempfile.mkdtemp())
        self.project = self.tmpdir / "proj"
        self.project.mkdir()

    def tearDown(self) -> None:
        shutil.rmtree(self.tmpdir)
        super().tearDown()

    def test_vscode_composer_plugin_path(self) -> None:
        install.ensure_vscode_bridge(self.project, "composer", force=False)
        data = json.loads((self.project / ".vscode" / "settings.json").read_text())
        self.assertIn("./vendor/event4u/agent-config/plugin/agent-config", data["chat.pluginLocations"])

    def test_vscode_npm_plugin_path(self) -> None:
        install.ensure_vscode_bridge(self.project, "npm", force=False)
        data = json.loads((self.project / ".vscode" / "settings.json").read_text())
        self.assertIn("./node_modules/@event4u/agent-config/plugin/agent-config", data["chat.pluginLocations"])

    def test_vscode_local_fallback(self) -> None:
        install.ensure_vscode_bridge(self.project, "local", force=False)
        data = json.loads((self.project / ".vscode" / "settings.json").read_text())
        self.assertIn("./plugin/agent-config", data["chat.pluginLocations"])

    def test_augment_bridge(self) -> None:
        install.ensure_augment_bridge(self.project, force=False)
        data = json.loads((self.project / ".augment" / "settings.json").read_text())
        self.assertTrue(data["enabledPlugins"]["agent-config@event4u"])

    def test_copilot_bridge(self) -> None:
        install.ensure_copilot_bridge(self.project, force=False)
        data = json.loads((self.project / ".github" / "plugin" / "marketplace.json").read_text())
        self.assertEqual(data["marketplace"]["name"], "event4u-agent-marketplace")
        plugin_ids = [p["id"] for p in data["marketplace"]["plugins"]]
        self.assertIn("agent-config@event4u", plugin_ids)

    def test_copilot_bridge_skip_without_force(self) -> None:
        target = self.project / ".github" / "plugin" / "marketplace.json"
        target.parent.mkdir(parents=True)
        target.write_text('{"marketplace": {"name": "custom"}}', encoding="utf-8")
        install.ensure_copilot_bridge(self.project, force=False)
        data = json.loads(target.read_text())
        self.assertEqual(data["marketplace"]["name"], "custom")


# --- main() integration ---

class TestMainIntegration(unittest.TestCase):
    def setUp(self) -> None:
        self.tmpdir = Path(tempfile.mkdtemp())
        self.project = self.tmpdir / "proj"
        self.project.mkdir()
        self.package = make_fake_package(self.tmpdir)

    def tearDown(self) -> None:
        shutil.rmtree(self.tmpdir)
        install.QUIET = False

    def _run(self, *args: str) -> int:
        buf = io.StringIO()
        with redirect_stdout(buf), redirect_stderr(buf):
            return install.main([
                "--project", str(self.project),
                "--package", str(self.package),
                "--quiet",
                *args,
            ])

    def test_full_run_creates_all_files(self) -> None:
        exit_code = self._run()
        self.assertEqual(exit_code, 0)
        self.assertTrue((self.project / ".agent-settings").exists())
        self.assertTrue((self.project / ".vscode" / "settings.json").exists())
        self.assertTrue((self.project / ".augment" / "settings.json").exists())
        self.assertTrue((self.project / ".github" / "plugin" / "marketplace.json").exists())

    def test_skip_bridges_only_creates_settings(self) -> None:
        self.assertEqual(self._run("--skip-bridges"), 0)
        self.assertTrue((self.project / ".agent-settings").exists())
        self.assertFalse((self.project / ".vscode").exists())
        self.assertFalse((self.project / ".augment").exists())
        self.assertFalse((self.project / ".github").exists())

    def test_invalid_profile_exits_nonzero(self) -> None:
        with self.assertRaises(SystemExit) as ctx:
            self._run("--profile=bogus")
        self.assertEqual(ctx.exception.code, 1)

    def test_idempotent(self) -> None:
        self.assertEqual(self._run(), 0)
        content_first = (self.project / ".agent-settings").read_text(encoding="utf-8")
        self.assertEqual(self._run(), 0)
        content_second = (self.project / ".agent-settings").read_text(encoding="utf-8")
        self.assertEqual(content_first, content_second)

    def test_profile_is_rendered_into_settings(self) -> None:
        self.assertEqual(self._run("--profile=full"), 0)
        content = (self.project / ".agent-settings").read_text(encoding="utf-8")
        self.assertIn("cost_profile=full", content)


if __name__ == "__main__":
    unittest.main()
