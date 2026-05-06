#!/usr/bin/env python3
"""Tests for the `_rewrite_paths` primitive in `scripts/compress.py`.

Covers Phase 1 of `agents/roadmaps/road-to-path-fixes.md`:
- frontmatter `load_context:` rewrites (logical + legacy)
- frontmatter `path_prefix:` left alone (literal match pattern, not a file ref)
- body-link rewrites for docs/guidelines + docs/contracts
- idempotence
- depth-aware prefix for nested source files
- no-rewrite for paths that are already relative

Run: python3 -m unittest tests.test_compress_paths -v
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import compress  # noqa: E402


RULE_AT = "rules/example.md"
NESTED_AT = "commands/council/default.md"


class TestRewritePathsLoadContext(unittest.TestCase):
    """Frontmatter `load_context:` rewrites."""

    def test_logical_name_gets_depth_prefix(self):
        src = (
            "---\n"
            "type: \"always\"\n"
            "load_context:\n"
            "  - contexts/execution/verification-mechanics.md\n"
            "---\n"
            "# Body\n"
        )
        out = compress._rewrite_paths(src, RULE_AT)
        self.assertIn("- ../contexts/execution/verification-mechanics.md", out)
        self.assertNotIn("- contexts/execution/verification-mechanics.md", out)

    def test_legacy_uncompressed_prefix_stripped(self):
        src = (
            "---\n"
            "load_context:\n"
            "  - .agent-src.uncompressed/contexts/authority/scope-mechanics.md\n"
            "---\n"
            "Body.\n"
        )
        out = compress._rewrite_paths(src, RULE_AT)
        self.assertIn("- ../contexts/authority/scope-mechanics.md", out)
        self.assertNotIn(".agent-src.uncompressed/", out)

    def test_load_context_eager_also_rewritten(self):
        src = (
            "---\n"
            "load_context_eager:\n"
            "  - contexts/foo.md\n"
            "  - contexts/bar.md\n"
            "---\n"
        )
        out = compress._rewrite_paths(src, RULE_AT)
        self.assertIn("- ../contexts/foo.md", out)
        self.assertIn("- ../contexts/bar.md", out)


class TestRewritePathsPathPrefix(unittest.TestCase):
    """Frontmatter `triggers[].path_prefix:` rewrites."""

    def test_legacy_prefix_left_alone(self):
        # `path_prefix:` is a literal match pattern, not a file ref —
        # the rewriter passes it through untouched (Modified Option 1
        # per road-to-path-fixes.md P2.2 / Council 2026-05-06).
        src = (
            "---\n"
            "triggers:\n"
            "  - path_prefix: \".agent-src.uncompressed/skills/\"\n"
            "---\n"
        )
        out = compress._rewrite_paths(src, RULE_AT)
        self.assertIn('path_prefix: ".agent-src.uncompressed/skills/"', out)

    def test_unrelated_path_prefix_left_alone(self):
        src = (
            "---\n"
            "triggers:\n"
            "  - path_prefix: \"agents/\"\n"
            "  - path_prefix: \"lang/\"\n"
            "---\n"
        )
        out = compress._rewrite_paths(src, RULE_AT)
        self.assertIn('path_prefix: "agents/"', out)
        self.assertIn('path_prefix: "lang/"', out)


class TestRewritePathsBodyLinks(unittest.TestCase):
    """Body-link rewrites for `../../docs/{guidelines,contracts}/`."""

    def test_guidelines_link_rewritten(self):
        body = "See [`x`](../../docs/guidelines/agent-infra/x.md) for more.\n"
        out = compress._rewrite_paths(body, RULE_AT)
        self.assertIn("(../docs/guidelines/agent-infra/x.md)", out)
        self.assertNotIn("../../docs/guidelines/", out)

    def test_contracts_link_rewritten(self):
        body = "Contract: [foo](../../docs/contracts/foo.md).\n"
        out = compress._rewrite_paths(body, RULE_AT)
        self.assertIn("(../docs/contracts/foo.md)", out)
        self.assertNotIn("../../docs/contracts/", out)

    def test_internal_relative_link_left_alone(self):
        body = "See [`x`](../contexts/foo.md) — already relative.\n"
        out = compress._rewrite_paths(body, RULE_AT)
        self.assertIn("(../contexts/foo.md)", out)


class TestRewritePathsDepthAndIdempotence(unittest.TestCase):
    """Depth handling for nested files + idempotence."""

    def test_nested_source_uses_two_levels(self):
        src = (
            "---\n"
            "load_context:\n"
            "  - contexts/foo.md\n"
            "---\n"
            "[g](../../docs/guidelines/x.md)\n"
        )
        out = compress._rewrite_paths(src, NESTED_AT)
        self.assertIn("- ../../contexts/foo.md", out)
        self.assertIn("(../../docs/guidelines/x.md)", out)

    def test_idempotent(self):
        src = (
            "---\n"
            "load_context:\n"
            "  - contexts/execution/foo.md\n"
            "---\n"
            "[g](../../docs/guidelines/x.md)\n"
        )
        once = compress._rewrite_paths(src, RULE_AT)
        twice = compress._rewrite_paths(once, RULE_AT)
        self.assertEqual(once, twice)

    def test_no_frontmatter_passes_through_body(self):
        body = "Just body. [g](../../docs/guidelines/x.md)\n"
        out = compress._rewrite_paths(body, RULE_AT)
        self.assertEqual(out, "Just body. [g](../docs/guidelines/x.md)\n")


class TestApplyPathRewriterWiring(unittest.TestCase):
    """In-place rewrite hooked into `mark_done` (writes to .agent-src/)."""

    def setUp(self):
        import tempfile
        self._tmp = tempfile.TemporaryDirectory()
        tmp_root = Path(self._tmp.name)
        self._orig_target = compress.TARGET_DIR
        compress.TARGET_DIR = tmp_root
        self.rule_dir = tmp_root / "rules"
        self.rule_dir.mkdir()

    def tearDown(self):
        compress.TARGET_DIR = self._orig_target
        self._tmp.cleanup()

    def _write_rule(self, body: str) -> Path:
        path = self.rule_dir / "example.md"
        path.write_text(body, encoding="utf-8")
        return path

    def test_modifies_file_when_rewrite_needed(self):
        path = self._write_rule(
            "---\nload_context:\n  - contexts/foo.md\n---\nbody\n"
        )
        modified = compress.apply_path_rewriter("rules/example.md")
        self.assertTrue(modified)
        self.assertIn("- ../contexts/foo.md", path.read_text())

    def test_returns_false_when_already_rewritten(self):
        self._write_rule(
            "---\nload_context:\n  - ../contexts/foo.md\n---\nbody\n"
        )
        self.assertFalse(compress.apply_path_rewriter("rules/example.md"))

    def test_returns_false_when_target_missing(self):
        self.assertFalse(compress.apply_path_rewriter("rules/missing.md"))


if __name__ == "__main__":
    unittest.main()
