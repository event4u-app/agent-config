"""Step 7a inline-invoke proof — road-to-6.2.0-consolidation-evidence-gates.

The roadmap's Step 7a gate requires proving the **inline-invoke path** before
any command→skill conversion lands: "a skill is reachable by description-match
without command ceremony." This test is that proof.

It exercises the package's real description-match selector
(`skill_tools.score_skill_relevance.rank`) — the same mechanism the host tool
(Claude / Cursor / Augment) uses to pick a skill from a natural-language task,
with no `/command` prefix. For a set of skills with distinctive descriptions, a
plain task phrase built from their vocabulary must rank the intended skill at or
near the top of the result set.

Decision provenance: ADR-057 (consolidation evidence-gate outcomes). The Step 7a
*conversion* is deferred per the AI-council convergence (2026-06-06); this proof
demonstrates the mechanism the eventual conversion will rely on, and locks it as
a regression gate so the inline-invoke property cannot silently rot.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
SKILLS_DIR = REPO_ROOT / "src" / "skills"

sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))
from skill_tools.score_skill_relevance import rank  # noqa: E402


# (natural-language task — no command ceremony, expected skill reachable in top-N)
# Anchors chosen for distinctive description vocabulary so the proof is stable.
REACHABILITY_CASES = [
    ("suggest reviewers and historical bug patterns for this pull request diff", "review-routing"),
    ("render a dcf valuation with discount rate sensitivity", "dcf-modeling"),
    ("model startup runway and monthly burn rate", "runway-cognition"),
    ("write a playwright end to end browser test", "playwright-testing"),
    ("threat model abuse cases before implementing auth", "threat-modeling"),
]

TOP_N = 3


def test_skills_dir_is_the_source_of_truth() -> None:
    """Guard the assumption: the live skill source is src/skills (ADR-050)."""
    assert SKILLS_DIR.is_dir(), f"expected skill source at {SKILLS_DIR}"
    assert sum(1 for _ in SKILLS_DIR.glob("*/SKILL.md")) > 100


@pytest.mark.parametrize("task,expected", REACHABILITY_CASES)
def test_skill_reachable_by_description_match(task: str, expected: str) -> None:
    """A skill is selectable by a natural task phrase, no `/command` needed."""
    ranked = rank(task, SKILLS_DIR)
    top_names = [name for name, _score, _personas in ranked[:TOP_N]]
    assert expected in top_names, (
        f"inline-invoke path broken: {expected!r} not in top-{TOP_N} for "
        f"task {task!r}; got {[(n, s) for n, s, _ in ranked[:TOP_N]]}"
    )
    # the match must carry a real positive score, not a zero-rank tail entry
    score = next(s for n, s, _ in ranked if n == expected)
    assert score > 0


def test_unrelated_task_does_not_force_a_false_match() -> None:
    """Negative control: an off-topic phrase must not rank a finance skill #1."""
    ranked = rank("xyzzy plugh frobnicate quux", SKILLS_DIR)
    assert "dcf-modeling" not in [n for n, _s, _p in ranked[:TOP_N]]
