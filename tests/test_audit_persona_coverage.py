"""Tests for Block D · D3 (audit_persona_coverage)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src" / "scripts"))

from skill_tools.audit_persona_coverage import (  # noqa: E402
    _frontmatter_list,
    _frontmatter_value,
    audit,
)


def _persona(personas_dir: Path, slug: str, tier: str) -> None:
    f = personas_dir / f"{slug}.md"
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(
        "---\n"
        f"id: {slug}\n"
        f"tier: {tier}\n"
        '---\nbody\n',
        encoding="utf-8",
    )


def _skill(skills_dir: Path, slug: str, personas: list) -> None:
    persona_block = "\n".join(f"  - {p}" for p in personas)
    f = skills_dir / slug / "SKILL.md"
    f.parent.mkdir(parents=True, exist_ok=True)
    body = f"---\nname: {slug}\n"
    if personas:
        body += f"personas:\n{persona_block}\n"
    body += "---\n"
    f.write_text(body, encoding="utf-8")


def test_frontmatter_value_unquotes() -> None:
    assert _frontmatter_value("name: foo\n", "name") == "foo"
    assert _frontmatter_value('name: "bar baz"\n', "name") == "bar baz"
    assert _frontmatter_value("name: foo\n", "missing") is None


def test_frontmatter_list_collects_indented_items() -> None:
    block = "personas:\n  - alpha\n  - beta\n  - gamma\nname: x\n"
    assert _frontmatter_list(block, "personas") == ["alpha", "beta", "gamma"]


def test_specialist_under_cited_threshold(tmp_path: Path) -> None:
    skills, personas = tmp_path / "s", tmp_path / "p"
    _persona(personas, "qa", "specialist")
    _skill(skills, "a", ["qa"])
    _skill(skills, "b", ["qa"])  # 2 cites, < 3 threshold
    rows = audit(skills, personas)
    qa = next(r for r in rows if r["persona"] == "qa")
    assert qa["status"] == "under-cited"
    assert qa["citations"] == 2
    assert qa["threshold"] == 3


def test_specialist_meets_threshold(tmp_path: Path) -> None:
    skills, personas = tmp_path / "s", tmp_path / "p"
    _persona(personas, "qa", "specialist")
    for s in ("a", "b", "c"):
        _skill(skills, s, ["qa"])
    rows = audit(skills, personas)
    qa = next(r for r in rows if r["persona"] == "qa")
    assert qa["status"] == "ok"
    assert qa["citations"] == 3


def test_core_threshold_is_higher(tmp_path: Path) -> None:
    skills, personas = tmp_path / "s", tmp_path / "p"
    _persona(personas, "developer", "core")
    for s in ("a", "b", "c", "d"):  # 4 < 5 → still under
        _skill(skills, s, ["developer"])
    rows = audit(skills, personas)
    dev = next(r for r in rows if r["persona"] == "developer")
    assert dev["status"] == "under-cited"
    assert dev["threshold"] == 5
    assert dev["citations"] == 4


def test_core_meets_threshold(tmp_path: Path) -> None:
    skills, personas = tmp_path / "s", tmp_path / "p"
    _persona(personas, "developer", "core")
    for s in ("a", "b", "c", "d", "e"):
        _skill(skills, s, ["developer"])
    rows = audit(skills, personas)
    dev = next(r for r in rows if r["persona"] == "developer")
    assert dev["status"] == "ok"


def test_orphan_persona_surfaced(tmp_path: Path) -> None:
    skills, personas = tmp_path / "s", tmp_path / "p"
    _persona(personas, "qa", "specialist")
    _skill(skills, "a", ["typo-persona"])  # never declared
    rows = audit(skills, personas)
    statuses = {r["persona"]: r["status"] for r in rows}
    assert statuses["typo-persona"] == "orphan"


def test_persona_with_zero_citations_is_under_cited(tmp_path: Path) -> None:
    skills, personas = tmp_path / "s", tmp_path / "p"
    _persona(personas, "lonely", "specialist")
    skills.mkdir()
    rows = audit(skills, personas)
    lonely = next(r for r in rows if r["persona"] == "lonely")
    assert lonely["citations"] == 0
    assert lonely["status"] == "under-cited"


def test_missing_dirs_safe(tmp_path: Path) -> None:
    rows = audit(tmp_path / "nope-s", tmp_path / "nope-p")
    assert rows == []


def test_two_under_cited_eval_target(tmp_path: Path) -> None:
    """D3 eval: must identify ≥ 2 under-cited personas in real corpus."""
    skills, personas = tmp_path / "s", tmp_path / "p"
    _persona(personas, "alpha", "specialist")
    _persona(personas, "beta", "specialist")
    _persona(personas, "gamma", "core")
    _skill(skills, "x", ["gamma"])  # alpha+beta = 0, gamma = 1
    rows = audit(skills, personas)
    flagged = [r for r in rows if r["status"] == "under-cited"]
    assert len(flagged) >= 2
