#!/usr/bin/env python3
"""
Tests for scripts/compress.py

Run: python3 -m unittest tests.test_compress -v
"""

import shutil
import sys
import tempfile
import unittest
from pathlib import Path

# Add project root to path so we can import the compress module
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import compress


class TestShouldCompress(unittest.TestCase):
    """Test the should_compress() function."""

    def test_md_file_should_compress(self):
        self.assertTrue(compress.should_compress(Path("rules/token-efficiency.md")))

    def test_readme_should_not_compress(self):
        self.assertFalse(compress.should_compress(Path("README.md")))

    def test_php_file_should_not_compress(self):
        self.assertFalse(compress.should_compress(Path("scripts/scan.php")))

    def test_txt_file_should_not_compress(self):
        self.assertFalse(compress.should_compress(Path("notes.txt")))

    def test_nested_md_should_compress(self):
        self.assertTrue(compress.should_compress(Path("skills/coder/SKILL.md")))


class TestCleanupStale(unittest.TestCase):
    """Test the cleanup_stale() function."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.source = Path(self.tmpdir) / "source"
        self.target = Path(self.tmpdir) / "target"
        self.source.mkdir()
        self.target.mkdir()

    def tearDown(self):
        shutil.rmtree(self.tmpdir)

    def test_deletes_stale_files(self):
        (self.source / "file_a.md").write_text("a")
        (self.target / "file_a.md").write_text("a")
        (self.target / "file_b.md").write_text("b")

        deleted = compress.cleanup_stale(self.source, self.target)

        self.assertEqual(deleted, 1)
        self.assertTrue((self.target / "file_a.md").exists())
        self.assertFalse((self.target / "file_b.md").exists())

    def test_no_stale_files(self):
        (self.source / "file_a.md").write_text("a")
        (self.target / "file_a.md").write_text("a")

        deleted = compress.cleanup_stale(self.source, self.target)
        self.assertEqual(deleted, 0)

    def test_removes_empty_directories(self):
        (self.source / "rules").mkdir()
        (self.source / "rules" / "a.md").write_text("a")
        (self.target / "rules").mkdir()
        (self.target / "rules" / "a.md").write_text("a")
        (self.target / "old-dir").mkdir()
        (self.target / "old-dir" / "stale.md").write_text("stale")

        compress.cleanup_stale(self.source, self.target)

        self.assertFalse((self.target / "old-dir").exists())

    def test_preserves_nested_structure(self):
        (self.source / "skills" / "coder").mkdir(parents=True)
        (self.source / "skills" / "coder" / "SKILL.md").write_text("skill")
        (self.target / "skills" / "coder").mkdir(parents=True)
        (self.target / "skills" / "coder" / "SKILL.md").write_text("skill")
        (self.target / "skills" / "old-skill").mkdir(parents=True)
        (self.target / "skills" / "old-skill" / "SKILL.md").write_text("old")

        compress.cleanup_stale(self.source, self.target)

        self.assertTrue((self.target / "skills" / "coder" / "SKILL.md").exists())
        self.assertFalse((self.target / "skills" / "old-skill").exists())

    def test_nonexistent_target_returns_zero(self):
        deleted = compress.cleanup_stale(self.source, Path(self.tmpdir) / "nope")
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

        compress.copy_file(source_file, target_file)

        self.assertTrue(target_file.exists())
        self.assertEqual(target_file.read_text(), "<?php echo 'hello';")

    def test_creates_target_directory(self):
        source_file = self.source / "scripts" / "scan.php"
        source_file.parent.mkdir(parents=True)
        source_file.write_text("<?php")
        target_file = self.target / "scripts" / "scan.php"

        compress.copy_file(source_file, target_file)

        self.assertTrue(target_file.exists())


class TestSyncNonMd(unittest.TestCase):
    """Test sync_non_md() — copies only non-.md and COPY_AS_IS files."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.source = Path(self.tmpdir) / "source"
        self.target = Path(self.tmpdir) / "target"
        self.source.mkdir()
        self.target.mkdir()

    def tearDown(self):
        shutil.rmtree(self.tmpdir)

    def test_copies_php_files(self):
        (self.source / "scripts").mkdir()
        (self.source / "scripts" / "scan.php").write_text("<?php")

        copied = compress.sync_non_md(self.source, self.target)

        self.assertEqual(copied, 1)
        self.assertTrue((self.target / "scripts" / "scan.php").exists())

    def test_skips_compressible_md_files(self):
        (self.source / "rules").mkdir()
        (self.source / "rules" / "test.md").write_text("# Rule")

        copied = compress.sync_non_md(self.source, self.target)

        self.assertEqual(copied, 0)
        self.assertFalse((self.target / "rules" / "test.md").exists())

    def test_copies_readme_as_is(self):
        (self.source / "README.md").write_text("# Readme")

        copied = compress.sync_non_md(self.source, self.target)

        self.assertEqual(copied, 1)
        self.assertTrue((self.target / "README.md").exists())
        self.assertEqual((self.target / "README.md").read_text(), "# Readme")


class TestListMdFiles(unittest.TestCase):
    """Test list_md_files() — lists .md files that need agent compression."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.source = Path(self.tmpdir) / "source"
        self.source.mkdir()

    def tearDown(self):
        shutil.rmtree(self.tmpdir)

    def test_lists_md_files(self):
        (self.source / "rules").mkdir()
        (self.source / "rules" / "a.md").write_text("rule")
        (self.source / "rules" / "b.md").write_text("rule")

        files = compress.list_md_files(self.source)

        self.assertEqual(len(files), 2)
        self.assertIn("rules/a.md", files)
        self.assertIn("rules/b.md", files)

    def test_excludes_readme(self):
        (self.source / "README.md").write_text("readme")
        (self.source / "rules").mkdir()
        (self.source / "rules" / "a.md").write_text("rule")

        files = compress.list_md_files(self.source)

        self.assertEqual(len(files), 1)
        self.assertNotIn("README.md", files)

    def test_excludes_non_md(self):
        (self.source / "scripts").mkdir()
        (self.source / "scripts" / "scan.php").write_text("<?php")

        files = compress.list_md_files(self.source)

        self.assertEqual(len(files), 0)


class TestCheckSync(unittest.TestCase):
    """Test check_sync() — detects missing and stale files."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.source = Path(self.tmpdir) / "source"
        self.target = Path(self.tmpdir) / "target"
        self.source.mkdir()
        self.target.mkdir()

    def tearDown(self):
        shutil.rmtree(self.tmpdir)

    def test_in_sync(self):
        (self.source / "a.md").write_text("source")
        (self.target / "a.md").write_text("compressed")

        missing, stale = compress.check_sync(self.source, self.target)

        self.assertEqual(missing, [])
        self.assertEqual(stale, [])

    def test_detects_missing_in_target(self):
        (self.source / "new.md").write_text("new")

        missing, stale = compress.check_sync(self.source, self.target)

        self.assertEqual(missing, ["new.md"])
        self.assertEqual(stale, [])

    def test_detects_stale_in_target(self):
        (self.target / "old.md").write_text("old")

        missing, stale = compress.check_sync(self.source, self.target)

        self.assertEqual(missing, [])
        self.assertEqual(stale, ["old.md"])

    def test_detects_both(self):
        (self.source / "new.md").write_text("new")
        (self.target / "old.md").write_text("old")

        missing, stale = compress.check_sync(self.source, self.target)

        self.assertEqual(missing, ["new.md"])
        self.assertEqual(stale, ["old.md"])


if __name__ == "__main__":
    unittest.main()
