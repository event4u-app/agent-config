#!/usr/bin/env python3
"""No-roadmap-references checker.

Stable artifacts (rules, skills, commands, contexts, guidelines, AGENTS.md,
README, copilot-instructions) must NOT cite a specific roadmap file in
`agents/roadmaps/`. Roadmap files are transient — archived, skipped, or
deleted as work completes — and stable artifacts citing them rot.

Allowed: directory mentions (`agents/roadmaps/`, `agents/roadmaps/archive/`,
`agents/roadmaps/skipped/`). Forbidden: specific `*.md` files inside those
directories.

Contract: .agent-src.uncompressed/rules/no-roadmap-references.md

Exit codes: 0 = clean, 1 = violations, 3 = internal error.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Stable artefact trees — every `*.md` below MUST be free of roadmap-file
# citations. Directory mentions stay allowed (the regex below excludes them).
STABLE_TREES = (
    ".agent-src.uncompressed/rules",
    ".agent-src.uncompressed/skills",
    ".agent-src.uncompressed/commands",
    ".agent-src.uncompressed/contexts",
    ".agent-src.uncompressed/templates",
    ".agent-src.uncompressed/personas",
    "agents/contexts",
    "docs/guidelines",
    "docs/contracts",
)

# Stable single-file artefacts at well-known paths.
STABLE_FILES = (
    "AGENTS.md",
    "README.md",
    "copilot-instructions.md",
    "docs/architecture.md",
    "docs/customization.md",
    "docs/getting-started.md",
    "docs/catalog.md",
)

# Roadmap-file pattern: any `*.md` file under `agents/roadmaps/` at any
# depth (including `archive/`, `skipped/`, and nested topical subfolders
# like `agent-memory/`). Directory-only mentions (`agents/roadmaps/`
# with trailing slash, no filename) and placeholder mentions like
# `agents/roadmaps/<file>.md` (angle-bracket placeholder) do NOT match.
ROADMAP_FILE_RE = re.compile(
    r"agents/roadmaps/(?:[a-z0-9][a-z0-9_-]*/)*[a-z0-9][a-z0-9_-]*\.md",
    re.IGNORECASE,
)

# Files that may legitimately quote forbidden patterns inside backticks for
# documentation purposes — the rule itself, the companion CI script docs,
# and the contract doc that names the rule.
SELF_DOCUMENTING_ALLOWLIST = frozenset({
    ".agent-src.uncompressed/rules/no-roadmap-references.md",
    "docs/guidelines/agent-infra/no-roadmap-references.md",
})


@dataclass
class Violation:
    file: str
    line: int
    match: str


def _scan_file(path: Path, root: Path) -> list[Violation]:
    rel = str(path.relative_to(root))
    if rel in SELF_DOCUMENTING_ALLOWLIST:
        return []
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return []
    out: list[Violation] = []
    in_fence = False
    for n, line in enumerate(text.splitlines(), start=1):
        # Skip fenced code blocks — path listings inside ``` are functional
        # constants (command contracts, runtime checks), not link rot.
        stripped = line.lstrip()
        if stripped.startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        for m in ROADMAP_FILE_RE.finditer(line):
            out.append(Violation(file=rel, line=n, match=m.group(0)))
    return out


def _collect_targets(root: Path) -> list[Path]:
    targets: list[Path] = []
    for d in STABLE_TREES:
        base = root / d
        if not base.exists():
            continue
        targets.extend(sorted(base.rglob("*.md")))
    for f in STABLE_FILES:
        p = root / f
        if p.exists():
            targets.append(p)
    return targets


def scan(root: Path) -> list[Violation]:
    out: list[Violation] = []
    for path in _collect_targets(root):
        out.extend(_scan_file(path, root))
    return out


def format_text(violations: list[Violation]) -> str:
    if not violations:
        return "✅  No roadmap-file references in stable artifacts."
    lines = [f"❌  Found {len(violations)} roadmap reference(s) in stable artifacts:\n"]
    for v in violations:
        lines.append(f"  🔴 {v.file}:{v.line}  →  {v.match}")
    lines.append(
        "\nPromote the durable conclusion to agents/contexts/ and cite that "
        "instead. See .agent-src.uncompressed/rules/no-roadmap-references.md."
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--format", choices=["text", "json"], default="text")
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args()
    try:
        violations = scan(args.root)
    except Exception as e:    # pragma: no cover
        print(f"Internal error: {e}", file=sys.stderr)
        return 3
    if args.format == "json":
        print(json.dumps([asdict(v) for v in violations], indent=2))
    else:
        print(format_text(violations))
    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main())
