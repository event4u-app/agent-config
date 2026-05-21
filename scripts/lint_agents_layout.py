#!/usr/bin/env python3
"""CI guard for the `agents/` top-level layout.

The `agents/` tree is the project boundary for memory, roadmaps,
runtime artefacts, settings, audits, and policies. Flat files at the
`agents/` root are restricted to a small, intentional whitelist —
everything else lives in a typed subdirectory (`runtime/`, `settings/`,
`audits/`, `roadmaps/`, `policies/`, `contexts/`, etc.).

Categories:

  ALLOWED  — Whitelisted flat files. Linter is silent.
  UNKNOWN  — Anything else. Linter fails.

Exit codes:
  0 — layout is clean.
  1 — at least one UNKNOWN file.

Invocation (from project root):
  python3 scripts/lint_agents_layout.py
  python3 scripts/lint_agents_layout.py --strict
  python3 scripts/lint_agents_layout.py --quiet
"""

from __future__ import annotations

import sys
from pathlib import Path

AGENTS_ROOT = Path("agents")

# Intentional flat files at agents/ root. Anything not in this set is
# UNKNOWN (linter failure). Durable records live under typed subdirs:
# decisions/ (low-impact corpus, ADR-style records), evidence/ (durable
# reports / metrics / council artefacts), runtime/ (volatile, gitignored).
ALLOWED_FLAT_FILES: frozenset[str] = frozenset(
    {
        # Entry document — narrative pointer to the agents/ tree.
        "index.md",
        # D1 anchor / progress dashboard — kept at root by the
        # roadmap-progress-sync rule so consumers see it first.
        "roadmaps-progress.md",
        # Worked example for the ai-video pipeline. Stays adjacent to
        # the agents/reference/ai-video/ dir as a reference template.
        ".ai-video.xml.example",
        # Empty-tree sentinel so agents/ survives a fresh checkout
        # before any runtime artefact lands.
        ".gitkeep",
    }
)


def find_violations(root: Path) -> list[str]:
    """Return UNKNOWN flat-file violations at the agents/ root."""
    unknown: list[str] = []
    if not root.is_dir():
        return unknown

    for path in sorted(root.iterdir()):
        if not path.is_file():
            continue
        name = path.name
        if name in ALLOWED_FLAT_FILES:
            continue
        unknown.append(
            f"{path}: flat file not in agents/ whitelist — move to a typed "
            f"subdirectory (runtime/, evidence/, decisions/, settings/, "
            f"audits/, roadmaps/, policies/, contexts/, …) or add to "
            f"ALLOWED_FLAT_FILES in scripts/lint_agents_layout.py with "
            f"rationale."
        )

    return unknown


def main() -> int:
    args = sys.argv[1:]
    # --strict kept for backward-compat; no longer affects exit code now
    # that the LEGACY tier is gone.
    _ = "--strict" in args
    quiet = "--quiet" in args

    unknown = find_violations(AGENTS_ROOT)

    if unknown:
        print("❌  agents/ layout violations (unknown flat files):\n")
        for f in unknown:
            print(f"  - {f}")
        print(
            "\nRule: scripts/lint_agents_layout.py — flat files at agents/ "
            "root must be whitelisted. Typed subdirectories: runtime/, "
            "evidence/, decisions/, settings/, audits/, roadmaps/, "
            "policies/, contexts/, … ."
        )
        return 1

    if not quiet:
        print("✅  agents/ layout clean.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
