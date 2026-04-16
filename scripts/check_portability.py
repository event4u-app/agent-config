#!/usr/bin/env python3
"""
Portability checker for agent-config packages.

Scans .augment/ and .augment.uncompressed/ for project-specific references
that violate package portability (the package must work in ANY project).

Allowed: references to packages/libraries (laravel, pest, phpstan, etc.)
Forbidden: references to specific projects, repos, domains, teams, customers

Exit codes: 0 = clean, 1 = violations found, 3 = internal error
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
class Violation:
    file: str
    line: int
    match: str
    pattern_name: str
    severity: Severity
    context: str  # the full line for review


# ── Project-specific patterns (FORBIDDEN in package files) ──────────────
# Add project names, domains, repo slugs, team names, customer names here.
# These are checked case-insensitively.

PROJECT_NAMES = [
    r"\bgalawork\b",
    r"\bevent4u\b",
    r"\bgala-web\b",
    r"\bgala-api\b",
    r"\bgalawork-api\b",
    r"\bgalawork-web\b",
    r"\bgalawork-packages\b",
]

PROJECT_DOMAINS = [
    r"\bgalawork\.de\b",
    r"\bgalawork\.com\b",
    r"\bevent4u\.app\b",
    r"\bevent4u\.de\b",
    r"\blocal\.galawork\b",
]

PROJECT_REPOS = [
    r"event4u-app/",
    r"galawork/galawork",
    r"galawork-packages/",
]

PROJECT_PATHS = [
    # Specific project file references (not generic patterns)
    r"app/Services/\w{3,}Service",   # e.g. app/Services/CustomerService — specific class
    r"app/Models/\w{3,}",            # e.g. app/Models/Customer — specific model
]

# Database / infrastructure names
PROJECT_INFRA = [
    r"\bgalawork_\w+",              # e.g. galawork_api, galawork_testing
    r"\bevent4u_\w+",               # e.g. event4u_db
]

# Docker container / service names
PROJECT_CONTAINERS = [
    r"galawork-php",                # Docker container names
    r"galawork-nginx",
    r"galawork-redis",
    r"galawork-mariadb",
    r"galawork-horizon",
]

# Team / org specific identifiers
PROJECT_TEAM = [
    r"\b@galawork\b",              # GitHub org mention
    r"\b@event4u\b",
    r"event4u-app/",               # GitHub org slug
]

# ── Allowed patterns (NOT violations even if they match above) ──────────
# Generic Laravel/framework patterns that are NOT project-specific
ALLOWLIST = [
    r"\.agent-settings",           # config file reference
    r"agents/overrides/",          # override system
    r"app/Modules/",               # generic Laravel module pattern (used in commands/skills as template)
    r"`App\\",                     # namespace pattern explanation
    r"app/Http/Controllers/",      # generic Laravel path pattern
    r"app/Repositories/",          # generic pattern in skills/guidelines
    r"\.module-template",          # module template
    r"ModuleServiceProvider",      # generic module concept
    r"app/Services/MyService",     # example placeholder
    r"app/Models/\{",              # template placeholder like {Model}
    r"app/Services/\{",            # template placeholder like {Service}
    r"galawork/php-quality",       # Composer package name (allowed)
    r"quality-workflow",           # rule name context
]

# Directories to scan (only package files, not project-specific agents/)
SCAN_DIRS = [".augment", ".augment.uncompressed"]

# Skip these subdirectories (they ARE allowed to be project-specific)
SKIP_PATTERNS = [
    "agents/",           # project-specific by design
    ".agent-settings",   # project config
    "AGENTS.md",         # project entrypoint
]


def _compile_patterns() -> list[tuple[re.Pattern, str, Severity]]:
    patterns = []
    for p in PROJECT_NAMES:
        patterns.append((re.compile(p, re.IGNORECASE), "project-name", "error"))
    for p in PROJECT_DOMAINS:
        patterns.append((re.compile(p, re.IGNORECASE), "project-domain", "error"))
    for p in PROJECT_REPOS:
        patterns.append((re.compile(p), "project-repo", "error"))
    for p in PROJECT_PATHS:
        patterns.append((re.compile(p), "project-path", "warning"))
    for p in PROJECT_INFRA:
        patterns.append((re.compile(p, re.IGNORECASE), "project-infra", "error"))
    for p in PROJECT_CONTAINERS:
        patterns.append((re.compile(p, re.IGNORECASE), "project-container", "warning"))
    for p in PROJECT_TEAM:
        patterns.append((re.compile(p, re.IGNORECASE), "project-team", "error"))
    return patterns


def _compile_allowlist() -> list[re.Pattern]:
    return [re.compile(p) for p in ALLOWLIST]


def check_file(filepath: Path, patterns: list, allowlist: list) -> List[Violation]:
    violations: List[Violation] = []
    try:
        lines = filepath.read_text(encoding="utf-8").splitlines()
    except Exception:
        return violations

    in_code_block = False
    for i, line in enumerate(lines, 1):
        stripped = line.strip()

        # Skip YAML frontmatter
        if i <= 10 and stripped == "---":
            continue

        # Track code blocks
        if stripped.startswith("```"):
            in_code_block = not in_code_block
            continue
        if in_code_block:
            continue

        # Check allowlist first
        if any(a.search(line) for a in allowlist):
            continue

        for pattern, name, severity in patterns:
            for m in pattern.finditer(line):
                violations.append(Violation(
                    file=str(filepath), line=i, match=m.group(0),
                    pattern_name=name, severity=severity, context=stripped,
                ))

    return violations


def scan_all(root: Path) -> List[Violation]:
    patterns = _compile_patterns()
    allowlist = _compile_allowlist()
    violations: List[Violation] = []

    for scan_dir in SCAN_DIRS:
        d = root / scan_dir
        if not d.exists():
            continue
        for f in sorted(d.rglob("*.md")):
            violations.extend(check_file(f, patterns, allowlist))

    return violations



def format_text(violations: List[Violation]) -> str:
    if not violations:
        return "✅  No portability violations found."
    lines = [f"❌  Found {len(violations)} portability violation(s):\n"]
    for v in violations:
        icon = "🔴" if v.severity == "error" else "🟡"
        lines.append(f"  {icon} {v.file}:{v.line} — [{v.pattern_name}] `{v.match}`")
        lines.append(f"      {v.context}")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Check agent-config package portability")
    parser.add_argument("--format", choices=["text", "json"], default="text")
    parser.add_argument("--root", type=Path, default=Path("."), help="Repository root")
    args = parser.parse_args()

    try:
        violations = scan_all(args.root)
    except Exception as e:
        print(f"Internal error: {e}", file=sys.stderr)
        return 3

    if args.format == "json":
        print(json.dumps([asdict(v) for v in violations], indent=2))
    else:
        print(format_text(violations))

    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main())