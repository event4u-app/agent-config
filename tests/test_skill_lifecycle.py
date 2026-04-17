"""Tests for skill lifecycle management."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from skill_lifecycle import (
    MigrationSuggestion,
    SkillLifecycle,
    compute_health_score,
    build_lifecycle_data,
    suggest_migrations,
    generate_report,
)


def write_skill(tmp_path: Path, name: str, extra_frontmatter: str = "") -> Path:
    skill_dir = tmp_path / ".augment.uncompressed" / "skills" / name
    skill_dir.mkdir(parents=True, exist_ok=True)
    path = skill_dir / "SKILL.md"
    content = f"""---
name: {name}
description: "Test skill {name}"
source: project
{extra_frontmatter}---

# {name}

## When to use

* Testing lifecycle

## Procedure

1. Check state
2. Apply
3. Verify

## Output format

1. Result

## Gotchas

* Watch out

## Do NOT

* Do NOT skip verification
"""
    path.write_text(content, encoding="utf-8")
    return path


def test_health_score_active() -> None:
    score = compute_health_score("active", False, 0)
    assert score == 100.0


def test_health_score_deprecated() -> None:
    score = compute_health_score("deprecated", False, 0)
    assert score == 70.0


def test_health_score_superseded() -> None:
    score = compute_health_score("superseded", False, 0)
    assert score == 50.0


def test_health_score_with_issues() -> None:
    score = compute_health_score("active", False, 4)
    assert score == 80.0  # 100 - 20


def test_health_score_with_execution_bonus() -> None:
    score = compute_health_score("active", True, 0)
    assert score == 100.0  # capped at 100


def test_health_score_min_zero() -> None:
    score = compute_health_score("superseded", False, 10)
    assert score == 10.0  # 100 - 50 - 40 (capped) = 10


def test_build_lifecycle_active(tmp_path: Path) -> None:
    write_skill(tmp_path, "active-skill")
    data = build_lifecycle_data(tmp_path)
    assert len(data) == 1
    assert data[0].status == "active"
    assert data[0].is_active


def test_build_lifecycle_deprecated(tmp_path: Path) -> None:
    write_skill(tmp_path, "old-skill", "status: deprecated\nreplaced_by: new-skill\n")
    data = build_lifecycle_data(tmp_path)
    assert len(data) == 1
    assert data[0].status == "deprecated"
    assert data[0].replaced_by == "new-skill"
    assert data[0].needs_migration


def test_build_lifecycle_with_execution(tmp_path: Path) -> None:
    write_skill(tmp_path, "exec-skill", "execution:\n  type: assisted\n  handler: internal\n")
    data = build_lifecycle_data(tmp_path)
    assert len(data) == 1
    assert data[0].has_execution


def test_suggest_migrations_superseded() -> None:
    skills = [SkillLifecycle(
        name="old", path="/test", status="superseded",
        replaced_by="new", has_execution=False, linter_issues=0, health_score=50.0,
    )]
    migrations = suggest_migrations(skills)
    assert len(migrations) == 1
    assert migrations[0].priority == "high"
    assert migrations[0].to_skill == "new"


def test_suggest_migrations_deprecated() -> None:
    skills = [SkillLifecycle(
        name="legacy", path="/test", status="deprecated",
        replaced_by=None, has_execution=False, linter_issues=0, health_score=70.0,
    )]
    migrations = suggest_migrations(skills)
    assert len(migrations) == 1
    assert migrations[0].priority == "medium"


def test_suggest_migrations_active_none() -> None:
    skills = [SkillLifecycle(
        name="good", path="/test", status="active",
        replaced_by=None, has_execution=False, linter_issues=0, health_score=100.0,
    )]
    migrations = suggest_migrations(skills)
    assert len(migrations) == 0


def test_generate_report(tmp_path: Path) -> None:
    write_skill(tmp_path, "skill-a")
    write_skill(tmp_path, "skill-b", "status: deprecated\n")
    report = generate_report(tmp_path)
    assert report.total_skills == 2
    assert report.active == 1
    assert report.deprecated == 1
    assert report.avg_health > 0
    d = report.to_dict()
    assert "total" in d
    assert "migrations" in d
