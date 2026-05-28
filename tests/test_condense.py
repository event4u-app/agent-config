#!/usr/bin/env python3
"""
Tests for scripts/condense.py

Run: python3 -m unittest tests.test_condense -v
"""

import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

# Add project root to path so we can import the condense module
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import condense


class _IsolateMultiRootMixin:
    """Scope `condense.{iter_all_sources,resolve_logical,artefact_roots}`
    to ``self.source`` for the lifetime of the test.

    Post-ADR-017 the condense functions discover sources via multi-root
    helpers and ignore the legacy ``source_dir`` parameter. Tests that
    build an isolated tmp source tree need the helpers redirected, or
    they would pick up real package sources from the surrounding repo.
    """

    def _isolate_multi_root(self, source: Path) -> None:
        self._mr_orig = (
            condense.iter_all_sources,
            condense.resolve_logical,
            condense.artefact_roots,
        )

        def _iter():
            for f in sorted(source.rglob("*")):
                if f.is_file():
                    yield f, f.relative_to(source).as_posix()

        def _resolve(rel: str):
            p = source / rel
            return p if p.exists() else None

        def _roots():
            return (source,)

        condense.iter_all_sources = _iter
        condense.resolve_logical = _resolve
        condense.artefact_roots = _roots

    def _restore_multi_root(self) -> None:
        (condense.iter_all_sources,
         condense.resolve_logical,
         condense.artefact_roots) = self._mr_orig


class TestShouldCondense(unittest.TestCase):
    """Test the should_condense() function."""

    def test_md_file_should_condense(self):
        self.assertTrue(condense.should_condense(Path("rules/token-efficiency.md")))

    def test_readme_should_not_condense(self):
        self.assertFalse(condense.should_condense(Path("README.md")))

    def test_php_file_should_not_condense(self):
        self.assertFalse(condense.should_condense(Path("scripts/scan.php")))

    def test_txt_file_should_not_condense(self):
        self.assertFalse(condense.should_condense(Path("notes.txt")))

    def test_nested_md_should_condense(self):
        self.assertTrue(condense.should_condense(Path("skills/coder/SKILL.md")))


class TestCleanupStale(_IsolateMultiRootMixin, unittest.TestCase):
    """Test the cleanup_stale() function."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.source = Path(self.tmpdir) / "source"
        self.target = Path(self.tmpdir) / "target"
        self.source.mkdir()
        self.target.mkdir()
        self._isolate_multi_root(self.source)

    def tearDown(self):
        self._restore_multi_root()
        shutil.rmtree(self.tmpdir)

    def test_deletes_stale_files(self):
        (self.source / "file_a.md").write_text("a")
        (self.target / "file_a.md").write_text("a")
        (self.target / "file_b.md").write_text("b")

        deleted = condense.cleanup_stale(self.source, self.target)

        self.assertEqual(deleted, 1)
        self.assertTrue((self.target / "file_a.md").exists())
        self.assertFalse((self.target / "file_b.md").exists())

    def test_no_stale_files(self):
        (self.source / "file_a.md").write_text("a")
        (self.target / "file_a.md").write_text("a")

        deleted = condense.cleanup_stale(self.source, self.target)
        self.assertEqual(deleted, 0)

    def test_removes_empty_directories(self):
        (self.source / "rules").mkdir()
        (self.source / "rules" / "a.md").write_text("a")
        (self.target / "rules").mkdir()
        (self.target / "rules" / "a.md").write_text("a")
        (self.target / "old-dir").mkdir()
        (self.target / "old-dir" / "stale.md").write_text("stale")

        condense.cleanup_stale(self.source, self.target)

        self.assertFalse((self.target / "old-dir").exists())

    def test_preserves_nested_structure(self):
        (self.source / "skills" / "coder").mkdir(parents=True)
        (self.source / "skills" / "coder" / "SKILL.md").write_text("skill")
        (self.target / "skills" / "coder").mkdir(parents=True)
        (self.target / "skills" / "coder" / "SKILL.md").write_text("skill")
        (self.target / "skills" / "old-skill").mkdir(parents=True)
        (self.target / "skills" / "old-skill" / "SKILL.md").write_text("old")

        condense.cleanup_stale(self.source, self.target)

        self.assertTrue((self.target / "skills" / "coder" / "SKILL.md").exists())
        self.assertFalse((self.target / "skills" / "old-skill").exists())

    def test_nonexistent_target_returns_zero(self):
        deleted = condense.cleanup_stale(self.source, Path(self.tmpdir) / "nope")
        self.assertEqual(deleted, 0)


class TestCopyFile(unittest.TestCase):
    """Test copy_file() for non-.md files."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.source = Path(self.tmpdir) / "source"
        self.target = Path(self.tmpdir) / "target"
        self.source.mkdir()
        self.target.mkdir()

    def tearDown(self):
        shutil.rmtree(self.tmpdir)

    def test_copies_file_as_is(self):
        source_file = self.source / "scan.php"
        source_file.write_text("<?php echo 'hello';")
        target_file = self.target / "scan.php"

        condense.copy_file(source_file, target_file)

        self.assertTrue(target_file.exists())
        self.assertEqual(target_file.read_text(), "<?php echo 'hello';")

    def test_creates_target_directory(self):
        source_file = self.source / "scripts" / "scan.php"
        source_file.parent.mkdir(parents=True)
        source_file.write_text("<?php")
        target_file = self.target / "scripts" / "scan.php"

        condense.copy_file(source_file, target_file)

        self.assertTrue(target_file.exists())


