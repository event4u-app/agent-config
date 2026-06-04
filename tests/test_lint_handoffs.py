"""Tests for ``scripts/lint_handoffs.py``.

Fixtures per ``road-to-suite-closure.md`` Phase 3.3 + Phase 6.4:
  - two valid chains (W3 launch, W4 forecasting)
  - one cycle
  - one dangling reference
  - one tier-mismatch
  - one valid cross-wing chain
  - one non-senior skip (forward-only floor)
  - one mode-6 worktree-bounded cross-wing chain (Phase 6.4)
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src" / "scripts"))

from lint_handoffs import lint  # noqa: E402


def make_skill(
    root: Path,
    slug: str,
    *,
    tier: str | None,
    related_links: list[tuple[str, str]] | None = None,
    composition_links: list[tuple[str, str]] | None = None,
) -> Path:
    """Write a fixture SKILL.md.

    ``composition_links`` go under ``**WHEN to use this**`` — they form
    the directed composition graph (cycle detection applies).
    ``related_links`` go under ``**WHEN NOT to use this**`` — alternative
    pointers, validated for dangling/tier-mismatch but never as cycle edges.
    """
    skills_dir = root / ".agent-src.uncondensed" / "skills" / slug
    skills_dir.mkdir(parents=True, exist_ok=True)
    lines = [
        "---",
        f"name: {slug}",
        f'description: "{slug} senior skill for handoff testing."',
        "source: project",
    ]
    if tier:
        lines.append(f"tier: {tier}")
    lines += ["---", "", f"# {slug}", "", "## Procedure", "", "1. step", ""]
    if related_links is not None or composition_links is not None:
        lines += ["## Related Skills", "", "**WHEN to use this**"]
        if composition_links:
            for label, target in composition_links:
                lines.append(f"- delegates to [`{label}`]({target})")
        else:
            lines.append("- always")
        lines += ["", "**WHEN NOT to use this**"]
        for label, target in (related_links or []):
            lines.append(f"- prefer [`{label}`]({target})")
        lines.append("")
    path = skills_dir / "SKILL.md"
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def codes(violations) -> list[str]:
    return [v.code for v in violations]


def test_valid_w3_launch_chain(tmp_path: Path) -> None:
    """positioning → messaging-architecture → gtm-launch (no violations)."""
    skills = tmp_path / ".agent-src.uncondensed" / "skills"
    make_skill(tmp_path, "positioning", tier="senior", related_links=[])
    make_skill(tmp_path, "messaging-architecture", tier="senior",
               related_links=[("positioning", "../positioning/SKILL.md")])
    make_skill(tmp_path, "gtm-launch", tier="senior",
               related_links=[("messaging-architecture", "../messaging-architecture/SKILL.md")])
    assert lint(skills) == []


def test_valid_w4_forecasting_chain(tmp_path: Path) -> None:
    """forecast-accuracy → forecasting (no violations)."""
    skills = tmp_path / ".agent-src.uncondensed" / "skills"
    make_skill(tmp_path, "forecasting", tier="senior", related_links=[])
    make_skill(tmp_path, "forecast-accuracy", tier="senior",
               related_links=[("forecasting", "../forecasting/SKILL.md")])
    assert lint(skills) == []


def test_cycle_detected(tmp_path: Path) -> None:
    """Mutual WHEN-to-use links form a composition cycle → flagged."""
    skills = tmp_path / ".agent-src.uncondensed" / "skills"
    make_skill(tmp_path, "alpha", tier="senior",
               composition_links=[("beta", "../beta/SKILL.md")])
    make_skill(tmp_path, "beta", tier="senior",
               composition_links=[("alpha", "../alpha/SKILL.md")])
    violations = lint(skills)
    assert "handoff_cycle" in codes(violations)


def test_when_not_mutual_pointers_are_not_cycles(tmp_path: Path) -> None:
    """Phase 4.6: bidirectional ``WHEN NOT to use`` pointers (peer cognition
    alternatives like ``DCF ↔ unit-economics``) are intentional and MUST
    NOT be reported as composition cycles."""
    skills = tmp_path / ".agent-src.uncondensed" / "skills"
    make_skill(tmp_path, "alpha", tier="senior",
               related_links=[("beta", "../beta/SKILL.md")])
    make_skill(tmp_path, "beta", tier="senior",
               related_links=[("alpha", "../alpha/SKILL.md")])
    violations = lint(skills)
    assert "handoff_cycle" not in codes(violations)
    assert violations == []


def test_dangling_reference(tmp_path: Path) -> None:
    skills = tmp_path / ".agent-src.uncondensed" / "skills"
    make_skill(tmp_path, "alpha", tier="senior",
               related_links=[("ghost", "../ghost/SKILL.md")])
    violations = lint(skills)
    assert any(v.code == "handoff_dangling" for v in violations)


def test_tier_mismatch(tmp_path: Path) -> None:
    """Senior may not link to a non-senior peer."""
    skills = tmp_path / ".agent-src.uncondensed" / "skills"
    make_skill(tmp_path, "alpha", tier="senior",
               related_links=[("legacy", "../legacy/SKILL.md")])
    make_skill(tmp_path, "legacy", tier=None, related_links=[])
    violations = lint(skills)
    assert any(v.code == "handoff_tier_mismatch" for v in violations)


def test_valid_cross_wing_chain(tmp_path: Path) -> None:
    """build-buy-partner (W4) → org-design (W4); plus W4 → W3 forecast handoff."""
    skills = tmp_path / ".agent-src.uncondensed" / "skills"
    make_skill(tmp_path, "build-buy-partner", tier="senior", related_links=[])
    make_skill(tmp_path, "org-design", tier="senior",
               related_links=[("build-buy-partner", "../build-buy-partner/SKILL.md")])
    make_skill(tmp_path, "forecasting", tier="senior", related_links=[])
    make_skill(tmp_path, "forecast-accuracy", tier="senior",
               related_links=[("forecasting", "../forecasting/SKILL.md")])
    assert lint(skills) == []


def test_non_senior_skills_ignored(tmp_path: Path) -> None:
    """Non-senior skills with bad links are not enforced (forward-only)."""
    skills = tmp_path / ".agent-src.uncondensed" / "skills"
    make_skill(tmp_path, "legacy", tier=None,
               related_links=[("ghost", "../ghost/SKILL.md")])
    assert lint(skills) == []


def test_mode_6_worktree_chain_accepted(tmp_path: Path) -> None:
    """Phase 6.4: mode-6 cross-wing chain (W4 strategy → org-design)
    via worktree handoff lints clean. Worktree boundary is an
    orchestration-layer concern; lint_handoffs accepts the chain
    shape identically to in-process handoffs."""
    skills = tmp_path / ".agent-src.uncondensed" / "skills"
    make_skill(tmp_path, "build-buy-partner", tier="senior", related_links=[])
    make_skill(tmp_path, "org-design", tier="senior",
               related_links=[("build-buy-partner", "../build-buy-partner/SKILL.md")])
    assert lint(skills) == []
