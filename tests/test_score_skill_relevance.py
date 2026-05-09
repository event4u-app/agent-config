"""Tests for Block D · D2 (score_skill_relevance)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from skill_tools.score_skill_relevance import _parse_frontmatter, _tokenize, rank  # noqa: E402


def _write_skill(skills_dir: Path, slug: str, fm: str) -> None:
    skill = skills_dir / slug / "SKILL.md"
    skill.parent.mkdir(parents=True, exist_ok=True)
    skill.write_text(f"---\n{fm}\n---\n\n# {slug}\n", encoding="utf-8")


def test_tokenize_drops_stopwords_and_short() -> None:
    out = _tokenize("Use this skill to fix a bug in the code")
    assert "fix" in out
    assert "bug" in out
    assert "the" not in out
    assert "to" not in out


def test_parse_frontmatter_handles_list(tmp_path: Path) -> None:
    f = tmp_path / "SKILL.md"
    f.write_text(
        "---\n"
        "name: demo\n"
        "description: \"hello\"\n"
        "personas:\n"
        "  - frontend-engineer\n"
        "  - qa\n"
        "---\nbody\n"
    )
    fm = _parse_frontmatter(f)
    assert fm["name"] == "demo"
    assert fm["description"] == "hello"
    assert fm["personas"] == ["frontend-engineer", "qa"]


def test_rank_keyword_overlap(tmp_path: Path) -> None:
    _write_skill(tmp_path, "livewire-architect",
                 'name: livewire-architect\n'
                 'description: "Use when shaping a livewire component reactive state"')
    _write_skill(tmp_path, "terraform",
                 'name: terraform\n'
                 'description: "Use when writing terraform AWS modules"')
    rows = rank("build a livewire component", tmp_path)
    assert rows[0][0] == "livewire-architect"
    assert rows[0][1] > 0


def test_rank_persona_match_bonus(tmp_path: Path) -> None:
    _write_skill(tmp_path, "form-handler",
                 'name: form-handler\n'
                 'description: "design a form"\n'
                 'personas:\n  - frontend-engineer')
    _write_skill(tmp_path, "no-persona",
                 'name: no-persona\n'
                 'description: "design a form"')
    rows = rank("frontend-engineer review this form", tmp_path)
    by = {n: s for n, s, _ in rows}
    assert by["form-handler"] > by["no-persona"]


def test_rank_filters_zero_scores(tmp_path: Path) -> None:
    _write_skill(tmp_path, "irrelevant",
                 'name: irrelevant\n'
                 'description: "totally unrelated content"')
    rows = rank("python debugging asyncio", tmp_path)
    assert all(score > 0 for _, score, _ in rows)


def test_rank_descending_with_name_tiebreak(tmp_path: Path) -> None:
    _write_skill(tmp_path, "alpha",
                 'name: alpha\n'
                 'description: "fix bug fast"')
    _write_skill(tmp_path, "beta",
                 'name: beta\n'
                 'description: "fix bug fast"')
    rows = rank("fix bug fast", tmp_path)
    assert rows[0][1] == rows[1][1]
    assert rows[0][0] == "alpha"  # name tiebreak


def test_score_capped_at_100(tmp_path: Path) -> None:
    _write_skill(tmp_path, "match-all",
                 'name: livewire dashboard reactive state\n'
                 'description: "livewire dashboard reactive state"\n'
                 'personas:\n  - frontend-engineer')
    rows = rank("livewire dashboard reactive state frontend-engineer", tmp_path)
    assert rows[0][1] <= 100


def test_empty_skills_dir(tmp_path: Path) -> None:
    rows = rank("anything", tmp_path)
    assert rows == []


def test_empty_task_returns_empty(tmp_path: Path) -> None:
    _write_skill(tmp_path, "demo", 'name: demo\ndescription: "anything"')
    rows = rank("", tmp_path)
    assert rows == []