class TestSyncNonMd(_IsolateMultiRootMixin, unittest.TestCase):
    """Test sync_non_md() — copies only non-.md and COPY_AS_IS files."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.source = Path(self.tmpdir) / "source"
        self.target = Path(self.tmpdir) / "target"
        self.source.mkdir()
        self.target.mkdir()
        self._isolate_multi_root(self.source)

    def tearDown(self):
        self._restore_multi_root()
        shutil.rmtree(self.tmpdir)

    def test_copies_php_files(self):
        (self.source / "scripts").mkdir()
        (self.source / "scripts" / "scan.php").write_text("<?php")

        copied = condense.sync_non_md(self.source, self.target)

        self.assertEqual(copied, 1)
        self.assertTrue((self.target / "scripts" / "scan.php").exists())

    def test_skips_condensable_md_files(self):
        (self.source / "rules").mkdir()
        (self.source / "rules" / "test.md").write_text("# Rule")

        copied = condense.sync_non_md(self.source, self.target)

        self.assertEqual(copied, 0)
        self.assertFalse((self.target / "rules" / "test.md").exists())

    def test_copies_readme_as_is(self):
        (self.source / "README.md").write_text("# Readme")

        copied = condense.sync_non_md(self.source, self.target)

        self.assertEqual(copied, 1)
        self.assertTrue((self.target / "README.md").exists())
        self.assertEqual((self.target / "README.md").read_text(), "# Readme")


class TestListMdFiles(_IsolateMultiRootMixin, unittest.TestCase):
    """Test list_md_files() — lists .md files that need agent condensation."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.source = Path(self.tmpdir) / "source"
        self.source.mkdir()
        self._isolate_multi_root(self.source)

    def tearDown(self):
        self._restore_multi_root()
        shutil.rmtree(self.tmpdir)

    def test_lists_md_files(self):
        (self.source / "rules").mkdir()
        (self.source / "rules" / "a.md").write_text("rule")
        (self.source / "rules" / "b.md").write_text("rule")

        files = condense.list_md_files(self.source)

        self.assertEqual(len(files), 2)
        self.assertIn("rules/a.md", files)
        self.assertIn("rules/b.md", files)

    def test_excludes_readme(self):
        (self.source / "README.md").write_text("readme")
        (self.source / "rules").mkdir()
        (self.source / "rules" / "a.md").write_text("rule")

        files = condense.list_md_files(self.source)

        self.assertEqual(len(files), 1)
        self.assertNotIn("README.md", files)

    def test_excludes_non_md(self):
        (self.source / "scripts").mkdir()
        (self.source / "scripts" / "scan.php").write_text("<?php")

        files = condense.list_md_files(self.source)

        self.assertEqual(len(files), 0)


