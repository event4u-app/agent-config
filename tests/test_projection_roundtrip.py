#!/usr/bin/env python3
"""
Roundtrip tests for tool-projection emitters in scripts/condense.py.

Adopted from the continuedev/continue analysis (ADR-031): Continue validates
its config by round-tripping markdown → frontmatter → object → markdown. We
assert the inverse property for our projection emitters — a source rule's
load-bearing frontmatter (description, alwaysApply/trigger) survives the
emit → re-parse cycle intact, so a projection drift fails loudly instead of
silently shipping a malformed `.cursor/rules/*.mdc` or `.windsurf/rules/*.md`.

Run: python3 -m unittest tests.test_projection_roundtrip -v
"""

import sys
import tempfile
import unittest
from pathlib import Path

# Add project scripts/ to path so we can import the condense module.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src" / "scripts"))

import condense  # noqa: E402


def _write_source(tmp: Path, frontmatter: str, body: str = "Rule body.\n") -> Path:
    src = tmp / "sample-rule.md"
    src.write_text(f"---\n{frontmatter}\n---\n\n{body}", encoding="utf-8")
    return src


class CursorMdcRoundtrip(unittest.TestCase):
    def _roundtrip(self, frontmatter: str, body: str = "Rule body.\n") -> tuple[dict, str]:
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            src = _write_source(tmp, frontmatter, body)
            target = tmp / "sample-rule.mdc"
            condense._emit_cursor_mdc(src, target)
            return condense._parse_frontmatter(target.read_text(encoding="utf-8"))

    def test_description_survives(self) -> None:
        meta, _ = self._roundtrip('description: "Do the thing well"\ntype: auto')
        self.assertEqual(meta["description"], "Do the thing well")

    def test_multiline_description_flattens_to_single_line(self) -> None:
        # Source descriptions may wrap (YAML literal block); the emitter joins
        # them so the `.mdc` frontmatter stays a single scalar that re-parses
        # cleanly instead of breaking the `---` block.
        meta, _ = self._roundtrip("description: |\n  line one\n  line two\ntype: auto")
        self.assertNotIn("\n", meta["description"])
        self.assertEqual(meta["description"], "line one line two")

    def test_type_always_maps_to_always_apply_true(self) -> None:
        meta, _ = self._roundtrip('description: "x"\ntype: always')
        self.assertTrue(meta["alwaysApply"])

    def test_explicit_always_apply_true_survives(self) -> None:
        meta, _ = self._roundtrip('description: "x"\nalwaysApply: true')
        self.assertTrue(meta["alwaysApply"])

    def test_auto_type_maps_to_always_apply_false(self) -> None:
        meta, _ = self._roundtrip('description: "x"\ntype: auto')
        self.assertFalse(meta["alwaysApply"])

    def test_body_survives(self) -> None:
        _, body = self._roundtrip('description: "x"\ntype: auto', body="Real content here.\n")
        self.assertIn("Real content here.", body)


class WindsurfRuleRoundtrip(unittest.TestCase):
    def _roundtrip(self, frontmatter: str) -> dict:
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            src = _write_source(tmp, frontmatter)
            target = tmp / "sample-rule.md"
            condense._emit_windsurf_rule(src, target)
            meta, _ = condense._parse_frontmatter(target.read_text(encoding="utf-8"))
            return meta

    def test_always_maps_to_always_on_trigger(self) -> None:
        meta = self._roundtrip('description: "x"\ntype: always')
        self.assertEqual(meta["trigger"], "always_on")

    def test_auto_maps_to_model_decision_trigger(self) -> None:
        meta = self._roundtrip('description: "x"\ntype: auto')
        self.assertEqual(meta["trigger"], "model_decision")

    def test_description_survives(self) -> None:
        meta = self._roundtrip('description: "Keep this text"\ntype: auto')
        self.assertEqual(meta["description"], "Keep this text")


if __name__ == "__main__":
    unittest.main()
