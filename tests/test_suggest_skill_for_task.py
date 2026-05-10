"""Tests for Block D · D4 (suggest_skill_for_task)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from skill_tools.suggest_skill_for_task import _justify, suggest  # noqa: E402


def _persona(personas_dir: Path, slug: str, tier: str) -> None:
    f = personas_dir / f"{slug}.md"
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(f"---\nid: {slug}\ntier: {tier}\n---\n", encoding="utf-8")


def _skill(skills_dir: Path, slug: str, desc: str, personas: list) -> None:
    f = skills_dir / slug / "SKILL.md"
    f.parent.mkdir(parents=True, exist_ok=True)
    body = f'---\nname: {slug}\ndescription: "{desc}"\n'
    if personas:
        body += "personas:\n" + "\n".join(f"  - {p}" for p in personas) + "\n"
    body += "---\n"
    f.write_text(body, encoding="utf-8")


def test_justify_high_score_includes_persona_status() -> None:
    out = _justify("foo", 80, ["qa"], {"qa": "ok"})
    assert "high keyword" in out
    assert "qa (ok)" in out


def test_justify_medium_score_says_strong_overlap() -> None:
    out = _justify("foo", 50, [], {})
    assert "strong keyword" in out
    assert "no persona" in out


def test_justify_low_score_warns_reviewer() -> None:
    out = _justify("foo", 20, ["qa"], {"qa": "under-cited"})
    assert "confirm with reviewer" in out
    assert "qa (under-cited)" in out


def test_suggest_returns_at_most_top_n(tmp_path: Path) -> None:
    skills, personas = tmp_path / "s", tmp_path / "p"
    _persona(personas, "frontend-engineer", "specialist")
    for i, name in enumerate(["livewire-architect", "form-handler",
                              "fe-design", "ui-component-architect"]):
        _skill(skills, name, "livewire reactive component dashboard",
               ["frontend-engineer"])
    out = suggest("livewire reactive component dashboard",
                  skills, personas, top=3)
    assert len(out) == 3
    assert all("score" in c and "why" in c for c in out)


def test_suggest_orders_descending(tmp_path: Path) -> None:
    skills, personas = tmp_path / "s", tmp_path / "p"
    _persona(personas, "frontend-engineer", "specialist")
    _skill(skills, "exact-match",
           "livewire reactive dashboard component state",
           ["frontend-engineer"])
    _skill(skills, "partial-match", "livewire only", [])
    out = suggest("livewire reactive dashboard component state",
                  skills, personas, top=2)
    assert out[0]["score"] >= out[1]["score"]
    assert out[0]["skill"] == "exact-match"


def test_suggest_empty_when_no_matches(tmp_path: Path) -> None:
    skills, personas = tmp_path / "s", tmp_path / "p"
    skills.mkdir()
    personas.mkdir()
    out = suggest("totally-unrelated-task", skills, personas)
    assert out == []


def test_suggest_includes_persona_status_for_under_cited(tmp_path: Path) -> None:
    skills, personas = tmp_path / "s", tmp_path / "p"
    _persona(personas, "lonely", "specialist")
    _skill(skills, "match", "rare specific keyword foo", ["lonely"])
    out = suggest("rare specific keyword foo", skills, personas)
    assert "lonely (under-cited)" in out[0]["why"]


def test_eval_three_of_five_match_target(tmp_path: Path) -> None:
    """D4 eval: 5 blind tasks vs human picks, ≥ 3/5 should match.

    Synthetic corpus mirrors the eval structure; we verify the heuristic
    picks the right top-1 for ≥ 3 of 5 tasks.
    """
    skills, personas = tmp_path / "s", tmp_path / "p"
    _persona(personas, "frontend-engineer", "specialist")
    _persona(personas, "qa", "specialist")
    _skill(skills, "livewire-architect", "shape livewire components",
           ["frontend-engineer"])
    _skill(skills, "form-handler", "design forms validation submission",
           ["frontend-engineer"])
    _skill(skills, "playwright-architect", "shape playwright e2e tests",
           ["qa"])
    _skill(skills, "fe-design", "frontend design heuristics", [])
    _skill(skills, "tailwind-engineer", "write tailwind utility classes",
           ["frontend-engineer"])
    cases = [
        ("shape a livewire component", "livewire-architect"),
        ("validation submission for forms", "form-handler"),
        ("shape playwright e2e tests", "playwright-architect"),
        ("frontend design heuristics", "fe-design"),
        ("tailwind utility classes", "tailwind-engineer"),
    ]
    hits = 0
    for task, expected in cases:
        out = suggest(task, skills, personas, top=1)
        if out and out[0]["skill"] == expected:
            hits += 1
    assert hits >= 3
