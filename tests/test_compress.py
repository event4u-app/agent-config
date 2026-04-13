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


class TestFileHash(unittest.TestCase):
    """Test file_hash() — SHA-256 of file content."""

    def test_returns_consistent_hash(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write("hello world")
            f.flush()
            path = Path(f.name)
        try:
            h1 = compress.file_hash(path)
            h2 = compress.file_hash(path)
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
            self.assertNotEqual(compress.file_hash(path_a), compress.file_hash(path_b))
        finally:
            path_a.unlink()
            path_b.unlink()


class TestHashTracking(unittest.TestCase):
    """Test load_hashes, save_hashes, mark_done, mark_all_done, list_changed_md."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.source = Path(self.tmpdir) / "source"
        self.source.mkdir()
        self.hash_file = Path(self.tmpdir) / "hashes.json"
        # Patch globals
        self._orig_hash_file = compress.HASH_FILE
        self._orig_source_dir = compress.SOURCE_DIR
        compress.HASH_FILE = self.hash_file
        compress.SOURCE_DIR = self.source

    def tearDown(self):
        compress.HASH_FILE = self._orig_hash_file
        compress.SOURCE_DIR = self._orig_source_dir
        shutil.rmtree(self.tmpdir)

    def test_load_hashes_empty_when_no_file(self):
        self.assertEqual(compress.load_hashes(), {})

    def test_save_and_load_roundtrip(self):
        data = {"rules/a.md": "abc123"}
        compress.save_hashes(data)
        self.assertEqual(compress.load_hashes(), data)

    def test_load_hashes_handles_corrupt_json(self):
        self.hash_file.write_text("not valid json{{{")
        self.assertEqual(compress.load_hashes(), {})

    def test_list_changed_detects_new_file(self):
        (self.source / "rules").mkdir()
        (self.source / "rules" / "new.md").write_text("# New rule")
        changed = compress.list_changed_md(self.source)
        self.assertEqual(changed, ["rules/new.md"])

    def test_list_changed_detects_modified_file(self):
        (self.source / "rules").mkdir()
        f = self.source / "rules" / "a.md"
        f.write_text("version 1")
        compress.save_hashes({"rules/a.md": compress.file_hash(f)})
        f.write_text("version 2")
        changed = compress.list_changed_md(self.source)
        self.assertEqual(changed, ["rules/a.md"])

    def test_list_changed_ignores_unchanged(self):
        (self.source / "rules").mkdir()
        f = self.source / "rules" / "a.md"
        f.write_text("unchanged")
        compress.save_hashes({"rules/a.md": compress.file_hash(f)})
        changed = compress.list_changed_md(self.source)
        self.assertEqual(changed, [])

    def test_list_changed_ignores_non_md(self):
        (self.source / "scripts").mkdir()
        (self.source / "scripts" / "scan.php").write_text("<?php")
        changed = compress.list_changed_md(self.source)
        self.assertEqual(changed, [])

    def test_mark_all_done_stores_all_hashes(self):
        (self.source / "rules").mkdir()
        (self.source / "rules" / "a.md").write_text("rule a")
        (self.source / "rules" / "b.md").write_text("rule b")
        (self.source / "scripts").mkdir()
        (self.source / "scripts" / "x.php").write_text("<?php")
        compress.mark_all_done()
        hashes = compress.load_hashes()
        self.assertIn("rules/a.md", hashes)
        self.assertIn("rules/b.md", hashes)
        self.assertNotIn("scripts/x.php", hashes)  # non-.md excluded

    def test_mark_all_done_then_nothing_changed(self):
        (self.source / "rules").mkdir()
        (self.source / "rules" / "a.md").write_text("rule a")
        compress.mark_all_done()
        changed = compress.list_changed_md(self.source)
        self.assertEqual(changed, [])


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
