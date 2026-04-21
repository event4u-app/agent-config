#!/usr/bin/env python3
"""
Measure presence of the eight Phase-3.1 judge patterns across all skills.

Produces the before/after baseline for
`agents/roadmaps/road-to-stronger-skills.md`. Zero side-effects: this is a
read-only reporter. No skill file is ever mutated.

Patterns (see road-to-stronger-skills.md for definitions):
  1. System-prompt opening (blockquote role frame under the top heading)
  2. Scope routing (`route to [sibling]` inside "Do NOT use when")
  3. Validation gate (`## Validation` appears before `## Output format`)
  4. Ordered output fields (numbered required-fields list)
  5. Severity legend (🔴/🟡/🟢 with concrete definitions)
  6. References section with at least one URL
  7. Runtime boundary disclaimer
  8. Anti-sycophancy rules in "Do NOT"

Usage:
  python3 scripts/measure_patterns.py            # human table, grouped by tier
  python3 scripts/measure_patterns.py --json     # machine-readable summary
  python3 scripts/measure_patterns.py --tier 1   # only Tier-1 skills
  python3 scripts/measure_patterns.py --diff-baseline <file.json>
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = ROOT / ".agent-src.uncompressed" / "skills"

# Tier assignments mirror agents/roadmaps/road-to-stronger-skills.md.
# "compliant" = already meets the target patterns (the four Phase-3.1 judges).
TIERS: dict[str, int | str] = {
    # Tier 1 — Verdict / Review / Gate (patterns 1-8)
    "adversarial-review": 1, "authz-review": 1, "code-review": 1,
    "design-review": 1, "performance-analysis": 1, "project-analyzer": 1,
    "readme-reviewer": 1, "receiving-code-review": 1,
    "requesting-code-review": 1, "security-audit": 1, "skill-reviewer": 1,
    "threat-modeling": 1, "validate-feature-fit": 1,
    "verify-before-complete": 1,
    # Tier 2 — Analysis / Investigation / Orchestration (patterns 1-4, +6)
    "agent-docs-writing": 2, "analysis-autonomous-mode": 2,
    "analysis-skill-router": 2, "blast-radius-analyzer": 2,
    "bug-analyzer": 2, "code-refactoring": 2, "data-flow-mapper": 2,
    "command-routing": 2, "copilot-agents-optimization": 2,
    "description-assist": 2, "developer-like-execution": 2,
    "feature-planning": 2, "learning-to-rule-or-skill": 2,
    "project-analysis-core": 2, "project-analysis-hypothesis-driven": 2,
    "project-analysis-laravel": 2, "project-analysis-nextjs": 2,
    "project-analysis-node-express": 2, "project-analysis-react": 2,
    "project-analysis-symfony": 2, "project-analysis-zend-laminas": 2,
    "sequential-thinking": 2, "skill-improvement-pipeline": 2,
    "subagent-orchestration": 2, "systematic-debugging": 2,
    "universal-project-analysis": 2,
    # Tier 3 — Coding / Authoring / Doing (patterns 1+2)
    "api-design": 3, "api-endpoint": 3, "api-testing": 3,
    "artisan-commands": 3, "blade-ui": 3, "command-writing": 3,
    "composer-packages": 3, "context-document": 3,
    "conventional-commits-writing": 3, "dashboard-design": 3,
    "dependency-upgrade": 3, "dto-creator": 3, "eloquent": 3,
    "fe-design": 3, "finishing-a-development-branch": 3, "flux": 3,
    "git-workflow": 3, "guideline-writing": 3, "jobs-events": 3,
    "laravel": 3, "laravel-horizon": 3, "laravel-mail": 3,
    "laravel-middleware": 3, "laravel-notifications": 3,
    "laravel-pennant": 3, "laravel-pulse": 3, "laravel-reverb": 3,
    "laravel-scheduling": 3, "laravel-validation": 3, "livewire": 3,
    "logging-monitoring": 3, "merge-conflicts": 3, "migration-creator": 3,
    "module-management": 3, "openapi": 3, "override-management": 3,
    "pest-testing": 3, "php-coder": 3, "php-debugging": 3,
    "php-service": 3, "playwright-testing": 3, "readme-writing": 3,
    "readme-writing-package": 3, "roadmap-management": 3, "rule-writing": 3,
    "skill-management": 3, "skill-writing": 3, "sql-writing": 3,
    "technical-specification": 3, "test-driven-development": 3,
    "test-performance": 3, "upstream-contribute": 3,
    "using-git-worktrees": 3,
    # Tier 4 — Reference / Tooling / Integration (pattern 2 where siblings)
    "aws-infrastructure": 4, "check-refs": 4, "copilot-config": 4,
    "database": 4, "devcontainer": 4, "docker": 4, "file-editor": 4,
    "github-ci": 4, "grafana": 4, "jira-integration": 4, "lint-skills": 4,
    "mcp": 4, "multi-tenancy": 4, "performance": 4, "project-docs": 4,
    "quality-tools": 4, "rtk-output-filtering": 4, "security": 4,
    "sentry-integration": 4, "terraform": 4, "terragrunt": 4,
    "traefik": 4, "websocket": 4,
    # Already compliant (the four Phase-3.1 judges)
    "judge-bug-hunter": "compliant", "judge-code-quality": "compliant",
    "judge-security-auditor": "compliant",
    "judge-test-coverage": "compliant",
}

# Which patterns count as "required" per tier. Skipped patterns are still
# reported (so we can see the footprint) but do not affect compliance score.
TIER_TARGETS: dict[int | str, set[int]] = {
    1: {1, 2, 3, 4, 5, 6, 7, 8},
    2: {1, 2, 3, 4},  # pattern 6 optional, measured separately
    3: {1, 2},
    4: {2},
    "compliant": set(),  # reference baseline — already green
}


@dataclass
class Detection:
    skill: str
    tier: int | str
    patterns: dict[int, bool] = field(default_factory=dict)
    score: float = 0.0
    required: int = 0
    present: int = 0


def _section_indices(text: str) -> dict[str, tuple[int, int]]:
    """Return {section_title: (start_char, end_char)} for each ## heading."""
    headings = [(m.start(), m.group(1).strip())
                for m in re.finditer(r"^##\s+(.+?)\s*$", text, re.MULTILINE)]
    sections: dict[str, tuple[int, int]] = {}
    for i, (start, title) in enumerate(headings):
        end = headings[i + 1][0] if i + 1 < len(headings) else len(text)
        sections[title] = (start, end)
    return sections



