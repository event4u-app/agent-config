#!/usr/bin/env python3
"""
Cross-reference checker for agent-config repositories.

Scans .md files in .agent-src/ and agents/ for internal references
(file paths, skill names, rule names) and reports broken ones.

Exit codes: 0 = clean, 1 = broken refs found, 3 = internal error
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Literal

Severity = Literal["error", "warning"]


@dataclass
class BrokenRef:
    file: str
    line: int
    ref: str
    ref_type: str
    severity: Severity
    suggestion: str = ""


SCAN_DIRS = [".agent-src", "agents"]
SKIP_DIRS = ["agents/roadmaps/archive"]  # archived roadmaps have historical refs
ROOT = Path(".")

# File path references like `guidelines/agent-infra/size-and-scope.md`
PATH_PATTERN = re.compile(
    r'[`"\s]'
    r'(\.?(?:augment|agents|guidelines|rules|skills|commands|contexts|templates|patterns)'
    r'(?:/[\w._-]+)+\.(?:md|php|py|yml|yaml|json|sh))'
    r'[`"\s,;)\]]'
)

SKILL_REF_PATTERN = re.compile(r'`([\w-]+)`\s+skill')
RULE_REF_PATTERN = re.compile(r'`([\w-]+)`\s+rule')
_SKIP_NAMES = {"the", "a", "an", "this", "that", "your", "my", "no", "any", "each", "one",
               "always", "auto", "fail", "vue", "guidelines", "naming",
               "orderBy", "no-commit", "skill-linter", "skill-validator",
               "skill-refactor", "skill-caveman-compression", "skill-decompression",
               "broad_scope", "composer"}

# Paths that are clearly example/template placeholders (not real references)
EXAMPLE_PATH_PATTERNS = [
    re.compile(r"agents/analysis/"),           # project-analyze output template
    re.compile(r"agents/roadmaps/template"),   # template reference
    re.compile(r"agents/overrides/"),           # override examples
    re.compile(r"commands/old-cmd"),            # example placeholder
    re.compile(r"agents/README"),               # README reference (may not exist in package)
    re.compile(r"agents/docs/"),               # project-specific docs (not in package)
    re.compile(r"agents/contexts/"),           # project-specific contexts (not in package)
    re.compile(r"agents/gates"),               # project-specific policy docs
    re.compile(r"agents/features/"),           # project-specific feature docs
    re.compile(r"agents/authentication"),       # project-specific auth docs
    re.compile(r"agents/roadmaps/agents-"),     # dynamically created roadmaps
    re.compile(r"agents/roadmaps/test-"),       # project-specific roadmaps
    re.compile(r"guidelines/php-"),             # flattened override naming convention
    re.compile(r"rules/no-commit"),            # example rule in commands
    re.compile(r"skills/[\w-]+\.md"),          # short skill refs in examples (not SKILL.md path)
    re.compile(r"skills/[\w-]+/SKILL\.md"),    # example skill paths in commands
    re.compile(r"\{"),                         # template placeholders like {module}
    re.compile(r"\.compression-hashes\.json"), # JSON file, not .md
]


def collect_artifacts(root: Path) -> dict[str, set[str]]:
    """Build lookup sets for skills, rules, commands, guidelines."""
    arts: dict[str, set[str]] = {"skills": set(), "rules": set(), "commands": set(), "guidelines": set()}
    augment = root / ".agent-src"
    if not augment.exists():
        return arts
    for d in (augment / "skills").iterdir() if (augment / "skills").exists() else []:
        if d.is_dir() and (d / "SKILL.md").exists():
            arts["skills"].add(d.name)
    for f in (augment / "rules").glob("*.md") if (augment / "rules").exists() else []:
        arts["rules"].add(f.stem)
    for f in (augment / "commands").glob("*.md") if (augment / "commands").exists() else []:
        arts["commands"].add(f.stem)
    gdir = augment / "guidelines"
    if gdir.exists():
        for f in gdir.rglob("*.md"):
            arts["guidelines"].add(str(f.relative_to(augment)))
    return arts


def _find_suggestion(path: str, root: Path) -> str:
    name = Path(path).name
    for d in [root / ".agent-src", root / ".agent-src.uncompressed", root / "agents"]:
        if d.exists():
            for f in d.rglob(name):
                return str(f.relative_to(root))
    return ""


def _closest_match(name: str, candidates: set[str]) -> str:
    for c in sorted(candidates):
        if name in c or c in name:
            return c
    return ""



def check_file(filepath: Path, artifacts: dict[str, set[str]], root: Path) -> List[BrokenRef]:
    """Check a single .md file for broken references."""
    broken: List[BrokenRef] = []
    try:
        text = filepath.read_text(encoding="utf-8")
    except Exception:
        return broken

    in_code_block = False
    for i, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if stripped.startswith("```"):
            in_code_block = not in_code_block
            continue
        if in_code_block:
            continue

        # File path references
        for m in PATH_PATTERN.finditer(line):
            raw_ref = m.group(1)

            # Skip known example/template paths
            if any(p.search(raw_ref) for p in EXAMPLE_PATH_PATTERNS):
                continue

            resolved = False
            # Try raw ref as-is from root (covers .agent-src/..., agents/..., etc.)
            if (root / raw_ref).exists():
                resolved = True
            else:
                # Strip leading ./ and try with prefixes
                ref = raw_ref.lstrip("./")
                for prefix in [root, root / ".agent-src", root / ".agent-src.uncompressed"]:
                    if (prefix / ref).exists():
                        resolved = True
                        break
            if not resolved:
                broken.append(BrokenRef(
                    file=str(filepath), line=i, ref=m.group(1),
                    ref_type="path", severity="error",
                    suggestion=_find_suggestion(raw_ref, root),
                ))

        # Skill name references
        for m in SKILL_REF_PATTERN.finditer(line):
            name = m.group(1)
            if name not in artifacts["skills"] and name not in _SKIP_NAMES:
                broken.append(BrokenRef(
                    file=str(filepath), line=i, ref=name,
                    ref_type="skill", severity="warning",
                    suggestion=_closest_match(name, artifacts["skills"]),
                ))

        # Rule name references
        for m in RULE_REF_PATTERN.finditer(line):
            name = m.group(1)
            if name not in artifacts["rules"] and name not in _SKIP_NAMES:
                broken.append(BrokenRef(
                    file=str(filepath), line=i, ref=name,
                    ref_type="rule", severity="warning",
                    suggestion=_closest_match(name, artifacts["rules"]),
                ))

    return broken


def scan_all(root: Path) -> List[BrokenRef]:
    artifacts = collect_artifacts(root)
    broken: List[BrokenRef] = []
    for scan_dir in SCAN_DIRS:
        d = root / scan_dir
        if not d.exists():
            continue
        for f in sorted(d.rglob("*.md")):
            # Skip archived directories
            if any(str(f).startswith(str(root / skip)) for skip in SKIP_DIRS):
                continue
            broken.extend(check_file(f, artifacts, root))
    return broken


def format_text(broken: List[BrokenRef]) -> str:
    if not broken:
        return "✅  No broken references found."
    lines = [f"❌  Found {len(broken)} broken reference(s):\n"]
    for b in broken:
        icon = "🔴" if b.severity == "error" else "🟡"
        line = f"  {icon} {b.file}:{b.line} — {b.ref_type} `{b.ref}`"
        if b.suggestion:
            line += f" → did you mean `{b.suggestion}`?"
        lines.append(line)
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Check for broken cross-references in agent config")
    parser.add_argument("--format", choices=["text", "json"], default="text")
    parser.add_argument("--root", type=Path, default=Path("."), help="Repository root")
    args = parser.parse_args()

    try:
        broken = scan_all(args.root)
    except Exception as e:
        print(f"Internal error: {e}", file=sys.stderr)
        return 3

    if args.format == "json":
        print(json.dumps([asdict(b) for b in broken], indent=2))
    else:
        print(format_text(broken))

    return 1 if broken else 0


if __name__ == "__main__":
    sys.exit(main())