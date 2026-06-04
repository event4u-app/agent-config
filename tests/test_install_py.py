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
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src" / "scripts"))

import install  # type: ignore  # noqa: E402


# --- Fixture helpers ---

REPO_ROOT = Path(__file__).resolve().parent.parent


def make_fake_package(root: Path) -> Path:
    """Create a minimal agent-config package under ``root``.

    Copies the real template + profile presets from the repo so tests exercise
    the actual rendering code path without depending on the repo layout.
    Also seeds ``user-types/*.yml`` so install paths that validate the
    step-9 axis can run without a fully-checked-out package.
    """
    package = root / "pkg"
    (package / "config" / "profiles").mkdir(parents=True)
    shutil.copy(REPO_ROOT / "config" / "agent-settings.template.yml", package / "config" / "agent-settings.template.yml")
    for profile in install.SUPPORTED_PROFILES:
        shutil.copy(REPO_ROOT / "config" / "profiles" / f"{profile}.ini", package / "config" / "profiles" / f"{profile}.ini")
    user_types_src = REPO_ROOT / "user-types"
    if user_types_src.is_dir():
        (package / "user-types").mkdir(parents=True, exist_ok=True)
        for yml in user_types_src.glob("*.yml"):
            shutil.copy(yml, package / "user-types" / yml.name)
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

    def test_tools_default_all(self) -> None:
        opts = install.parse_options([])
        self.assertEqual(opts.tools, "all")

    def test_tools_explicit_value(self) -> None:
        opts = install.parse_options(["--tools=cursor,claude-code"])
        self.assertEqual(opts.tools, "cursor,claude-code")

    def test_ai_alias_alone(self) -> None:
        opts = install.parse_options(["--ai=cursor"])
        self.assertEqual(opts.tools, "cursor")

    def test_ai_alias_long_form(self) -> None:
        opts = install.parse_options(["--ai", "cursor,augment"])
        self.assertEqual(opts.tools, "cursor,augment")

    def test_ai_and_tools_union(self) -> None:
        opts = install.parse_options(["--ai=cursor", "--tools=claude-code"])
        self.assertEqual(set(opts.tools.split(",")), {"cursor", "claude-code"})

    def test_ai_and_tools_dedupe(self) -> None:
        opts = install.parse_options(["--ai=cursor", "--tools=cursor"])
        self.assertEqual(opts.tools, "cursor")


# --- _merge_tools_aliases (Phase 2.4) ---

class TestMergeToolsAliases(unittest.TestCase):
    def test_both_none_returns_all(self) -> None:
        self.assertEqual(install._merge_tools_aliases(None, None), "all")

    def test_tools_only(self) -> None:
        self.assertEqual(
            install._merge_tools_aliases("cursor", None), "cursor",
        )

    def test_ai_only(self) -> None:
        self.assertEqual(
            install._merge_tools_aliases(None, "cursor"), "cursor",
        )

    def test_union_preserves_first_seen_order(self) -> None:
        result = install._merge_tools_aliases("cursor,claude-code", "augment")
        self.assertEqual(result, "cursor,claude-code,augment")

    def test_dedupes_across_sources(self) -> None:
        result = install._merge_tools_aliases("cursor,claude-code", "cursor")
        self.assertEqual(result, "cursor,claude-code")

    def test_strips_whitespace(self) -> None:
        result = install._merge_tools_aliases(" cursor , claude-code ", None)
        self.assertEqual(result, "cursor,claude-code")


# --- _parse_tools / _is_tool_enabled ---

class TestParseTools(SilentTest):
    def test_all_expands_to_concrete_ids(self) -> None:
        result = install._parse_tools("all")
        self.assertNotIn("all", result)
        self.assertIn("claude-code", result)
        self.assertIn("cursor", result)
        self.assertIn("copilot", result)

    def test_single_tool(self) -> None:
        self.assertEqual(install._parse_tools("cursor"), {"cursor"})

    def test_comma_list(self) -> None:
        self.assertEqual(
            install._parse_tools("cursor,claude-code,windsurf"),
            {"cursor", "claude-code", "windsurf"},
        )

    def test_whitespace_tolerant(self) -> None:
        self.assertEqual(
            install._parse_tools(" cursor , claude-code "),
            {"cursor", "claude-code"},
        )

    def test_empty_rejected(self) -> None:
        with redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                install._parse_tools("")

    def test_unknown_id_rejected(self) -> None:
        with redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                install._parse_tools("cursor,not-a-tool")

    def test_is_tool_enabled(self) -> None:
        tools = install._parse_tools("cursor,claude-code")
        self.assertTrue(install._is_tool_enabled(tools, "cursor"))
        self.assertTrue(install._is_tool_enabled(tools, "claude-code"))
        self.assertFalse(install._is_tool_enabled(tools, "windsurf"))


# --- _validate_scope / _tools_was_all ---
#
# Phase 3.1 of road-to-global-only-install flipped SCOPE_SUPPORT so every
# consumer-facing AI ID is "global". The only remaining "both" entry is
# `copilot` (no user-scope convention by design). Project-scope installs
# require AGENT_CONFIG_DEV_MODE=1 via `_enforce_consumer_global_only` —
# orthogonal to the matrix check tested here.