def _body_after_top_heading(text: str) -> str:
    """Return the slice between the first `# ` heading and the first `## `."""
    m = re.search(r"^#\s+.+$", text, re.MULTILINE)
    if not m:
        return ""
    after = text[m.end():]
    m2 = re.search(r"^##\s+", after, re.MULTILINE)
    return after[:m2.start()] if m2 else after


def detect_pattern_1(text: str) -> bool:
    """System-prompt opening: blockquote role frame under the top heading."""
    body = _body_after_top_heading(text)
    for line in body.splitlines():
        s = line.strip()
        if not s:
            continue
        if s.startswith(">"):
            quote = s.lstrip("> ").strip()
            return bool(re.match(r"You are (a|an|the)\s", quote))
        return False
    return False


def detect_pattern_2(text: str, sections: dict[str, tuple[int, int]]) -> bool:
    """Scope routing with an explicit sibling link in the When/Do-NOT area."""
    candidates = [t for t in sections
                  if re.match(r"(when to use|do\s*not\s*use\s*when)", t, re.I)]
    chunk = text if not candidates else \
        text[sections[candidates[0]][0]:sections[candidates[0]][1]]
    return bool(re.search(
        r"route to\s*\[`?[a-z0-9-]+`?\]\([^)]*SKILL\.md\)", chunk, re.I))


