#!/usr/bin/env python3
"""
Golden tests for pack-scoped projection (road-to-6.0.0-B, Step 10 / ADR-040).

Covers the four acceptance criteria:
  (a) legacy-all projects the FULL set (entry-for-entry, the byte-identical
      guarantee at projection-set granularity) for the Claude tree;
  (b) a scoped allowlist projects ONLY its active set;
  (c) a projection switch is reversible (scoped → legacy-all restores full);
  (d) an inactive entry is absent under scoped but present under legacy-all.

The generators are driven directly against temp output dirs so the suite is
independent of the local `agents/.agent-tools.yml` gating (which no-ops
`generate_tools` in the maintainer repo).

Run: python3 -m unittest tests.test_projection_scoped -v
"""

import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import condense  # noqa: E402


class PredicateDerivation(unittest.TestCase):
    def test_command_path_to_slug_nested(self) -> None:
        self.assertEqual(
            condense._command_path_to_slug(
                "packages/core/.agent-src.uncondensed/commands/council/analysis.md"
            ),
            "council-analysis",
        )

    def test_command_path_to_slug_top_level(self) -> None:
        self.assertEqual(
            condense._command_path_to_slug(
                "packages/core/.agent-src.uncondensed/commands/commit.md"
            ),
            "commit",
        )

    def test_skill_path_to_name(self) -> None:
        self.assertEqual(
            condense._skill_path_to_name(
                "packages/core/.agent-src.uncondensed/skills/accessibility-auditor/SKILL.md"
            ),
            "accessibility-auditor",
        )

    def test_legacy_all_yields_no_predicates(self) -> None:
        with mock.patch.object(condense, "_read_projection_mode", return_value="legacy-all"):
            cmd, skill = condense._resolve_active_predicates()
        self.assertIsNone(cmd)
        self.assertIsNone(skill)

    def test_scoped_yields_predicate_sets(self) -> None:
        with mock.patch.object(condense, "_read_projection_mode", return_value="scoped"):
            cmd, skill = condense._resolve_active_predicates()
        self.assertIsInstance(cmd, set)
        self.assertIsInstance(skill, set)
        # Scoped is a strict subset of the full source surface.
        all_skills = {d.name for d in condense.SKILLS_SOURCE.iterdir() if d.is_dir()}
        self.assertTrue(skill <= all_skills)
        self.assertLess(len(skill), len(all_skills))


class ScopedClaudeSkills(unittest.TestCase):
    """generate_claude_skills honours the active-skill allowlist."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        tmp = Path(self._tmp.name) / "skills"
        patcher = mock.patch.object(condense, "CLAUDE_SKILLS_DIR", tmp)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(self._tmp.cleanup)
        self.tmp = tmp
        self.all_skills = sorted(
            d.name for d in condense.SKILLS_SOURCE.iterdir() if d.is_dir()
        )

    def _entries(self) -> set[str]:
        return {p.name for p in self.tmp.iterdir()} if self.tmp.exists() else set()

    def test_a_legacy_all_projects_full_set(self) -> None:
        n = condense.generate_claude_skills(None)
        self.assertEqual(n, len(self.all_skills))
        self.assertEqual(self._entries(), set(self.all_skills))

    def test_b_scoped_projects_only_active(self) -> None:
        active = set(self.all_skills[:3])
        n = condense.generate_claude_skills(active)
        self.assertEqual(n, 3)
        self.assertEqual(self._entries(), active)

    def test_d_inactive_absent_scoped_present_legacy(self) -> None:
        active = set(self.all_skills[:3])
        inactive = self.all_skills[3]
        condense.generate_claude_skills(active)
        self.assertNotIn(inactive, self._entries())
        condense.generate_claude_skills(None)
        self.assertIn(inactive, self._entries())

    def test_c_switch_is_reversible(self) -> None:
        condense.generate_claude_skills(set(self.all_skills[:3]))
        self.assertEqual(len(self._entries()), 3)
        condense.generate_claude_skills(None)  # back to legacy-all
        self.assertEqual(self._entries(), set(self.all_skills))


class ScopedCursorCommands(unittest.TestCase):
    """generate_cursor_commands honours the active-command-slug allowlist."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        tmp = Path(self._tmp.name) / "commands"
        patcher = mock.patch.object(condense, "CURSOR_COMMANDS_DIR", tmp)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(self._tmp.cleanup)
        self.tmp = tmp
        self.all_slugs = sorted(slug for _, slug in condense._iter_commands())

    def _entries(self) -> set[str]:
        return {p.stem for p in self.tmp.glob("*.md")} if self.tmp.exists() else set()

    def test_legacy_all_projects_full_set(self) -> None:
        n = condense.generate_cursor_commands(None)
        self.assertEqual(n, len(self.all_slugs))
        self.assertEqual(self._entries(), set(self.all_slugs))

    def test_scoped_projects_only_active(self) -> None:
        active = set(self.all_slugs[:2])
        n = condense.generate_cursor_commands(active)
        self.assertEqual(n, 2)
        self.assertEqual(self._entries(), active)
        # An inactive command is reaped on switch-down.
        condense.generate_cursor_commands(None)
        self.assertEqual(self._entries(), set(self.all_slugs))


class ScopedResolverIntegration(unittest.TestCase):
    """End-to-end: a profile's resolved set excludes inactive-pack artefacts."""

    def test_inactive_pack_skill_absent_under_scoped(self) -> None:
        from scripts.config import packs as P
        from scripts.config.profiles import resolve_profile

        repo = Path(__file__).resolve().parent.parent
        fin = resolve_profile(project_root=repo, user_settings={"profile": {"id": "finance"}})
        scoped = P.resolve_active_set(repo, sorted(set(fin.packs)))
        scoped_skill_names = {condense._skill_path_to_name(p) for p in scoped.skills}
        full = P.resolve_active_set(repo, [], legacy_all=True)
        full_skill_names = {condense._skill_path_to_name(p) for p in full.skills}

        # A laravel skill is in the full set but not the finance-scoped set.
        self.assertIn("laravel", full_skill_names)
        self.assertNotIn("laravel", scoped_skill_names)
        # The finance profile's own hinted skills ARE present (self-sufficient).
        self.assertIn("dcf-modeling", scoped_skill_names)


class AtomicRestore(unittest.TestCase):
    """generate_tools restores the full projection if a scoped run fails (D4)."""

    def test_scoped_failure_restores_full_then_reraises(self) -> None:
        calls: list[tuple] = []

        def fake_inner(cmd, skill):
            calls.append((cmd, skill))
            if len(calls) == 1:  # the scoped attempt fails
                raise RuntimeError("boom")

        with mock.patch.object(
            condense, "_resolve_active_predicates", return_value=({"commit"}, {"laravel"})
        ), mock.patch.object(condense, "_generate_tools_inner", side_effect=fake_inner):
            with self.assertRaises(RuntimeError):
                condense.generate_tools()

        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[0], ({"commit"}, {"laravel"}))  # scoped attempt
        self.assertEqual(calls[1], (None, None))  # full-set restore

    def test_legacy_all_runs_once_no_restore(self) -> None:
        calls: list[tuple] = []
        with mock.patch.object(
            condense, "_resolve_active_predicates", return_value=(None, None)
        ), mock.patch.object(
            condense, "_generate_tools_inner", side_effect=lambda c, s: calls.append((c, s))
        ):
            condense.generate_tools()
        self.assertEqual(calls, [(None, None)])


if __name__ == "__main__":
    unittest.main()