class TestValidateScope(SilentTest):
    def test_global_scope_passes_global_only_tools(self) -> None:
        result = install._validate_scope(
            {"claude-code", "cursor"}, "global", was_all=False,
        )
        self.assertEqual(result, {"claude-code", "cursor"})

    def test_copilot_accepts_project(self) -> None:
        # Phase 3.1: copilot keeps scope="both" because
        # `copilot-instructions.md` lives in-repo by design.
        result = install._validate_scope({"copilot"}, "project", was_all=False)
        self.assertIn("copilot", result)

    def test_roocode_accepts_global(self) -> None:
        result = install._validate_scope({"roocode"}, "global", was_all=False)
        self.assertIn("roocode", result)

    def test_global_only_tool_rejects_project(self) -> None:
        with redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                install._validate_scope(
                    {"claude-desktop"}, "project", was_all=False,
                )

    def test_kilocode_accepts_global(self) -> None:
        result = install._validate_scope({"kilocode"}, "global", was_all=False)
        self.assertIn("kilocode", result)

    def test_jetbrains_rejects_project(self) -> None:
        with redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                install._validate_scope(
                    {"jetbrains"}, "project", was_all=False,
                )

    def test_claude_code_rejects_project(self) -> None:
        # Phase 3.1: claude-code is now global-only at the matrix layer.
        with redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                install._validate_scope(
                    {"claude-code"}, "project", was_all=False,
                )

    def test_cursor_rejects_project(self) -> None:
        # Phase 3.1: cursor is now global-only at the matrix layer.
        with redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                install._validate_scope(
                    {"cursor"}, "project", was_all=False,
                )

    def test_qoder_rejects_project(self) -> None:
        # Phase 2.4 expansion tools are global-only until project bridges land.
        with redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                install._validate_scope({"qoder"}, "project", was_all=False)

    def test_augment_rejects_project(self) -> None:
        # ADR-007 Amendment 2026-05-13 (global-only): augment ships from a
        # single user-scope tree (~/.augment/). Explicit `--tools=augment`
        # without `--global` must hard-reject with a remediation hint.
        with redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                install._validate_scope({"augment"}, "project", was_all=False)

    def test_all_silent_filters_global_only_under_project(self) -> None:
        # Phase 3.1: every AI ID except copilot is global-only — under
        # `--tools=all --project`, only copilot survives the silent filter.
        result = install._validate_scope(
            {"claude-desktop", "jetbrains", "claude-code", "cursor", "copilot"},
            "project",
            was_all=True,
        )
        self.assertEqual(result, {"copilot"})

    def test_all_silent_filters_augment_under_project(self) -> None:
        # `--tools=all` (default scope=project) must drop `augment` silently.
        result = install._validate_scope(
            {"augment", "copilot"},
            "project",
            was_all=True,
        )
        self.assertNotIn("augment", result)
        self.assertIn("copilot", result)

    def test_all_silent_filters_phase24_tools_under_project(self) -> None:
        # Phase 2.4 expansion tools (qoder, opencode, ...) are global-only
        # and must be filtered out of `--tools=all --project`. Phase 3.1
        # flipped claude-code/cursor to global-only too; only copilot survives.
        result = install._validate_scope(
            {"qoder", "opencode", "warp", "claude-code", "cursor", "copilot"},
            "project",
            was_all=True,
        )
        self.assertNotIn("qoder", result)
        self.assertNotIn("opencode", result)
        self.assertNotIn("warp", result)
        self.assertNotIn("claude-code", result)
        self.assertNotIn("cursor", result)
        self.assertIn("copilot", result)


class TestToolsWasAll(unittest.TestCase):
    def test_all_keyword(self) -> None:
        self.assertTrue(install._tools_was_all("all"))

    def test_mixed_with_all_treated_as_all(self) -> None:
        self.assertTrue(install._tools_was_all("cursor,all"))

    def test_explicit_list(self) -> None:
        self.assertFalse(install._tools_was_all("cursor,claude-code"))

    def test_empty_value(self) -> None:
        self.assertFalse(install._tools_was_all(""))


class TestScopeSupportMatrix(unittest.TestCase):
    """Every concrete _VALID_TOOLS ID must declare a SCOPE_SUPPORT entry."""

    def test_every_valid_tool_has_scope_declared(self) -> None:
        for tool in install._VALID_TOOLS:
            if tool == "all":
                continue
            self.assertIn(
                tool,
                install.SCOPE_SUPPORT,
                f"SCOPE_SUPPORT missing entry for tool '{tool}'",
            )

    def test_scope_values_in_allowed_set(self) -> None:
        allowed = {"both", "project", "global"}
        for tool, scope in install.SCOPE_SUPPORT.items():
            self.assertIn(
                scope,
                allowed,
                f"SCOPE_SUPPORT['{tool}'] has invalid value '{scope}'",
            )


# --- detect_scope (Phase 1.3) ---

