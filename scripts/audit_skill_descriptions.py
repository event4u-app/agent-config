#!/usr/bin/env python3
"""
Audit skill descriptions for triggering quality.

Flags descriptions that are:
  - too short (< 150 chars)
  - missing an explicit trigger verb prefix ("use when", "use if", "creates", ...)
  - containing hedge terms ("may help", "can be useful", "covers various", ...)

Context:
  `road-to-anthropic-alignment.md` Phase 2.2 — "pushy description" pattern from
  anthropics/skills/skills/skill-creator.

Usage:
  python3 scripts/audit_skill_descriptions.py               # human table
  python3 scripts/audit_skill_descriptions.py --json        # machine-readable
  python3 scripts/audit_skill_descriptions.py --root DIR    # audit another tree
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import List

DEFAULT_ROOT = Path(".agent-src.uncompressed/skills")
MIN_LENGTH = 150

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---", re.DOTALL)
DESCRIPTION_RE = re.compile(r'^description:\s*"?(.*?)"?\s*$', re.MULTILINE)

TRIGGER_PREFIX_RE = re.compile(
    r"^\s*("
    r"use\s+(when|if|for)\b|only\s+when\b|"
    r"creates?\b|reviews?\b|writes?\b|handles?\b|generates?\b|runs?\b|"
    r"builds?\b|fetches?\b|validates?\b|audits?\b|analyzes?\b|detects?\b|"
    r"plans?\b|deploys?\b|configures?\b|scaffolds?\b|fixes?\b|refactors?\b|"
    r"optimizes?\b|renders?\b|syncs?\b|explores?\b|installs?\b|updates?\b|"
    r"manages?\b|orchestrates?\b|prepares?\b|finds?\b|executes?\b|reads?\b|"
    r"checks?\b|tracks?\b"
    r")",
    re.IGNORECASE,
)

HEDGE_PHRASES = (
    "may help",
    "can be useful",
    "covers various",
    "might be",
    "generally",
    "as needed",
    "when appropriate",
)


@dataclass
class Finding:
    skill: str
    path: str
    description: str
    length: int
    flags: List[str] = field(default_factory=list)

    @property
    def score(self) -> int:
        # Higher score = worse. Used for sorting.
        penalty = 0
        if "no-trigger-prefix" in self.flags:
            penalty += 30
        if "too-short" in self.flags:
            penalty += 20
        if "very-short" in self.flags:
            penalty += 10
        penalty += sum(10 for f in self.flags if f.startswith("hedge:"))
        return penalty


def extract_description(text: str) -> str:
    m = FRONTMATTER_RE.search(text)
    if not m:
        return ""
    d = DESCRIPTION_RE.search(m.group(1))
    return d.group(1).strip() if d else ""


def audit_description(description: str) -> List[str]:
    flags: List[str] = []
    if not description:
        flags.append("missing")
        return flags
    length = len(description)
    if length < 80:
        flags.append("very-short")
    elif length < MIN_LENGTH:
        flags.append("too-short")
    if not TRIGGER_PREFIX_RE.match(description):
        flags.append("no-trigger-prefix")
    lowered = description.lower()
    for phrase in HEDGE_PHRASES:
        if phrase in lowered:
            flags.append(f"hedge:{phrase}")
    return flags


def collect_findings(root: Path) -> List[Finding]:
    findings: List[Finding] = []
    for skill_md in sorted(root.glob("*/SKILL.md")):
        text = skill_md.read_text(encoding="utf-8")
        description = extract_description(text)
        flags = audit_description(description)
        findings.append(
            Finding(
                skill=skill_md.parent.name,
                path=str(skill_md),
                description=description,
                length=len(description),
                flags=flags,
            )
        )
    return findings


def render_text(findings: List[Finding], worst_only: bool) -> str:
    flagged = [f for f in findings if f.flags]
    flagged.sort(key=lambda f: (-f.score, f.skill))
    lines = [f"Audited {len(findings)} skills, {len(flagged)} flagged.\n"]
    if not flagged:
        lines.append("✅  All descriptions look reasonable.")
        return "\n".join(lines)
    lines.append(f"{'SCORE':>5}  {'LEN':>4}  {'SKILL':<40}  FLAGS")
    lines.append("-" * 90)
    shown = flagged[:15] if worst_only else flagged
    for f in shown:
        lines.append(
            f"{f.score:>5}  {f.length:>4}  {f.skill:<40}  {', '.join(f.flags)}"
        )
    if worst_only and len(flagged) > 15:
        lines.append(f"\n... {len(flagged) - 15} more (use --full to show all)")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT)
    parser.add_argument("--json", action="store_true", help="emit JSON")
    parser.add_argument("--full", action="store_true", help="show all flagged, not just top 15")
    args = parser.parse_args()
    if not args.root.exists():
        print(f"error: {args.root} does not exist", file=sys.stderr)
        return 2
    findings = collect_findings(args.root)
    if args.json:
        print(json.dumps([asdict(f) for f in findings], indent=2))
    else:
        print(render_text(findings, worst_only=not args.full))
    return 0


if __name__ == "__main__":
    sys.exit(main())
