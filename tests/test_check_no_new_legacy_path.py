"""Tests for the legacy-path regression guard (scripts/check_no_new_legacy_path.py).

Guards against the dead `.agent-src.uncondensed/` path creeping back into `src/`
prose after the ADR-051 relocation. CI-for-the-CI: prove the diff parser flags a
new reference, ignores removals, and exempts the three detection/legacy files.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src" / "scripts"))
import check_no_new_legacy_path as g  # noqa: E402


def _diff(path: str, added_line: str, sign: str = "+") -> str:
    return f"diff --git a/{path} b/{path}\n--- a/{path}\n+++ b/{path}\n{sign}{added_line}\n"


def test_new_reference_in_src_skill_is_flagged():
    diff = _diff("src/skills/foo/SKILL.md", "see `.agent-src.uncondensed/rules/x.md`")
    offenders = g.find_offenders(diff)
    assert offenders and "src/skills/foo/SKILL.md" in offenders[0]


def test_removed_reference_is_not_flagged():
    # a `-` line removing the legacy path is the GOOD direction — never a failure
    diff = _diff("src/skills/foo/SKILL.md", "see `.agent-src.uncondensed/rules/x.md`", sign="-")
    assert g.find_offenders(diff) == []


def test_clean_addition_is_not_flagged():
    diff = _diff("src/skills/foo/SKILL.md", "see `src/rules/x.md`")
    assert g.find_offenders(diff) == []


def test_exempt_files_are_not_flagged():
    # the three detection/legacy-const files legitimately contain the literal
    for exempt in (
        "src/scripts/_lib/agent_src.py",
        "src/scripts/check_references.py",
        "src/scripts/check_condensed_paths.py",
    ):
        diff = _diff(exempt, 'LEGACY = ".agent-src.uncondensed/"')
        assert g.find_offenders(diff) == [], f"{exempt} must be exempt"


def test_non_src_files_are_ignored():
    # a full diff (gh pr diff) carries every path; only src/ is in scope —
    # docs/, tests/, agents/, taskfiles/ mentions must NOT be flagged
    for path in (
        "docs/governance.md",
        "tests/test_check_no_new_legacy_path.py",
        "agents/roadmaps/x.md",
        "taskfiles/ci-fast.yml",
    ):
        diff = _diff(path, "the `.agent-src.uncondensed/` literal")
        assert g.find_offenders(diff) == [], f"{path} is outside src/ — must be ignored"


def test_multiple_files_in_one_diff():
    diff = (
        _diff("src/rules/a.md", "`.agent-src.uncondensed/rules/a.md`")
        + _diff("src/agent-src/contexts/b.md", "`.agent-src.uncondensed/contexts/b.md`")
    )
    offenders = g.find_offenders(diff)
    assert len(offenders) == 2