class TestDetectScope(unittest.TestCase):
    """Multi-signal scope detection per ADR-007 D2 / Phase 1.3."""

    def test_existing_settings_yml_returns_project(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            (cwd / install.SETTINGS_FILE).write_text("rule_loading_tier: minimal\n")
            scope, reason = install.detect_scope(cwd)
            self.assertEqual(scope, "project")
            self.assertIn(install.SETTINGS_FILE, reason)

    def test_empty_directory_returns_global(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            scope, reason = install.detect_scope(Path(tmp))
            self.assertEqual(scope, "global")
            self.assertIn("no project-scope signals", reason)

    def test_manifest_alone_returns_global(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            (cwd / "package.json").write_text("{}")
            scope, _ = install.detect_scope(cwd)
            self.assertEqual(scope, "global")

    def test_ai_config_alone_returns_global(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            (cwd / ".claude").mkdir()
            scope, _ = install.detect_scope(cwd)
            self.assertEqual(scope, "global")

    def test_manifest_plus_ai_dir_returns_prompt(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            (cwd / "package.json").write_text("{}")
            (cwd / ".cursor").mkdir()
            scope, reason = install.detect_scope(cwd)
            self.assertEqual(scope, "prompt")
            self.assertIn("package.json", reason)
            self.assertIn(".cursor", reason)

    def test_manifest_plus_ai_file_returns_prompt(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            (cwd / "composer.json").write_text("{}")
            (cwd / "CLAUDE.md").write_text("# CLAUDE")
            scope, reason = install.detect_scope(cwd)
            self.assertEqual(scope, "prompt")
            self.assertIn("composer.json", reason)
            self.assertIn("CLAUDE.md", reason)

    def test_settings_yml_wins_over_manifest_and_ai(self) -> None:
        # `.agent-settings.yml` is the strongest signal — short-circuit
        # before manifest+AI even gets evaluated.
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            (cwd / install.SETTINGS_FILE).write_text("rule_loading_tier: minimal\n")
            (cwd / "package.json").write_text("{}")
            (cwd / ".claude").mkdir()
            scope, _ = install.detect_scope(cwd)
            self.assertEqual(scope, "project")

    def test_git_dir_is_not_a_signal(self) -> None:
        # ADR-007 D2: `.git/` presence is explicitly NOT a signal.
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            (cwd / ".git").mkdir()
            scope, _ = install.detect_scope(cwd)
            self.assertEqual(scope, "global")


# --- prompt_scope_choice / prompt_collision_choice (Phase 1.4) ---

class TestPromptScopeChoice(SilentTest):
    """Interactive 3-option chooser per ADR-007 D2 / Phase 1.4."""

    def _patch_input(self, replies: list[str]) -> None:
        it = iter(replies)
        install._read_line = lambda _prompt: next(it)  # type: ignore[assignment]

    def setUp(self) -> None:
        super().setUp()
        self._orig = install._read_line

    def tearDown(self) -> None:
        install._read_line = self._orig  # type: ignore[assignment]
        super().tearDown()

    def test_returns_project_on_choice_1(self) -> None:
        self._patch_input(["1"])
        self.assertEqual(install.prompt_scope_choice("test"), "project")

    def test_returns_global_on_choice_2(self) -> None:
        self._patch_input(["2"])
        self.assertEqual(install.prompt_scope_choice("test"), "global")

    def test_returns_custom_sentinel_on_choice_3(self) -> None:
        self._patch_input(["3"])
        self.assertEqual(install.prompt_scope_choice("test"), install.SCOPE_CUSTOM)

    def test_accepts_word_aliases(self) -> None:
        self._patch_input(["project"])
        self.assertEqual(install.prompt_scope_choice("test"), "project")
        self._patch_input(["user"])
        self.assertEqual(install.prompt_scope_choice("test"), "global")
        self._patch_input(["custom"])
        self.assertEqual(install.prompt_scope_choice("test"), install.SCOPE_CUSTOM)

    def test_retries_on_invalid_then_accepts(self) -> None:
        self._patch_input(["?", "x", "1"])
        self.assertEqual(install.prompt_scope_choice("test"), "project")

    def test_aborts_after_three_invalid(self) -> None:
        self._patch_input(["?", "x", "z"])
        with self.assertRaises(SystemExit):
            install.prompt_scope_choice("test")

    def test_aborts_on_eof(self) -> None:
        def raise_eof(_prompt: str) -> str:
            raise EOFError
        install._read_line = raise_eof  # type: ignore[assignment]
        with self.assertRaises(SystemExit):
            install.prompt_scope_choice("test")


class TestPromptCollisionChoice(SilentTest):
    """Hard-Floor 3-option collision prompt per ADR-007 D2."""

    def setUp(self) -> None:
        super().setUp()
        self._orig = install._read_line

    def tearDown(self) -> None:
        install._read_line = self._orig  # type: ignore[assignment]
        super().tearDown()

    def _patch(self, replies: list[str]) -> None:
        it = iter(replies)
        install._read_line = lambda _p: next(it)  # type: ignore[assignment]

    def test_merge_backup_abort(self) -> None:
        for reply, expected in (
            ("1", "merge"), ("merge", "merge"),
            ("2", "backup"), ("backup", "backup"),
            ("3", "abort"), ("abort", "abort"),
        ):
            self._patch([reply])
            self.assertEqual(
                install.prompt_collision_choice(Path("/tmp/x")),
                expected,
            )

    def test_aborts_after_three_invalid(self) -> None:
        self._patch(["?", "x", "z"])
        with self.assertRaises(SystemExit):
            install.prompt_collision_choice(Path("/tmp/x"))


# --- _resolve_scope (Phase 1.4) ---

class TestResolveScope(SilentTest):
    """Flag + detection → concrete scope, per ADR-007 D1/D2."""

    def _opts(self, **overrides: object) -> "object":
        # Minimal namespace with the fields _resolve_scope reads.
        base = {
            "scope": None,
            "global_install": False,
            "custom_path": None,
            "quiet": True,
        }
        base.update(overrides)
        return type("Opts", (), base)()

    def test_explicit_project_wins(self) -> None:
        scope = install._resolve_scope(self._opts(scope="project"), "global", "x", None)
        self.assertEqual(scope, "project")

    def test_explicit_global_wins(self) -> None:
        scope = install._resolve_scope(self._opts(scope="global"), "project", "x", None)
        self.assertEqual(scope, "global")

    def test_global_flag_alias(self) -> None:
        scope = install._resolve_scope(self._opts(global_install=True), "project", "x", None)
        self.assertEqual(scope, "global")

    def test_legacy_default_is_project_on_detected_global(self) -> None:
        # Backward-compat: no flag + detection says "global" still installs project
        # (until npx entry-point flips the default in a later phase).
        scope = install._resolve_scope(self._opts(), "global", "no signals", None)
        self.assertEqual(scope, "project")

    def test_auto_honors_detection_global(self) -> None:
        scope = install._resolve_scope(self._opts(scope="auto"), "global", "no signals", None)
        self.assertEqual(scope, "global")

    def test_auto_honors_detection_project(self) -> None:
        scope = install._resolve_scope(self._opts(scope="auto"), "project", "settings", None)
        self.assertEqual(scope, "project")


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

    def test_finds_npm_layout(self) -> None:
        package = self.tmpdir / "node_modules" / "@event4u" / "agent-config"
        package.mkdir(parents=True)
        self.assertEqual(install.detect_package_root(self.tmpdir), package.resolve())

    def test_local_dev_mode(self) -> None:
        (self.tmpdir / "config" / "profiles").mkdir(parents=True)
        (self.tmpdir / "config" / "profiles" / "minimal.ini").write_text("rule_loading_tier=minimal\n", encoding="utf-8")
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

    def test_updates_our_key_without_force(self) -> None:
        # A deliberate setup applies our keys with no --force gate: the
        # second merge overwrites our own pointer.
        install.merge_json_file(self.target, {"a": 1}, force=False, label="test")
        install.merge_json_file(self.target, {"a": 2}, force=False, label="test")
        self.assertEqual(json.loads(self.target.read_text()), {"a": 2})

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
        content = (install._canonical_settings_target(self.project)).read_text(encoding="utf-8")
        self.assertIn("rule_loading_tier: balanced", content)
        self.assertNotIn(install.RULE_LOADING_TIER_PLACEHOLDER, content)

    def test_seeds_subagent_keys(self) -> None:
        install.ensure_agent_settings(self.project, self.package, "balanced", force=False)
        content = (install._canonical_settings_target(self.project)).read_text(encoding="utf-8")
        self.assertIn("subagents:", content)
        self.assertIn("implementer_model:", content)
        self.assertIn("judge_model:", content)
        self.assertIn("max_parallel: 3", content)

    def test_skip_when_exists_without_force(self) -> None:
        target = install._canonical_settings_target(self.project)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("rule_loading_tier: custom\n", encoding="utf-8")
        install.ensure_agent_settings(self.project, self.package, "full", force=False)
        self.assertEqual(target.read_text(encoding="utf-8"), "rule_loading_tier: custom\n")

    def test_force_overwrites(self) -> None:
        target = install._canonical_settings_target(self.project)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("rule_loading_tier: custom\n", encoding="utf-8")
        install.ensure_agent_settings(self.project, self.package, "full", force=True)
        self.assertIn("rule_loading_tier: full", target.read_text(encoding="utf-8"))

    def test_missing_profile_fails(self) -> None:
        with redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                install.ensure_agent_settings(self.project, self.package, "nonexistent", force=False)

    def test_chat_history_rendered_per_profile_minimal(self) -> None:
        install.ensure_agent_settings(self.project, self.package, "minimal", force=False)
        content = (install._canonical_settings_target(self.project)).read_text(encoding="utf-8")
        self.assertIn("frequency: per_turn", content)
        self.assertIn("max_size_kb: 128", content)
        self.assertIn("on_overflow: rotate", content)

    def test_chat_history_rendered_per_profile_balanced(self) -> None:
        install.ensure_agent_settings(self.project, self.package, "balanced", force=False)
        content = (install._canonical_settings_target(self.project)).read_text(encoding="utf-8")
        self.assertIn("frequency: per_phase", content)
        self.assertIn("max_size_kb: 256", content)
        self.assertIn("on_overflow: rotate", content)

    def test_chat_history_rendered_per_profile_full(self) -> None:
        install.ensure_agent_settings(self.project, self.package, "full", force=False)
        content = (install._canonical_settings_target(self.project)).read_text(encoding="utf-8")
        self.assertIn("frequency: per_tool", content)
        self.assertIn("max_size_kb: 512", content)
        self.assertIn("on_overflow: condense", content)

    def test_no_placeholder_left_in_output(self) -> None:
        for profile in install.SUPPORTED_PROFILES:
            target = install._canonical_settings_target(self.project)
            if target.exists():
                target.unlink()
            install.ensure_agent_settings(self.project, self.package, profile, force=False)
            content = target.read_text(encoding="utf-8")
            leftover = install._PLACEHOLDER_RE.findall(content)
            self.assertEqual(leftover, [], f"{profile}: leftover placeholders {leftover}")

    def test_profile_mismatch_fails(self) -> None:
        # Corrupt a profile ini so rule_loading_tier doesn't match --profile
        bad = self.package / "config" / "profiles" / "minimal.ini"
        bad.write_text(
            "rule_loading_tier=balanced\n"
            "chat_history_frequency=per_turn\n"
            "chat_history_max_size_kb=128\n"
            "chat_history_on_overflow=rotate\n",
            encoding="utf-8",
        )
        with redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                install.ensure_agent_settings(self.project, self.package, "minimal", force=False)


# --- user-type axis (step-9 Phase 5) ---

class TestUserTypeFlag(unittest.TestCase):
    """parse_options wiring for --user-type (step-9 Phase 2)."""

    def test_user_type_default_empty(self) -> None:
        opts = install.parse_options([])
        self.assertEqual(opts.user_type, "")

    def test_user_type_explicit_consultant(self) -> None:
        opts = install.parse_options(["--user-type=consultant"])
        self.assertEqual(opts.user_type, "consultant")

    def test_user_type_explicit_long_form(self) -> None:
        opts = install.parse_options(["--user-type", "developer"])
        self.assertEqual(opts.user_type, "developer")


class TestValidateUserType(SilentTest):
    """_validate_user_type — accepts shipped slugs, rejects unknowns."""

    def setUp(self) -> None:
        super().setUp()
        self.tmpdir = Path(tempfile.mkdtemp())
        self.package = make_fake_package(self.tmpdir)

    def tearDown(self) -> None:
        shutil.rmtree(self.tmpdir)
        super().tearDown()

    def test_empty_returns_empty(self) -> None:
        self.assertEqual(install._validate_user_type(self.package, ""), "")

    def test_whitespace_returns_empty(self) -> None:
        self.assertEqual(install._validate_user_type(self.package, "   "), "")

    def test_all_seven_seed_slugs_accepted(self) -> None:
        for slug in ("consultant", "creator", "developer", "finance", "founder", "gtm", "ops"):
            self.assertEqual(
                install._validate_user_type(self.package, slug), slug,
                f"slug {slug!r} should be accepted",
            )

    def test_unknown_slug_rejected(self) -> None:
        with redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                install._validate_user_type(self.package, "wizard")

    def test_missing_user_types_dir_rejected(self) -> None:
        # Strip user-types/ to simulate older payload — non-empty slug must fail.
        shutil.rmtree(self.package / "user-types")
        with redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                install._validate_user_type(self.package, "consultant")

    def test_missing_user_types_dir_empty_slug_ok(self) -> None:
        # Empty slug + missing dir → no filter requested, no failure.
        shutil.rmtree(self.package / "user-types")
        self.assertEqual(install._validate_user_type(self.package, ""), "")


class TestEnsureAgentSettingsUserType(SilentTest):
    """ensure_agent_settings renders __USER_TYPE__ placeholder (step-9 Phase 5)."""

    def setUp(self) -> None:
        super().setUp()
        self.tmpdir = Path(tempfile.mkdtemp())
        self.project = self.tmpdir / "proj"
        self.project.mkdir()
        self.package = make_fake_package(self.tmpdir)

    def tearDown(self) -> None:
        shutil.rmtree(self.tmpdir)
        super().tearDown()

    def _settings(self) -> str:
        return (install._canonical_settings_target(self.project)).read_text(encoding="utf-8")

    def test_default_renders_empty_user_type(self) -> None:
        install.ensure_agent_settings(self.project, self.package, "balanced", force=False)
        content = self._settings()
        self.assertIn('user_type: ""', content)
        self.assertNotIn(install.USER_TYPE_PLACEHOLDER, content)

    def test_consultant_renders_consultant(self) -> None:
        install.ensure_agent_settings(
            self.project, self.package, "balanced", force=False, user_type="consultant",
        )
        content = self._settings()
        self.assertIn('user_type: "consultant"', content)
        self.assertNotIn(install.USER_TYPE_PLACEHOLDER, content)

    def test_invalid_user_type_fails(self) -> None:
        with redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                install.ensure_agent_settings(
                    self.project, self.package, "balanced", force=False,
                    user_type="wizard",
                )

    def test_no_placeholder_left_for_any_seed_slug(self) -> None:
        for slug in install._load_valid_user_types(self.package):
            target = install._canonical_settings_target(self.project)
            if target.exists():
                target.unlink()
            install.ensure_agent_settings(
                self.project, self.package, "minimal", force=False, user_type=slug,
            )
            content = target.read_text(encoding="utf-8")
            leftover = install._PLACEHOLDER_RE.findall(content)
            self.assertEqual(leftover, [], f"{slug}: leftover placeholders {leftover}")
            self.assertIn(f'user_type: "{slug}"', content)


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

    def test_claude_bridge_is_plugin_enablement_only(self) -> None:
        # Claude lifecycle hooks ship via plugin scope (hooks/hooks.json), NOT
        # the shared settings.json hooks array — so the bridge writes only
        # enabledPlugins, no `hooks` key, and the canonical plugin id.
        install.ensure_claude_bridge(self.project, force=False)
        data = json.loads((self.project / ".claude" / "settings.json").read_text())
        self.assertTrue(
            data["enabledPlugins"]["agent-config@event4u-agent-config"])
        self.assertNotIn(
            "hooks", data,
            "Claude bridge must not write a settings.json hooks array — hooks "
            "are delivered via plugin scope to avoid monopolising the shared "
            "array and colliding with neighbour tools / settings.local.json",
        )

    def test_claude_bridge_coexists_with_neighbour_hooks(self) -> None:
        # A neighbour tool owns settings.json hooks; the bridge must leave
        # them untouched and only add its plugin key alongside.
        target = self.project / ".claude" / "settings.json"
        target.parent.mkdir(parents=True, exist_ok=True)
        neighbour = {
            "hooks": {
                "PostToolUse": [
                    {"matcher": "Write|Edit",
                     "hooks": [{"type": "command", "command": "neighbour-handler"}]},
                ],
            },
        }
        target.write_text(json.dumps(neighbour), encoding="utf-8")
        install.ensure_claude_bridge(self.project, force=True)
        data = json.loads(target.read_text())
        self.assertEqual(data["hooks"], neighbour["hooks"])  # neighbour survives
        self.assertTrue(
            data["enabledPlugins"]["agent-config@event4u-agent-config"])

    def test_claude_bridge_heals_legacy_plugin_id(self) -> None:
        # Pre-4.x installer versions wrote abbreviated / pre-rename plugin
        # ids that Claude Code cannot resolve to a real marketplace + plugin
        # pair (silent fail — plugin stays inactive). The bridge MUST remove
        # those stale ids on rerun AND add the canonical id alongside, even
        # when called with force=False (the heal self-authorises the merge).
        target = self.project / ".claude" / "settings.json"
        target.parent.mkdir(parents=True, exist_ok=True)
        seeded = {
            "enabledPlugins": {
                "agent-conf@event4u": True,        # abbreviated stale form
                "agent-config@event4u": True,      # pre-rename stale form
                "neighbour@neighbour-mkt": True,   # foreign id — must survive
            },
        }
        target.write_text(json.dumps(seeded), encoding="utf-8")

        install.ensure_claude_bridge(self.project, force=False)

        data = json.loads(target.read_text())
        self.assertNotIn("agent-conf@event4u", data["enabledPlugins"])
        self.assertNotIn("agent-config@event4u", data["enabledPlugins"])
        self.assertTrue(
            data["enabledPlugins"]["agent-config@event4u-agent-config"])
        self.assertTrue(
            data["enabledPlugins"]["neighbour@neighbour-mkt"],
            "Foreign plugin ids owned by other packages must survive the heal.",
        )

    def test_claude_bridge_no_heal_when_clean(self) -> None:
        # When the settings file already carries only the canonical id (no
        # stale ids), the heal helper must be a no-op and the regular
        # merge path applies — needs force=True to overwrite, per the
        # existing merge_json_file contract.
        target = self.project / ".claude" / "settings.json"
        target.parent.mkdir(parents=True, exist_ok=True)
        seeded = {
            "enabledPlugins": {"agent-config@event4u-agent-config": True},
        }
        target.write_text(json.dumps(seeded), encoding="utf-8")

        # No force, no heal needed → file untouched, no error.
        install.ensure_claude_bridge(self.project, force=False)
        data = json.loads(target.read_text())
        self.assertEqual(
            set(data["enabledPlugins"].keys()),
            {"agent-config@event4u-agent-config"},
        )

    def test_cursor_bridge_writes_dispatcher_hooks(self) -> None:
        # Phase 7.5 — `.cursor/hooks.json` must wire all five lifecycle
        # events (sessionStart/End, stop, beforeSubmitPrompt, postToolUse)
        # to ./agent-config dispatch:hook commands. Project-scope hooks
        # fire with the workspace as cwd, so no trampoline is used.
        install.ensure_cursor_bridge(self.project, force=False)
        data = json.loads((self.project / ".cursor" / "hooks.json").read_text())
        self.assertEqual(data["version"], 1)
        hooks = data["hooks"]
        for native in ("sessionStart", "sessionEnd", "stop",
                       "beforeSubmitPrompt", "postToolUse"):
            self.assertIn(native, hooks, f"missing native event {native}")
            self.assertEqual(len(hooks[native]), 1)
            cmd = hooks[native][0]["command"]
            self.assertIn("./agent-config dispatch:hook", cmd)
            self.assertIn("--platform cursor", cmd)
            self.assertIn(f"--native-event {native}", cmd)

    def test_cursor_bridge_idempotent(self) -> None:
        install.ensure_cursor_bridge(self.project, force=False)
        first = (self.project / ".cursor" / "hooks.json").read_text()
        install.ensure_cursor_bridge(self.project, force=False)
        second = (self.project / ".cursor" / "hooks.json").read_text()
        self.assertEqual(first, second)

    def test_cursor_bridge_force_overwrites_user_edits(self) -> None:
        # User-edited hooks.json gets re-written under --force, but a
        # missing-event scenario (custom keys) is preserved by deep_merge.
        target = self.project / ".cursor" / "hooks.json"
        target.parent.mkdir(parents=True)
        target.write_text(json.dumps({
            "version": 1,
            "hooks": {"afterFileEdit": [{"command": "custom.sh"}]},
        }), encoding="utf-8")
        install.ensure_cursor_bridge(self.project, force=True)
        data = json.loads(target.read_text())
        self.assertIn("sessionStart", data["hooks"])
        self.assertIn("afterFileEdit", data["hooks"])
        self.assertEqual(data["hooks"]["afterFileEdit"][0]["command"], "custom.sh")

    def test_cline_bridge_writes_per_event_scripts(self) -> None:
        # Phase 7.6 — Cline reads `.clinerules/hooks/<HookName>` as
        # individual executable files (no extension). install must emit
        # one script per (ac_event, native_event) tuple.
        install.ensure_cline_bridge(self.project, force=False)
        hooks_dir = self.project / ".clinerules" / "hooks"
        self.assertTrue(hooks_dir.is_dir())
        for ac_event, native in install.CLINE_DISPATCHER_BINDINGS:
            target = hooks_dir / native
            self.assertTrue(target.exists(), f"missing hook script {native}")
            # Must be executable (chmod 0o755).
            self.assertTrue(target.stat().st_mode & 0o111,
                            f"{native} is not executable")
            body = target.read_text(encoding="utf-8")
            self.assertIn("#!/usr/bin/env bash", body)
            self.assertIn("./agent-config dispatch:hook", body)
            self.assertIn("--platform cline", body)
            self.assertIn(f"--event {ac_event}", body)
            self.assertIn(f"--native-event {native}", body)

    def test_cline_bridge_idempotent(self) -> None:
        install.ensure_cline_bridge(self.project, force=False)
        first = {p.name: p.read_text(encoding="utf-8")
                 for p in (self.project / ".clinerules" / "hooks").iterdir()}
        install.ensure_cline_bridge(self.project, force=False)
        second = {p.name: p.read_text(encoding="utf-8")
                  for p in (self.project / ".clinerules" / "hooks").iterdir()}
        self.assertEqual(first, second)

    def test_cline_bridge_skips_user_edits_without_force(self) -> None:
        # Phase 7.6 — when a script already exists with different content
        # and --force is not set, install must skip rather than overwrite.
        hooks_dir = self.project / ".clinerules" / "hooks"
        hooks_dir.mkdir(parents=True)
        custom = hooks_dir / "TaskStart"
        custom.write_text("#!/usr/bin/env bash\necho custom\n", encoding="utf-8")
        custom.chmod(0o755)
        install.ensure_cline_bridge(self.project, force=False)
        self.assertEqual(custom.read_text(encoding="utf-8"),
                         "#!/usr/bin/env bash\necho custom\n")
        # Force overwrites.
        install.ensure_cline_bridge(self.project, force=True)
        self.assertIn("./agent-config dispatch:hook",
                      custom.read_text(encoding="utf-8"))

    def test_windsurf_bridge_writes_dispatcher_hooks(self) -> None:
        # Phase 7.7 — `.windsurf/hooks.json` must wire all three lifecycle
        # events (post_setup_worktree, pre_user_prompt, post_cascade_response)
        # to ./agent-config dispatch:hook commands. Project-scope hooks
        # fire with the workspace as cwd, so no trampoline is used.
        install.ensure_windsurf_bridge(self.project, force=False)
        data = json.loads((self.project / ".windsurf" / "hooks.json").read_text())
        hooks = data["hooks"]
        for native in ("post_setup_worktree", "pre_user_prompt",
                       "post_cascade_response"):
            self.assertIn(native, hooks, f"missing native event {native}")
            self.assertEqual(len(hooks[native]), 1)
            entry = hooks[native][0]
            cmd = entry["command"]
            self.assertIn("./agent-config dispatch:hook", cmd)
            self.assertIn("--platform windsurf", cmd)
            self.assertIn(f"--native-event {native}", cmd)
            self.assertIs(entry["show_output"], False)

    def test_windsurf_bridge_idempotent(self) -> None:
        install.ensure_windsurf_bridge(self.project, force=False)
        first = (self.project / ".windsurf" / "hooks.json").read_text()
        install.ensure_windsurf_bridge(self.project, force=False)
        second = (self.project / ".windsurf" / "hooks.json").read_text()
        self.assertEqual(first, second)

    def test_windsurf_bridge_force_overwrites_user_edits(self) -> None:
        # User-edited hooks.json gets re-written under --force, but a
        # custom event key (post_write_code) is preserved by deep_merge.
        target = self.project / ".windsurf" / "hooks.json"
        target.parent.mkdir(parents=True)
        target.write_text(json.dumps({
            "hooks": {"post_write_code": [{"command": "custom.sh"}]},
        }), encoding="utf-8")
        install.ensure_windsurf_bridge(self.project, force=True)
        data = json.loads(target.read_text())
        self.assertIn("pre_user_prompt", data["hooks"])
        self.assertIn("post_write_code", data["hooks"])
        self.assertEqual(data["hooks"]["post_write_code"][0]["command"], "custom.sh")

    def test_gemini_bridge_writes_dispatcher_hooks(self) -> None:
        # Phase 7.8 — `.gemini/settings.json` must wire each lifecycle
        # event to a hook-group entry with `matcher` + `hooks: [{type,
        # command}]`. Project-scope hooks fire with the workspace as
        # cwd, so no trampoline is used.
        install.ensure_gemini_bridge(self.project, force=False)
        data = json.loads((self.project / ".gemini" / "settings.json").read_text())
        hooks = data["hooks"]
        for ac_event, native, matcher in install.GEMINI_DISPATCHER_BINDINGS:
            self.assertIn(native, hooks, f"missing native event {native}")
            self.assertEqual(len(hooks[native]), 1)
            group = hooks[native][0]
            self.assertEqual(group["matcher"], matcher)
            self.assertEqual(len(group["hooks"]), 1)
            entry = group["hooks"][0]
            self.assertEqual(entry["type"], "command")
            cmd = entry["command"]
            self.assertIn("./agent-config dispatch:hook", cmd)
            self.assertIn("--platform gemini", cmd)
            self.assertIn(f"--event {ac_event}", cmd)
            self.assertIn(f"--native-event {native}", cmd)

    def test_gemini_bridge_idempotent(self) -> None:
        install.ensure_gemini_bridge(self.project, force=False)
        first = (self.project / ".gemini" / "settings.json").read_text()
        install.ensure_gemini_bridge(self.project, force=False)
        second = (self.project / ".gemini" / "settings.json").read_text()
        self.assertEqual(first, second)

    def test_gemini_bridge_force_preserves_custom_events(self) -> None:
        # User-edited settings.json gets re-written under --force, but
        # custom event keys (BeforeTool with custom matcher) are
        # preserved by deep_merge.
        target = self.project / ".gemini" / "settings.json"
        target.parent.mkdir(parents=True)
        target.write_text(json.dumps({
            "hooks": {
                "BeforeTool": [
                    {"matcher": "Bash", "hooks": [{"type": "command",
                                                    "command": "custom.sh"}]},
                ],
            },
        }), encoding="utf-8")
        install.ensure_gemini_bridge(self.project, force=True)
        data = json.loads(target.read_text())
        self.assertIn("SessionStart", data["hooks"])
        self.assertIn("BeforeTool", data["hooks"])
        self.assertEqual(data["hooks"]["BeforeTool"][0]["hooks"][0]["command"],
                         "custom.sh")


# --- main() integration ---

class TestMainIntegration(unittest.TestCase):
    def setUp(self) -> None:
        self.tmpdir = Path(tempfile.mkdtemp())
        self.project = self.tmpdir / "proj"
        self.project.mkdir()
        self.package = make_fake_package(self.tmpdir)
        # road-to-global-only-install § Phase 3.2 — project-scope integration
        # tests exercise the maintainer dogfood path; opt in to dev mode so
        # the consumer-global-only gate does not abort orchestration.
        self._prev_dev_mode = install.os.environ.get("AGENT_CONFIG_DEV_MODE")
        install.os.environ["AGENT_CONFIG_DEV_MODE"] = "1"

    def tearDown(self) -> None:
        shutil.rmtree(self.tmpdir)
        install.QUIET = False
        if self._prev_dev_mode is None:
            install.os.environ.pop("AGENT_CONFIG_DEV_MODE", None)
        else:
            install.os.environ["AGENT_CONFIG_DEV_MODE"] = self._prev_dev_mode

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
        self.assertTrue((install._canonical_settings_target(self.project)).exists())
        self.assertTrue((self.project / ".vscode" / "settings.json").exists())
        self.assertTrue((self.project / ".augment" / "settings.json").exists())
        self.assertTrue((self.project / ".cursor" / "hooks.json").exists())
        self.assertTrue((self.project / ".clinerules" / "hooks" / "TaskStart").exists())
        self.assertTrue((self.project / ".windsurf" / "hooks.json").exists())
        self.assertTrue((self.project / ".gemini" / "settings.json").exists())
        self.assertTrue((self.project / ".github" / "plugin" / "marketplace.json").exists())

    def test_skip_bridges_only_creates_settings(self) -> None:
        self.assertEqual(self._run("--skip-bridges"), 0)
        self.assertTrue((install._canonical_settings_target(self.project)).exists())
        self.assertFalse((self.project / ".vscode").exists())
        self.assertFalse((self.project / ".augment").exists())
        self.assertFalse((self.project / ".cursor").exists())
        self.assertFalse((self.project / ".clinerules").exists())
        self.assertFalse((self.project / ".windsurf").exists())
        self.assertFalse((self.project / ".gemini").exists())
        self.assertFalse((self.project / ".github").exists())

    def test_invalid_profile_exits_nonzero(self) -> None:
        with self.assertRaises(SystemExit) as ctx:
            self._run("--profile=bogus")
        self.assertEqual(ctx.exception.code, 1)

    def test_idempotent(self) -> None:
        self.assertEqual(self._run(), 0)
        content_first = (install._canonical_settings_target(self.project)).read_text(encoding="utf-8")
        self.assertEqual(self._run(), 0)
        content_second = (install._canonical_settings_target(self.project)).read_text(encoding="utf-8")
        self.assertEqual(content_first, content_second)

    def test_profile_is_rendered_into_settings(self) -> None:
        self.assertEqual(self._run("--profile=full"), 0)
        content = (install._canonical_settings_target(self.project)).read_text(encoding="utf-8")
        self.assertIn("rule_loading_tier: full", content)


class TestPostInstallSmoke(unittest.TestCase):
    """Phase 7.12 — `_smoke_test_hooks` dry-fires the dispatcher
    against every installed bridge and reports per-platform results.

    Uses REPO_ROOT as package_root so dispatch_hook.py + the canonical
    manifest are present. The fake-package fixture under
    `make_fake_package` deliberately omits them — that path is
    covered by the silent-skip assertion below.
    """

    def setUp(self) -> None:
        self.tmpdir = Path(tempfile.mkdtemp())
        self.project = self.tmpdir / "proj"
        self.project.mkdir()
        install.QUIET = True
        # road-to-global-only-install § Phase 3.2 — see TestMainIntegration.
        self._prev_dev_mode = install.os.environ.get("AGENT_CONFIG_DEV_MODE")
        install.os.environ["AGENT_CONFIG_DEV_MODE"] = "1"

    def tearDown(self) -> None:
        shutil.rmtree(self.tmpdir)
        install.QUIET = False
        if self._prev_dev_mode is None:
            install.os.environ.pop("AGENT_CONFIG_DEV_MODE", None)
        else:
            install.os.environ["AGENT_CONFIG_DEV_MODE"] = self._prev_dev_mode

    def test_smoke_passes_when_all_bridges_installed(self) -> None:
        buf = io.StringIO()
        with redirect_stdout(buf), redirect_stderr(buf):
            exit_code = install.main([
                "--project", str(self.project),
                "--package", str(REPO_ROOT),
                "--quiet",
            ])
        self.assertEqual(exit_code, 0)
        # Direct smoke call against the now-populated project tree
        # — the install run already exercised it; this asserts the
        # contract surface so failures are localized.
        rc = install._smoke_test_hooks(self.project, REPO_ROOT)
        self.assertEqual(rc, 0)

    def test_smoke_silent_skip_when_dispatcher_missing(self) -> None:
        # Fake package without dispatch_hook.py / hook_manifest.yaml.
        package = make_fake_package(self.tmpdir)
        rc = install._smoke_test_hooks(self.project, package)
        self.assertEqual(rc, 0)

    def test_no_smoke_flag_skips_smoke(self) -> None:
        buf = io.StringIO()
        with redirect_stdout(buf), redirect_stderr(buf):
            exit_code = install.main([
                "--project", str(self.project),
                "--package", str(REPO_ROOT),
                "--no-smoke",
            ])
        self.assertEqual(exit_code, 0)
        self.assertNotIn("Smoke-testing", buf.getvalue())


class FilesByToolHelpers(unittest.TestCase):
    """P1.4 — v2 ``files[]`` inventory helpers in install.py.

    Pure functions; tested without touching the install flow so the
    contract is locked independently of orchestration plumbing.
    """

    def test_sha256_of_file_returns_hex_digest(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "sample.txt"
            target.write_text("hello", encoding="utf-8")
            digest = install._sha256_of_file(target)
        # SHA-256 of "hello" is well known and 64 hex chars long.
        self.assertEqual(
            digest,
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
        )

    def test_sha256_of_file_handles_unreadable_path(self) -> None:
        # Missing file → None, not an OSError.
        self.assertIsNone(install._sha256_of_file(Path("/no/such/file")))

    def test_files_by_tool_from_bridges_records_kind_bridge(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project = Path(tmp)
            mapping = install._files_by_tool_from_bridges(
                {"cursor"}, project, "project",
            )
        self.assertIn("cursor", mapping)
        entries = mapping["cursor"]
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["kind"], "bridge")
        # Bridge entries carry no sha256 (they point at agent-config content).
        self.assertIsNone(entries[0]["sha256"])
        # Path resolves to the canonical project-scope marker for cursor.
        expected = install.PROJECT_BRIDGE_MARKERS["cursor"]
        self.assertTrue(entries[0]["path"].endswith(expected))

    def test_files_by_tool_from_deploy_splits_kinds(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            deployed_a = root / "a.md"
            deployed_a.write_text("a", encoding="utf-8")
            marker = root / "agent-config.md"
            marker.write_text("m", encoding="utf-8")
            results = {
                "claude-code": (1, 0, "deployed", [deployed_a]),
                "claude-desktop": (1, 0, "marker", [marker]),
                "copilot": (0, 0, "hint", []),
            }
            mapping = install._files_by_tool_from_deploy(results, root)
        self.assertEqual(mapping["claude-code"][0]["kind"], "deployed")
        self.assertIsNotNone(mapping["claude-code"][0]["sha256"])
        self.assertEqual(mapping["claude-desktop"][0]["kind"], "marker")
        # Hint / unsupported tools record an empty inventory (not absent).
        self.assertEqual(mapping["copilot"], [])


class TestInjectPackageTag(unittest.TestCase):
    """P5.1 — frontmatter package/source tag injection."""

    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp(prefix="agc-tag-"))

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_injects_into_existing_frontmatter(self) -> None:
        pkg = self.tmp / "pkg"
        src = pkg / "config" / "rules" / "general.md"
        src.parent.mkdir(parents=True)
        src.write_text("---\ntitle: t\n---\nbody\n")
        target = self.tmp / "out" / "general.md"
        target.parent.mkdir()
        shutil.copyfile(src, target)
        install._inject_package_tag(target, src, pkg)
        text = target.read_text()
        self.assertIn(f"package: {install.PACKAGE_TAG_ID}", text)
        self.assertIn("source_path: config/rules/general.md", text)
        self.assertIn("body", text)

    def test_idempotent(self) -> None:
        pkg = self.tmp / "pkg"
        src = pkg / "rules" / "x.md"
        src.parent.mkdir(parents=True)
        src.write_text("---\ntitle: t\n---\nbody\n")
        target = self.tmp / "out" / "x.md"
        target.parent.mkdir()
        shutil.copyfile(src, target)
        install._inject_package_tag(target, src, pkg)
        first = target.read_text()
        install._inject_package_tag(target, src, pkg)
        self.assertEqual(first, target.read_text())

    def test_no_frontmatter_left_alone(self) -> None:
        target = self.tmp / "plain.md"
        target.write_text("# heading\nbody\n")
        install._inject_package_tag(target, target, None)
        self.assertEqual(target.read_text(), "# heading\nbody\n")

    def test_open_frontmatter_left_alone(self) -> None:
        # Missing closing fence — treat as no frontmatter, never synthesise.
        target = self.tmp / "open.md"
        target.write_text("---\nnoclose: true\nbody\n")
        install._inject_package_tag(target, target, None)
        self.assertEqual(target.read_text(), "---\nnoclose: true\nbody\n")

    def test_non_md_files_ignored(self) -> None:
        target = self.tmp / "data.json"
        target.write_text("---\nkey: val\n---\n{}\n")
        install._inject_package_tag(target, target, None)
        self.assertEqual(target.read_text(), "---\nkey: val\n---\n{}\n")

    def test_updates_existing_package_key(self) -> None:
        target = self.tmp / "tagged.md"
        target.write_text(
            "---\ntitle: t\npackage: other/pkg\n---\nbody\n",
        )
        install._inject_package_tag(target, target, None)
        text = target.read_text()
        self.assertIn(f"package: {install.PACKAGE_TAG_ID}", text)
        self.assertNotIn("package: other/pkg", text)

    def test_preserves_existing_source_origin_key(self) -> None:
        # Regression: 200+ rule files use ``source: package`` as an
        # origin-type marker. The injector must not clobber it; we
        # write ``source_path:`` instead.
        target = self.tmp / "rule.md"
        target.write_text(
            "---\ntype: auto\nsource: package\n---\nbody\n",
        )
        pkg = self.tmp
        install._inject_package_tag(target, target, pkg)
        text = target.read_text()
        self.assertIn("source: package", text)
        self.assertIn(f"package: {install.PACKAGE_TAG_ID}", text)
        self.assertIn("source_path: rule.md", text)

    def test_copy_helper_injects_into_deployed_md(self) -> None:
        pkg = self.tmp / "pkg"
        src_dir = pkg / "config" / "rules"
        src_dir.mkdir(parents=True)
        (src_dir / "a.md").write_text("---\ntitle: a\n---\nA body\n")
        (src_dir / "b.md").write_text("plain no frontmatter\n")
        dest = self.tmp / "deploy"
        install._copy_dir_dereferencing_symlinks(
            src_dir, dest, force=True, package_root=pkg,
        )
        a_text = (dest / "a.md").read_text()
        self.assertIn(f"package: {install.PACKAGE_TAG_ID}", a_text)
        self.assertIn("source_path: config/rules/a.md", a_text)
        self.assertEqual(
            (dest / "b.md").read_text(), "plain no frontmatter\n",
        )


if __name__ == "__main__":
    unittest.main()