class TestFileHash(unittest.TestCase):
    """Test file_hash() — SHA-256 of file content."""

    def test_returns_consistent_hash(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write("hello world")
            f.flush()
            path = Path(f.name)
        try:
            h1 = condense.file_hash(path)
            h2 = condense.file_hash(path)
            self.assertEqual(h1, h2)
            self.assertEqual(len(h1), 64)  # SHA-256 hex length
        finally:
            path.unlink()

    def test_different_content_different_hash(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write("content a")
            path_a = Path(f.name)
        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write("content b")
            path_b = Path(f.name)
        try:
            self.assertNotEqual(condense.file_hash(path_a), condense.file_hash(path_b))
        finally:
            path_a.unlink()
            path_b.unlink()


class TestHashTracking(_IsolateMultiRootMixin, unittest.TestCase):
    """Test load_hashes, save_hashes, mark_done, mark_all_done, list_changed_md."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.source = Path(self.tmpdir) / "source"
        self.source.mkdir()
        self.hash_file = Path(self.tmpdir) / "hashes.json"
        # Patch globals
        self._orig_hash_file = condense.HASH_FILE
        self._orig_source_dir = condense.SOURCE_DIR
        condense.HASH_FILE = self.hash_file
        condense.SOURCE_DIR = self.source
        self._isolate_multi_root(self.source)

    def tearDown(self):
        self._restore_multi_root()
        condense.HASH_FILE = self._orig_hash_file
        condense.SOURCE_DIR = self._orig_source_dir
        shutil.rmtree(self.tmpdir)

    def test_load_hashes_empty_when_no_file(self):
        self.assertEqual(condense.load_hashes(), {})

    def test_save_and_load_roundtrip(self):
        data = {"rules/a.md": "abc123"}
        condense.save_hashes(data)
        self.assertEqual(condense.load_hashes(), data)

    def test_load_hashes_handles_corrupt_json(self):
        self.hash_file.write_text("not valid json{{{")
        self.assertEqual(condense.load_hashes(), {})

    def test_list_changed_detects_new_file(self):
        (self.source / "rules").mkdir()
        (self.source / "rules" / "new.md").write_text("# New rule")
        changed = condense.list_changed_md(self.source)
        self.assertEqual(changed, ["rules/new.md"])

    def test_list_changed_detects_modified_file(self):
        (self.source / "rules").mkdir()
        f = self.source / "rules" / "a.md"
        f.write_text("version 1")
        condense.save_hashes({"rules/a.md": condense.file_hash(f)})
        f.write_text("version 2")
        changed = condense.list_changed_md(self.source)
        self.assertEqual(changed, ["rules/a.md"])

    def test_list_changed_ignores_unchanged(self):
        (self.source / "rules").mkdir()
        f = self.source / "rules" / "a.md"
        f.write_text("unchanged")
        condense.save_hashes({"rules/a.md": condense.file_hash(f)})
        changed = condense.list_changed_md(self.source)
        self.assertEqual(changed, [])

    def test_list_changed_ignores_non_md(self):
        (self.source / "scripts").mkdir()
        (self.source / "scripts" / "scan.php").write_text("<?php")
        changed = condense.list_changed_md(self.source)
        self.assertEqual(changed, [])

    def test_mark_all_done_stores_all_hashes(self):
        (self.source / "rules").mkdir()
        (self.source / "rules" / "a.md").write_text("rule a")
        (self.source / "rules" / "b.md").write_text("rule b")
        (self.source / "scripts").mkdir()
        (self.source / "scripts" / "x.php").write_text("<?php")
        condense.mark_all_done()
        hashes = condense.load_hashes()
        self.assertIn("rules/a.md", hashes)
        self.assertIn("rules/b.md", hashes)
        self.assertNotIn("scripts/x.php", hashes)  # non-.md excluded

    def test_mark_all_done_then_nothing_changed(self):
        (self.source / "rules").mkdir()
        (self.source / "rules" / "a.md").write_text("rule a")
        condense.mark_all_done()
        changed = condense.list_changed_md(self.source)
        self.assertEqual(changed, [])


class TestCheckSync(_IsolateMultiRootMixin, unittest.TestCase):
    """Test check_sync() — detects missing and stale files."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.source = Path(self.tmpdir) / "source"
        self.target = Path(self.tmpdir) / "target"
        self.source.mkdir()
        self.target.mkdir()
        self._isolate_multi_root(self.source)

    def tearDown(self):
        self._restore_multi_root()
        shutil.rmtree(self.tmpdir)

    def test_in_sync(self):
        (self.source / "a.md").write_text("source")
        (self.target / "a.md").write_text("condensed")

        missing, stale = condense.check_sync(self.source, self.target)

        self.assertEqual(missing, [])
        self.assertEqual(stale, [])

    def test_detects_missing_in_target(self):
        (self.source / "new.md").write_text("new")

        missing, stale = condense.check_sync(self.source, self.target)

        self.assertEqual(missing, ["new.md"])
        self.assertEqual(stale, [])

    def test_detects_stale_in_target(self):
        (self.target / "old.md").write_text("old")

        missing, stale = condense.check_sync(self.source, self.target)

        self.assertEqual(missing, [])
        self.assertEqual(stale, ["old.md"])

    def test_detects_both(self):
        (self.source / "new.md").write_text("new")
        (self.target / "old.md").write_text("old")

        missing, stale = condense.check_sync(self.source, self.target)

        self.assertEqual(missing, ["new.md"])
        self.assertEqual(stale, ["old.md"])


class TestStripFrontmatter(unittest.TestCase):
    """Test strip_frontmatter() — removes YAML frontmatter."""

    def test_strips_frontmatter(self):
        content = '---\ntype: "always"\ndescription: "test"\n---\n\n# Rule\n\nContent here.'
        result = condense.strip_frontmatter(content)
        self.assertEqual(result, "# Rule\n\nContent here.")

    def test_no_frontmatter_returns_original(self):
        content = "# Rule\n\nContent here."
        result = condense.strip_frontmatter(content)
        self.assertEqual(result, content)

    def test_incomplete_frontmatter_returns_original(self):
        content = "---\nno closing marker"
        result = condense.strip_frontmatter(content)
        self.assertEqual(result, content)


class TestGenerateRuleSymlinks(unittest.TestCase):
    """Test generate_rule_symlinks() — creates symlinks in tool directories."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.project_root = Path(self.tmpdir)
        rules_dir = self.project_root / ".agent-src" / "rules"
        rules_dir.mkdir(parents=True)
        (rules_dir / "ask-when-uncertain.md").write_text("# Ask When Uncertain")
        (rules_dir / "scope-control.md").write_text("# Scope Control")
        self._orig = (condense.PROJECT_ROOT, condense.RULES_SOURCE)
        condense.PROJECT_ROOT = self.project_root
        condense.RULES_SOURCE = rules_dir

    def tearDown(self):
        condense.PROJECT_ROOT, condense.RULES_SOURCE = self._orig
        shutil.rmtree(self.tmpdir)

    def test_creates_symlinks_in_all_tool_dirs(self):
        condense.generate_rule_symlinks()
        for tool_dir in [".claude/rules", ".cursor/rules", ".clinerules"]:
            d = self.project_root / tool_dir
            self.assertTrue(d.exists(), f"{tool_dir} should exist")
            self.assertTrue((d / "ask-when-uncertain.md").is_symlink())
            self.assertTrue((d / "scope-control.md").is_symlink())

    def test_symlinks_resolve_correctly(self):
        condense.generate_rule_symlinks()
        link = self.project_root / ".claude" / "rules" / "ask-when-uncertain.md"
        self.assertTrue(link.resolve().exists())
        content = link.read_text()
        self.assertEqual(content, "# Ask When Uncertain")


class TestGenerateWindsurfrules(unittest.TestCase):
    """Test generate_windsurfrules() — concatenates rules without frontmatter."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.project_root = Path(self.tmpdir)
        rules_dir = self.project_root / ".agent-src" / "rules"
        rules_dir.mkdir(parents=True)
        (rules_dir / "rule-a.md").write_text('---\ntype: "always"\n---\n\n# Rule A\n\nContent A.')
        (rules_dir / "rule-b.md").write_text('---\ntype: "auto"\n---\n\n# Rule B\n\nContent B.')
        self._orig = (condense.PROJECT_ROOT, condense.RULES_SOURCE)
        condense.PROJECT_ROOT = self.project_root
        condense.RULES_SOURCE = rules_dir

    def tearDown(self):
        condense.PROJECT_ROOT, condense.RULES_SOURCE = self._orig
        shutil.rmtree(self.tmpdir)

    def test_generates_windsurfrules(self):
        condense.generate_windsurfrules()
        output = self.project_root / ".windsurfrules"
        self.assertTrue(output.exists())
        content = output.read_text()
        self.assertIn("# Auto-generated", content)
        self.assertIn("# Rule A", content)
        self.assertIn("# Rule B", content)

    def test_strips_frontmatter(self):
        condense.generate_windsurfrules()
        content = (self.project_root / ".windsurfrules").read_text()
        self.assertNotIn('type: "always"', content)
        self.assertNotIn('type: "auto"', content)


class TestGenerateClaudeSkills(unittest.TestCase):
    """Test generate_claude_skills() — creates skill symlinks."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.project_root = Path(self.tmpdir)
        skills_dir = self.project_root / ".agent-src" / "skills"
        (skills_dir / "api-design").mkdir(parents=True)
        (skills_dir / "api-design" / "SKILL.md").write_text("---\nname: api-design\n---\n# API")
        (skills_dir / "database").mkdir(parents=True)
        (skills_dir / "database" / "SKILL.md").write_text("---\nname: database\n---\n# DB")
        self._orig = (
            condense.PROJECT_ROOT,
            condense.SKILLS_SOURCE, condense.CLAUDE_SKILLS_DIR,
        )
        condense.PROJECT_ROOT = self.project_root
        condense.SKILLS_SOURCE = skills_dir
        condense.CLAUDE_SKILLS_DIR = self.project_root / ".claude" / "skills"

    def tearDown(self):
        (condense.PROJECT_ROOT,
         condense.SKILLS_SOURCE, condense.CLAUDE_SKILLS_DIR) = self._orig
        shutil.rmtree(self.tmpdir)

    def test_creates_skill_symlinks(self):
        condense.generate_claude_skills()
        claude_skills = self.project_root / ".claude" / "skills"
        self.assertTrue((claude_skills / "api-design").is_symlink())
        self.assertTrue((claude_skills / "database").is_symlink())

    def test_symlinks_resolve_to_skill_md(self):
        condense.generate_claude_skills()
        skill_md = self.project_root / ".claude" / "skills" / "api-design" / "SKILL.md"
        self.assertTrue(skill_md.exists())
        self.assertIn("api-design", skill_md.read_text())


class TestGenerateClaudeCommands(unittest.TestCase):
    """Test generate_claude_commands() — converts commands to Claude Skills."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.project_root = Path(self.tmpdir)
        commands_dir = self.project_root / ".agent-src" / "commands"
        commands_dir.mkdir(parents=True)
        (commands_dir / "commit.md").write_text("# commit\n\n## Instructions\n\nDo the commit.")
        (commands_dir / "feature-dev.md").write_text("---\nold: data\n---\n\n# feature-dev\n\nDevelop.")
        self._orig = (
            condense.PROJECT_ROOT,
            condense.COMMANDS_SOURCE, condense.CLAUDE_SKILLS_DIR,
            condense.SKILLS_SOURCE,
        )
        condense.PROJECT_ROOT = self.project_root
        condense.COMMANDS_SOURCE = commands_dir
        condense.CLAUDE_SKILLS_DIR = self.project_root / ".claude" / "skills"
        # Point SKILLS_SOURCE to empty dir so no real skills interfere
        condense.SKILLS_SOURCE = self.project_root / ".agent-src" / "skills"

    def tearDown(self):
        (condense.PROJECT_ROOT,
         condense.COMMANDS_SOURCE, condense.CLAUDE_SKILLS_DIR,
         condense.SKILLS_SOURCE) = self._orig
        shutil.rmtree(self.tmpdir)

    def test_creates_command_skills(self):
        condense.generate_claude_commands()
        claude_skills = self.project_root / ".claude" / "skills"
        self.assertTrue((claude_skills / "commit" / "SKILL.md").exists())
        self.assertTrue((claude_skills / "feature-dev" / "SKILL.md").exists())

    def test_command_is_symlink(self):
        """Command SKILL.md should be a symlink to the source command file."""
        condense.generate_claude_commands()
        skill_file = self.project_root / ".claude" / "skills" / "commit" / "SKILL.md"
        self.assertTrue(skill_file.is_symlink())

    def test_command_preserves_content(self):
        """Symlinked command file should contain the original content."""
        condense.generate_claude_commands()
        content = (self.project_root / ".claude" / "skills" / "commit" / "SKILL.md").read_text()
        self.assertIn("Do the commit.", content)

    def test_command_symlink_points_to_source(self):
        """Symlink should point to the .agent-src/commands/ source file."""
        condense.generate_claude_commands()
        skill_file = self.project_root / ".claude" / "skills" / "feature-dev" / "SKILL.md"
        target = str(skill_file.resolve())
        self.assertIn("feature-dev.md", target)

    def test_command_skips_same_name_skill(self):
        """Commands with same name as a skill should be skipped."""
        # Create a skill with same name as 'commit' command
        skills_dir = self.project_root / ".agent-src" / "skills" / "commit"
        skills_dir.mkdir(parents=True)
        (skills_dir / "SKILL.md").write_text("# commit skill")
        condense.SKILLS_SOURCE = self.project_root / ".agent-src" / "skills"

        condense.generate_claude_commands()
        # Only feature-dev should exist, not commit (skill takes priority)
        claude_skills = self.project_root / ".claude" / "skills"
        self.assertFalse((claude_skills / "commit" / "SKILL.md").is_symlink())
        self.assertTrue((claude_skills / "feature-dev" / "SKILL.md").is_symlink())


class TestProjectToAugmentRulesMode(unittest.TestCase):
    """Test project_to_augment() rules-mode toggle (copy vs symlink)."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.project_root = Path(self.tmpdir)
        # Lay out a minimal .agent-src/ with rules + a symlinked subdir.
        (self.project_root / ".agent-src" / "rules").mkdir(parents=True)
        (self.project_root / ".agent-src" / "rules" / "alpha.md").write_text("rule alpha")
        (self.project_root / ".agent-src" / "rules" / "beta.md").write_text("rule beta")
        (self.project_root / ".agent-src" / "skills").mkdir()
        (self.project_root / ".agent-src" / "README.md").write_text("readme")

        self._orig_target = condense.TARGET_DIR
        self._orig_augment = condense.AUGMENT_DIR
        self._orig_settings = condense.SETTINGS_FILE
        condense.TARGET_DIR = self.project_root / ".agent-src"
        condense.AUGMENT_DIR = self.project_root / ".augment"
        condense.SETTINGS_FILE = self.project_root / ".agent-settings.yml"

    def tearDown(self):
        condense.TARGET_DIR = self._orig_target
        condense.AUGMENT_DIR = self._orig_augment
        condense.SETTINGS_FILE = self._orig_settings
        shutil.rmtree(self.tmpdir)

    def _write_setting(self, value):
        if value is None:
            return
        (self.project_root / ".agent-settings.yml").write_text(
            f"augment:\n  rules_use_symlinks: {value}\n"
        )

    def test_default_copies_rules(self):
        """No settings file → rules are real copies."""
        condense.project_to_augment()
        alpha = self.project_root / ".augment" / "rules" / "alpha.md"
        self.assertTrue(alpha.is_file())
        self.assertFalse(alpha.is_symlink())
        self.assertEqual(alpha.read_text(), "rule alpha")

    def test_explicit_false_copies_rules(self):
        """augment.rules_use_symlinks: false → rules are real copies."""
        self._write_setting("false")
        condense.project_to_augment()
        alpha = self.project_root / ".augment" / "rules" / "alpha.md"
        self.assertTrue(alpha.is_file())
        self.assertFalse(alpha.is_symlink())

    def test_true_symlinks_rules(self):
        """augment.rules_use_symlinks: true → rules are symlinks → .agent-src/rules/."""
        self._write_setting("true")
        condense.project_to_augment()
        alpha = self.project_root / ".augment" / "rules" / "alpha.md"
        self.assertTrue(alpha.is_symlink())
        # Symlink resolves to the .agent-src/ source
        self.assertEqual(alpha.resolve(), (self.project_root / ".agent-src" / "rules" / "alpha.md").resolve())

    def test_toggle_replaces_existing_files(self):
        """Switching modes must rewrite the entries (no copy↔symlink mismatch)."""
        # First: copy mode
        self._write_setting("false")
        condense.project_to_augment()
        alpha = self.project_root / ".augment" / "rules" / "alpha.md"
        self.assertFalse(alpha.is_symlink())
        # Switch to symlink mode
        self._write_setting("true")
        condense.project_to_augment()
        self.assertTrue(alpha.is_symlink())
        # And back
        self._write_setting("false")
        condense.project_to_augment()
        self.assertFalse(alpha.is_symlink())
        self.assertTrue(alpha.is_file())


class TestReadAugmentRulesUseSymlinks(unittest.TestCase):
    """Test the .agent-settings.yml reader for augment.rules_use_symlinks."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.project_root = Path(self.tmpdir)
        self._orig_settings = condense.SETTINGS_FILE
        condense.SETTINGS_FILE = self.project_root / ".agent-settings.yml"

    def tearDown(self):
        condense.SETTINGS_FILE = self._orig_settings
        shutil.rmtree(self.tmpdir)

    def _write(self, content: str) -> None:
        (self.project_root / ".agent-settings.yml").write_text(content)

    def test_missing_file_returns_false(self):
        self.assertFalse(condense._read_augment_rules_use_symlinks())

    def test_missing_block_returns_false(self):
        self._write("project:\n  pr_template: foo\n")
        self.assertFalse(condense._read_augment_rules_use_symlinks())

    def test_true_value(self):
        self._write("augment:\n  rules_use_symlinks: true\n")
        self.assertTrue(condense._read_augment_rules_use_symlinks())

    def test_false_value(self):
        self._write("augment:\n  rules_use_symlinks: false\n")
        self.assertFalse(condense._read_augment_rules_use_symlinks())

    def test_truthy_aliases(self):
        for alias in ("True", "yes", "ON", "1"):
            self._write(f"augment:\n  rules_use_symlinks: {alias}\n")
            self.assertTrue(
                condense._read_augment_rules_use_symlinks(),
                f"expected truthy for {alias!r}",
            )

    def test_inline_comment_stripped(self):
        self._write("augment:\n  rules_use_symlinks: true  # opt-in\n")
        self.assertTrue(condense._read_augment_rules_use_symlinks())

    def test_block_scoping(self):
        """rules_use_symlinks under a different block must not match."""
        self._write(
            "project:\n  rules_use_symlinks: true\naugment:\n  enabled: true\n"
        )
        self.assertFalse(condense._read_augment_rules_use_symlinks())


class TestCleanTools(unittest.TestCase):
    """Test clean_tools() — removes all generated directories."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.project_root = Path(self.tmpdir)
        # Create generated dirs
        (self.project_root / ".claude" / "rules").mkdir(parents=True)
        (self.project_root / ".cursor" / "rules").mkdir(parents=True)
        (self.project_root / ".clinerules").mkdir(parents=True)
        (self.project_root / ".windsurfrules").write_text("content")
        (self.project_root / "GEMINI.md").symlink_to("AGENTS.md")
        self._orig = condense.PROJECT_ROOT
        condense.PROJECT_ROOT = self.project_root

    def tearDown(self):
        condense.PROJECT_ROOT = self._orig
        shutil.rmtree(self.tmpdir)

    def test_removes_all_generated(self):
        condense.clean_tools()
        self.assertFalse((self.project_root / ".claude").exists())
        self.assertFalse((self.project_root / ".cursor").exists())
        self.assertFalse((self.project_root / ".clinerules").exists())
        self.assertFalse((self.project_root / ".windsurfrules").exists())
        self.assertFalse((self.project_root / "GEMINI.md").exists())


class TestGeneratePluginHooks(unittest.TestCase):
    """generate_plugin_hooks() emits hooks/hooks.json from the manifest."""

    def setUp(self):
        self.tmpdir = Path(tempfile.mkdtemp())
        (self.tmpdir / "scripts").mkdir()
        (self.tmpdir / "scripts" / "hook_manifest.yaml").write_text(
            "platforms:\n"
            "  claude:\n"
            "    session_start: [chat-history]\n"
            "    session_end: [chat-history]\n"
            "    stop: [chat-history]\n"
            "    user_prompt_submit: [chat-history]\n"
            "    post_tool_use: [chat-history, roadmap-progress]\n"
            "  copilot:\n"
            "    fallback_only: true\n"
            "native_event_aliases:\n"
            "  claude:\n"
            "    SessionStart: session_start\n"
            "    SessionEnd: session_end\n"
            "    Stop: stop\n"
            "    UserPromptSubmit: user_prompt_submit\n"
            "    PostToolUse: post_tool_use\n"
            "    PreToolUse: pre_tool_use\n",
            encoding="utf-8",
        )
        self._orig = condense.PROJECT_ROOT
        condense.PROJECT_ROOT = self.tmpdir

    def tearDown(self):
        condense.PROJECT_ROOT = self._orig
        shutil.rmtree(self.tmpdir)

    def test_emits_five_claude_bindings(self):
        count = condense.generate_plugin_hooks()
        self.assertEqual(count, 5)
        data = json.loads((self.tmpdir / "hooks" / "hooks.json").read_text())
        self.assertEqual(
            set(data["hooks"]),
            {"SessionStart", "SessionEnd", "Stop", "UserPromptSubmit", "PostToolUse"},
        )

    def test_commands_are_project_dir_rooted(self):
        condense.generate_plugin_hooks()
        data = json.loads((self.tmpdir / "hooks" / "hooks.json").read_text())
        for native, groups in data["hooks"].items():
            cmd = groups[0]["hooks"][0]["command"]
            self.assertIn('"$CLAUDE_PROJECT_DIR"/agent-config dispatch:hook', cmd)
            self.assertIn("--platform claude", cmd)
            self.assertIn(f"--native-event {native}", cmd)

    def test_skips_events_without_bindings(self):
        # PreToolUse is aliased but not bound under platforms.claude → omitted.
        condense.generate_plugin_hooks()
        data = json.loads((self.tmpdir / "hooks" / "hooks.json").read_text())
        self.assertNotIn("PreToolUse", data["hooks"])


if __name__ == "__main__":
    unittest.main()