def detect_pattern_3(text: str, sections: dict[str, tuple[int, int]]) -> bool:
    """Validation gate appears as its own section before Output format."""
    val_start = next((s for t, (s, _) in sections.items()
                      if t.lower().startswith("validation")), None)
    out_start = next((s for t, (s, _) in sections.items()
                      if t.lower().startswith("output")), None)
    if val_start is None or out_start is None or val_start >= out_start:
        return False
    for title, (start, end) in sections.items():
        if title.lower().startswith("validation"):
            body = text[start:end]
            if re.search(r"before finalizing", body, re.I):
                return True
            if len(re.findall(r"^\s*\d+\.\s+", body, re.MULTILINE)) >= 3:
                return True
    return False


def detect_pattern_4(text: str, sections: dict[str, tuple[int, int]]) -> bool:
    """Ordered output fields — explicit required-fields list."""
    for title, (start, end) in sections.items():
        if title.lower().startswith("output"):
            if re.search(r"required fields\s*\(ordered\)", text[start:end], re.I):
                return True
    return False


def detect_pattern_5(text: str) -> bool:
    """Severity legend: all three of 🔴 🟡 🟢 with concrete definitions."""
    return bool(re.search(
        r"🔴[^🔴🟡🟢]{3,}🟡[^🔴🟡🟢]{3,}🟢[^🔴🟡🟢]{3,}", text))


def detect_pattern_6(text: str, sections: dict[str, tuple[int, int]]) -> bool:
    """References section present and contains at least one URL."""
    for title, (start, end) in sections.items():
        if title.lower() == "references":
            return bool(re.search(r"https?://", text[start:end]))
    return False


def detect_pattern_7(text: str) -> bool:
    """Runtime boundary disclaimer — names what the skill does NOT execute."""
    patterns = [
        r"runtime confirmation.*(follow[- ]up|implementer)",
        r"(the judge|this skill) does not execute",
        r"(leaves|defers) runtime.*(to|for) the implementer",
        r"is a follow[- ]up for the implementer",
    ]
    return any(re.search(p, text, re.I) for p in patterns)


def detect_pattern_8(text: str, sections: dict[str, tuple[int, int]]) -> bool:
    """Anti-sycophancy rules in Do NOT section."""
    body = "".join(text[s:e] + "\n" for t, (s, e) in sections.items()
                   if t.lower().startswith("do not"))
    if not body:
        return False
    patterns = [
        r"NEVER\s+return\s+`?\w+`?\s+out of politeness",
        r"NEVER\s+silently\s+fall\s+back",
        r"NEVER\s+rubber[- ]stamp",
        r"NEVER\s+accept.*as (a )?substitute",
    ]
    return any(re.search(p, body, re.I) for p in patterns)


DETECTORS = {
    1: detect_pattern_1, 2: detect_pattern_2, 3: detect_pattern_3,
    4: detect_pattern_4, 5: detect_pattern_5, 6: detect_pattern_6,
    7: detect_pattern_7, 8: detect_pattern_8,
}



def scan_skill(path: Path) -> Detection:
    name = path.parent.name
    tier = TIERS.get(name, "unclassified")
    text = path.read_text(encoding="utf-8")
    sections = _section_indices(text)
    results: dict[int, bool] = {}
    for n, fn in DETECTORS.items():
        try:
            results[n] = (fn(text, sections)
                          if fn.__code__.co_argcount == 2 else fn(text))
        except Exception:
            results[n] = False
    required = TIER_TARGETS.get(tier, set())
    present = sum(1 for p in required if results.get(p))
    score = (present / len(required)) if required else 1.0
    return Detection(
        skill=name, tier=tier, patterns=results,
        score=round(score, 3), required=len(required), present=present,
    )


def collect(root: Path) -> list[Detection]:
    results: list[Detection] = []
    for skill_md in sorted(root.glob("*/SKILL.md")):
        results.append(scan_skill(skill_md))
    return results


