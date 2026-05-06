#!/usr/bin/env python3
"""CI guard for the `no-council-references` rule.

Council artefacts under `agents/council-{questions,responses,sessions}/`
are gitignored, local-only, and auto-pruned. A link to a specific
council file rots three ways: gitignored (not in cloned repo),
pruned after the retention window (gone even locally), and the
installed `.augment/` projection cannot follow a path that does not
exist in the consumer.

This linter scans durable artefacts for forbidden links to specific
council files. Directory mentions and placeholder paths
(`<timestamp>`, `<topic-slug>`) are allowed — they document the
output-path convention, not a live reference.

Forbidden hits in this codebase exist today (kernel-membership ADRs
cite real session JSONs as decision traces). Suppress them with an
inline pragma at the end of the line:

    `agents/council-sessions/...json` <!-- council-ref-allowed: <reason> -->

Exit codes:
  0 — no forbidden references.
  1 — at least one forbidden reference found.

Invocation (from project root):
  python3 scripts/check_council_references.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Iterable

ROOT = Path(".")

# A specific file inside a council dir: must end with .md or .json,
# must NOT contain `<` or `>` (placeholders), must NOT contain backticks
# or quotes (those are line delimiters, not path content).
PATTERN = re.compile(
    r"agents/council-(?:questions|responses|sessions)/"
    r"([^\s\"'<>)\]`]+\.(?:md|json))"
)

# Only these durable surfaces are scanned. Archive, analysis, and the
# council dirs themselves are excluded by design.
SCAN_ROOTS = (
    ".agent-src.uncompressed",
    "agents/roadmaps",
    "agents/contexts",
    "agents/docs",
    "docs/contracts",
    "docs/decisions",
    "docs/guidelines",
)
SCAN_EXTS = (".md", ".yml", ".yaml", ".json", ".py")

# Files (or directory prefixes) that legitimately document the output
# convention or are scratch / archived. Paths are POSIX-style, repo-relative.
ALLOWLIST_PREFIXES: tuple[str, ...] = (
    # Archived roadmaps — historical evidence trail.
    "agents/roadmaps/archive/",
    # Working comparison docs — forward-refs to planned artefacts (mirrors
    # the SKIP_DIRS contract in scripts/check_references.py).
    "agents/analysis/",
    # The rule itself documents forbidden vs. allowed forms.
    ".agent-src.uncompressed/rules/no-council-references.md",
    # ai-council skill documents the output-path schema.
    ".agent-src.uncompressed/skills/ai-council/",
    # Council commands document the output-path schema.
    ".agent-src.uncompressed/commands/council/",
    ".agent-src.uncompressed/commands/council.md",
)
# Top-level files that are also exempt (e.g. CHANGELOG with historical entries).
ALLOWLIST_FILES: frozenset[str] = frozenset({
    "CHANGELOG.md",
})

INLINE_PRAGMA = re.compile(r"<!--\s*council-ref-allowed:[^>]*-->")


def _is_allowlisted(rel: str) -> bool:
    if rel in ALLOWLIST_FILES:
        return True
    return any(rel.startswith(prefix) for prefix in ALLOWLIST_PREFIXES)


def _scan_file(path: Path) -> list[tuple[int, str]]:
    findings: list[tuple[int, str]] = []
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return findings
    for ln, line in enumerate(text.splitlines(), 1):
        if INLINE_PRAGMA.search(line):
            continue
        for m in PATTERN.finditer(line):
            findings.append((ln, m.group(0)))
    return findings


def _iter_files(roots: Iterable[str]) -> Iterable[Path]:
    for root in roots:
        base = ROOT / root
        if not base.exists():
            continue
        if base.is_file():
            yield base
            continue
        for path in sorted(base.rglob("*")):
            if path.is_file() and path.suffix in SCAN_EXTS:
                yield path


def main() -> int:
    violations: list[tuple[Path, int, str]] = []
    for path in _iter_files(SCAN_ROOTS):
        rel = path.as_posix()
        if _is_allowlisted(rel):
            continue
        for ln, ref in _scan_file(path):
            violations.append((path, ln, ref))

    if not violations:
        print("✅  No forbidden council references in durable artefacts.")
        return 0

    print(f"❌  {len(violations)} forbidden council reference(s):\n")
    for path, ln, ref in violations:
        print(f"  - {path.as_posix()}:{ln}: {ref}")
    print(
        "\nRule: .agent-src/rules/no-council-references.md\n"
        "Fix: inline the convergence summary (members + date) instead of\n"
        "linking the file. Append "
        "<!-- council-ref-allowed: <reason> --> on the same line to\n"
        "suppress when the reference is genuinely required (ADR / contract\n"
        "decision trace)."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
