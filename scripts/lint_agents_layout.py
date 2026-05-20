#!/usr/bin/env python3
"""CI guard for the `agents/` top-level layout.

The `agents/` tree is the project boundary for memory, roadmaps,
runtime artefacts, settings, audits, and policies. Flat files at the
`agents/` root are restricted to a small, intentional whitelist —
everything else lives in a typed subdirectory (`runtime/`, `settings/`,
`audits/`, `roadmaps/`, `policies/`, `contexts/`, etc.).

Categories:

  ALLOWED  — Whitelisted flat files. Linter is silent.
  LEGACY   — Files scheduled for migration but not yet moved (e.g.
             `.agent-chat-history` is part of a published MCP tool
             contract). Linter prints a warning to stderr; exit 0 in
             normal mode, exit 1 in --strict mode.
  UNKNOWN  — Anything else. Linter fails.

Exit codes:
  0 — layout is clean (ALLOWED only, or LEGACY only in non-strict).
  1 — at least one UNKNOWN file, or any LEGACY file in --strict mode.

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
# either LEGACY (scheduled for migration, see below) or UNKNOWN
# (linter failure).
ALLOWED_FLAT_FILES: frozenset[str] = frozenset(
    {
        # Entry document — narrative pointer to the agents/ tree.
        "index.md",
        # D1 anchor / progress dashboard — kept at root by the
        # roadmap-progress-sync rule so consumers see it first.
        "roadmaps-progress.md",
        # Canonical learning corpus (low-impact decisions). The .md
        # and its .lock.yaml are co-located by design.
        "low-impact-decisions.md",
        "low-impact-decisions.lock.yaml",
        # Worked example for the ai-video pipeline. Stays adjacent to
        # the agents/ai-video/ dir as a reference template.
        ".ai-video.xml.example",
        # Empty-tree sentinel so agents/ survives a fresh checkout
        # before any runtime artefact lands.
        ".gitkeep",
    }
)

# Files awaiting a follow-up migration. Each entry SHOULD link to the
# rationale (PR / roadmap step) and a target location. The linter
# warns in normal mode, fails in --strict mode.
LEGACY_FLAT_FILES: dict[str, str] = {
    # Published MCP tool contract — see scripts/mcp_server/consumer_tool_catalog.json
    # and tests/test_mcp_server.py. Path change requires a v2 tool
    # description or allowlist expansion. Scheduled for the contract
    # bundle (paired with agents/state/).
    ".agent-chat-history": "agents/runtime/.agent-chat-history (deferred — MCP tool contract)",
    ".agent-chat-history.bak": "agents/runtime/.agent-chat-history.bak (deferred — MCP tool contract)",
    # Runtime metrics — append-only JSONL written by budget-tracking
    # scripts. Target: agents/runtime/metrics/. Migration deferred to
    # avoid double-touching the budget history within the same series.
    ".augment-budget-history.jsonl": "agents/runtime/metrics/.augment-budget-history.jsonl",
    ".rule-budget-history.jsonl": "agents/runtime/metrics/.rule-budget-history.jsonl",
}


def find_violations(root: Path) -> tuple[list[str], list[str]]:
    """Return (unknown, legacy) flat-file violations."""
    unknown: list[str] = []
    legacy: list[str] = []
    if not root.is_dir():
        return unknown, legacy

    for path in sorted(root.iterdir()):
        if not path.is_file():
            continue
        name = path.name
        if name in ALLOWED_FLAT_FILES:
            continue
        if name in LEGACY_FLAT_FILES:
            legacy.append(
                f"{path}: legacy flat file — target: {LEGACY_FLAT_FILES[name]}"
            )
            continue
        unknown.append(
            f"{path}: flat file not in agents/ whitelist — move to a typed "
            f"subdirectory (runtime/, settings/, audits/, roadmaps/, "
            f"policies/, contexts/, …) or add to ALLOWED_FLAT_FILES in "
            f"scripts/lint_agents_layout.py with rationale."
        )

    return unknown, legacy


def main() -> int:
    args = sys.argv[1:]
    strict = "--strict" in args
    quiet = "--quiet" in args

    unknown, legacy = find_violations(AGENTS_ROOT)

    if unknown:
        print("❌  agents/ layout violations (unknown flat files):\n")
        for f in unknown:
            print(f"  - {f}")

    if legacy:
        stream = sys.stdout if strict else sys.stderr
        header = "❌" if strict else "⚠️ "
        kind = "errors" if strict else "warnings"
        print(f"\n{header}  agents/ legacy flat files ({kind}):\n", file=stream)
        for f in legacy:
            print(f"  - {f}", file=stream)

    if unknown or (strict and legacy):
        print(
            "\nRule: scripts/lint_agents_layout.py — flat files at agents/ "
            "root must be whitelisted. Typed subdirectories: runtime/, "
            "settings/, audits/, roadmaps/, policies/, contexts/, … ."
        )
        return 1

    if not quiet:
        if legacy:
            print(f"✅  agents/ layout clean ({len(legacy)} legacy warning(s)).")
        else:
            print("✅  agents/ layout clean.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