def _render_table(rows: Iterable[Detection], tier_filter: int | None) -> str:
    lines = []
    tiers_order: list[int | str] = [1, 2, 3, 4, "compliant", "unclassified"]
    by_tier: dict[int | str, list[Detection]] = {t: [] for t in tiers_order}
    for r in rows:
        by_tier.setdefault(r.tier, []).append(r)
    for tier in tiers_order:
        group = by_tier.get(tier, [])
        if not group:
            continue
        if tier_filter is not None and tier != tier_filter:
            continue
        label = f"Tier {tier}" if isinstance(tier, int) else f"{tier}"
        required = TIER_TARGETS.get(tier, set())
        lines.append(f"\n## {label}  ({len(group)} skills, "
                     f"required patterns: {sorted(required) or '—'})")
        lines.append("| Skill | Score | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |")
        lines.append("|---|---:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|")
        for r in sorted(group, key=lambda d: (-d.score, d.skill)):
            cells = []
            for p in range(1, 9):
                has = r.patterns.get(p, False)
                is_req = p in required
                cells.append(
                    "✅" if has and is_req else
                    "☑️" if has else
                    "·" if not is_req else "❌"
                )
            pct = f"{int(r.score * 100)}%" if required else "—"
            lines.append(f"| `{r.skill}` | {pct} | " + " | ".join(cells) + " |")
    lines.append("\nLegend: ✅ required + present · ❌ required + missing · "
                 "☑️ present but optional · · not required")
    return "\n".join(lines)


def _summary(rows: list[Detection]) -> dict:
    agg: dict = {"total_skills": len(rows), "by_tier": {}}
    for tier in [1, 2, 3, 4]:
        group = [r for r in rows if r.tier == tier]
        if not group:
            continue
        fully = sum(1 for r in group if r.score >= 1.0)
        avg = round(sum(r.score for r in group) / len(group), 3)
        agg["by_tier"][str(tier)] = {
            "count": len(group),
            "fully_compliant": fully,
            "avg_score": avg,
            "required_patterns": sorted(TIER_TARGETS[tier]),
        }
    return agg


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--json", action="store_true",
                    help="emit machine-readable JSON")
    ap.add_argument("--tier", type=int, choices=[1, 2, 3, 4],
                    help="only report one tier")
    ap.add_argument("--diff-baseline", type=Path,
                    help="JSON file from an earlier run to diff against")
    args = ap.parse_args(argv)

    if not SKILLS_DIR.is_dir():
        print(f"ERROR: {SKILLS_DIR} not found", file=sys.stderr)
        return 3

    rows = collect(SKILLS_DIR)

    if args.json:
        payload = {
            "summary": _summary(rows),
            "skills": [asdict(r) for r in rows],
        }
        print(json.dumps(payload, indent=2, sort_keys=True))
        return 0

    summary = _summary(rows)
    print(f"# Pattern Presence — {summary['total_skills']} skills scanned\n")
    print("## Per-tier summary\n")
    print("| Tier | Skills | Fully compliant | Avg score | Required |")
    print("|---|---:|---:|---:|---|")
    for t in [1, 2, 3, 4]:
        info = summary["by_tier"].get(str(t))
        if not info:
            continue
        print(f"| {t} | {info['count']} | {info['fully_compliant']} | "
              f"{int(info['avg_score'] * 100)}% | "
              f"{info['required_patterns']} |")

    print(_render_table(rows, args.tier))

    if args.diff_baseline and args.diff_baseline.is_file():
        prev = json.loads(args.diff_baseline.read_text())
        prev_by = {s["skill"]: s for s in prev.get("skills", [])}
        moves = []
        for r in rows:
            p = prev_by.get(r.skill)
            if p and p["score"] != r.score:
                moves.append((r.skill, p["score"], r.score))
        if moves:
            print("\n## Changes since baseline\n")
            for skill, old, new in sorted(moves, key=lambda m: m[2] - m[1]):
                arrow = "⬆️" if new > old else "⬇️"
                print(f"- {arrow} `{skill}`: "
                      f"{int(old * 100)}% → {int(new * 100)}%")
    return 0


if __name__ == "__main__":
    sys.exit(main())
