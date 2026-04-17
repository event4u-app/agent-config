#!/usr/bin/env python3
"""
Skill Lifecycle — versioning, deprecation, and health scoring.

Responsibilities:
- Track skill lifecycle state (active, deprecated, superseded)
- Detect deprecated skills in use
- Suggest migrations for superseded skills
- Compute health scores based on linter + feedback data
- Generate lifecycle reports

Usage:
    python3 scripts/skill_lifecycle.py [--root ROOT] [--format text|json]
    python3 scripts/skill_lifecycle.py --health [--root ROOT]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))
from skill_linter import (
    FRONTMATTER_PATTERN,
    NAME_PATTERN,
    DESCRIPTION_PATTERN,
    STATUS_PATTERN,
    REPLACED_BY_PATTERN,
    extract_frontmatter,
    extract_frontmatter_field,
)


@dataclass
class SkillLifecycle:
    """Lifecycle metadata for a skill."""
    name: str
    path: str
    status: str  # active, deprecated, superseded
    replaced_by: Optional[str]
    has_execution: bool
    linter_issues: int
    health_score: float  # 0.0 to 100.0

    @property
    def is_active(self) -> bool:
        return self.status == "active"

    @property
    def needs_migration(self) -> bool:
        return self.status in ("deprecated", "superseded")


@dataclass
class MigrationSuggestion:
    """Suggestion to migrate from a deprecated/superseded skill."""
    from_skill: str
    to_skill: Optional[str]
    reason: str
    priority: str  # "high" (superseded), "medium" (deprecated), "low" (optional)


@dataclass
class LifecycleReport:
    """Aggregated lifecycle report."""
    total_skills: int
    active: int
    deprecated: int
    superseded: int
    avg_health: float
    migrations: List[MigrationSuggestion]

    def to_dict(self) -> dict:
        return {
            "total": self.total_skills,
            "active": self.active,
            "deprecated": self.deprecated,
            "superseded": self.superseded,
            "avg_health": round(self.avg_health, 1),
            "migrations": [asdict(m) for m in self.migrations],
        }


def discover_skills(root: Path) -> List[Path]:
    """Find all SKILL.md files."""
    uncompressed = root / ".augment.uncompressed" / "skills"
    compressed = root / ".augment" / "skills"
    base = uncompressed if uncompressed.exists() else compressed
    if not base.exists():
        return []
    return sorted(f for f in base.rglob("SKILL.md") if not f.is_symlink())


def compute_health_score(status: str, has_execution: bool, linter_issues: int) -> float:
    """Compute a health score (0-100) for a skill."""
    score = 100.0

    # Status penalties
    if status == "deprecated":
        score -= 30.0
    elif status == "superseded":
        score -= 50.0

    # Linter issue penalties (5 points per issue, max 40)
    issue_penalty = min(linter_issues * 5.0, 40.0)
    score -= issue_penalty

    # Bonus for execution metadata
    if has_execution:
        score = min(score + 5.0, 100.0)

    return max(score, 0.0)


def parse_skill_lifecycle(path: Path) -> Optional[SkillLifecycle]:
    """Parse a skill file and return lifecycle metadata."""
    text = path.read_text(encoding="utf-8")
    frontmatter = extract_frontmatter(text)
    if frontmatter is None:
        return None

    name_match = NAME_PATTERN.search(frontmatter)
    name = name_match.group(1).strip() if name_match else path.parent.name
    status_match = STATUS_PATTERN.search(frontmatter)
    status = status_match.group(1).strip() if status_match else "active"
    replaced_by = extract_frontmatter_field(frontmatter, REPLACED_BY_PATTERN)
    has_execution = "execution:" in frontmatter

    # Count linter issues (lightweight — just check known patterns)
    linter_issues = 0
    if not NAME_PATTERN.search(frontmatter):
        linter_issues += 1
    if not DESCRIPTION_PATTERN.search(frontmatter):
        linter_issues += 1

    health = compute_health_score(status, has_execution, linter_issues)

    return SkillLifecycle(
        name=name,
        path=str(path),
        status=status,
        replaced_by=replaced_by,
        has_execution=has_execution,
        linter_issues=linter_issues,
        health_score=health,
    )


def build_lifecycle_data(root: Path) -> List[SkillLifecycle]:
    """Build lifecycle data for all skills."""
    paths = discover_skills(root)
    results: List[SkillLifecycle] = []
    for p in paths:
        lc = parse_skill_lifecycle(p)
        if lc:
            results.append(lc)
    return results




def suggest_migrations(skills: List[SkillLifecycle]) -> List[MigrationSuggestion]:
    """Suggest migrations for deprecated/superseded skills."""
    migrations: List[MigrationSuggestion] = []
    for s in skills:
        if s.status == "superseded":
            migrations.append(MigrationSuggestion(
                from_skill=s.name,
                to_skill=s.replaced_by,
                reason=f"Skill '{s.name}' is superseded" +
                       (f" by '{s.replaced_by}'" if s.replaced_by else ""),
                priority="high",
            ))
        elif s.status == "deprecated":
            migrations.append(MigrationSuggestion(
                from_skill=s.name,
                to_skill=s.replaced_by,
                reason=f"Skill '{s.name}' is deprecated" +
                       (f" — migrate to '{s.replaced_by}'" if s.replaced_by else ""),
                priority="medium",
            ))
    return migrations


def generate_report(root: Path) -> LifecycleReport:
    """Generate a full lifecycle report."""
    skills = build_lifecycle_data(root)
    active = sum(1 for s in skills if s.status == "active")
    deprecated = sum(1 for s in skills if s.status == "deprecated")
    superseded = sum(1 for s in skills if s.status == "superseded")
    avg_health = sum(s.health_score for s in skills) / len(skills) if skills else 0.0
    migrations = suggest_migrations(skills)

    return LifecycleReport(
        total_skills=len(skills),
        active=active,
        deprecated=deprecated,
        superseded=superseded,
        avg_health=avg_health,
        migrations=migrations,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Skill Lifecycle — versioning and health")
    parser.add_argument("--root", type=Path, default=Path("."), help="Repository root")
    parser.add_argument("--format", choices=["text", "json"], default="text")
    parser.add_argument("--health", action="store_true", help="Show health scores")
    args = parser.parse_args()

    if args.health:
        skills = build_lifecycle_data(args.root)
        if args.format == "json":
            print(json.dumps([asdict(s) for s in skills], indent=2))
        else:
            if not skills:
                print("No skills found.")
            else:
                print(f"{'Skill':<35} {'Status':<12} {'Health':>7} {'Exec':>5}")
                print("-" * 65)
                for s in sorted(skills, key=lambda x: x.health_score):
                    exec_mark = "✓" if s.has_execution else "-"
                    print(f"{s.name:<35} {s.status:<12} {s.health_score:>6.1f} {exec_mark:>5}")
        return 0

    report = generate_report(args.root)
    if args.format == "json":
        print(json.dumps(report.to_dict(), indent=2))
    else:
        print(f"Total skills: {report.total_skills}")
        print(f"Active: {report.active} | Deprecated: {report.deprecated} | Superseded: {report.superseded}")
        print(f"Average health: {report.avg_health:.1f}/100")
        if report.migrations:
            print(f"\nMigrations needed ({len(report.migrations)}):")
            for m in report.migrations:
                target = f" → {m.to_skill}" if m.to_skill else ""
                print(f"  [{m.priority}] {m.from_skill}{target}: {m.reason}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
