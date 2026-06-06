#!/usr/bin/env python3
"""CI guard for the `agents/` top-level layout.

The `agents/` tree is the project boundary for memory, roadmaps,
runtime artefacts, settings, audits, and policies. Flat files at the
`agents/` root are restricted to a small, intentional whitelist —
everything else lives in a typed subdirectory (`runtime/`, `settings/`,
`audits/`, `roadmaps/`, `policies/`, `contexts/`, etc.).

Two layout tiers:

  MAINTAINER (this source repo, identified by ``.agent-src.uncondensed/``)
      Full `agents/` tree allowed — only the flat-file whitelist is
      enforced. Phase 4 of road-to-global-only-install keeps the
      maintainer surface unchanged.

  CONSUMER (any repo without ``.agent-src.uncondensed/``)
      Global-only target shape: `agents/overrides/` + the bridge
      marker `agents/.event4u-bridge.yml` are the **only** expected
      artefacts. Anything else surfaces as a WARNING with a pointer
      to ``agent-config settings migrate`` (exit code 0). Hard
      violations (unknown flat files at the root) still fail.

Exit codes:
  0 — layout is clean (warnings ok in consumer mode).
  1 — at least one UNKNOWN flat-file violation.

Invocation (from project root):
  python3 scripts/lint_agents_layout.py
  python3 scripts/lint_agents_layout.py --quiet
  python3 scripts/lint_agents_layout.py --strict   # warnings → errors
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
        # Empty-tree sentinel so agents/ survives a fresh checkout
        # before any runtime artefact lands.
        ".gitkeep",
        # Consumer bridge marker (Phase 4 of road-to-global-only-install).
        # Spec: docs/contracts/consumer-bridge.md (event4u-bridge/v1).
        ".event4u-bridge.yml",
        # Per-tool projection toggle — which generated trees
        # `task generate-tools` writes (`.claude/`, `.cursor/`,
        # `.clinerules/`, `.windsurfrules`). Lives at agents/ root
        # because both the package and the consumer generators read
        # it before any subdirectory is touched (ADR-028 § Root layout
        # toggle).
        ".agent-tools.yml",
        # Dual-role marker (ADR-053). Names, at the directory itself, that
        # this agents/ tree is BOTH the maintainer workspace AND a dogfooded
        # instance of the consumer convention. Intentionally a root-level
        # flat file — it marks the directory, so a typed subdirectory would
        # defeat its purpose. Spec: agents/.maintainer-workspace.md.
        ".maintainer-workspace.md",
    }
)

# Consumer-target layout: only these top-level entries are expected in
# the global-only world. Anything else is a WARNING in consumer mode.
CONSUMER_EXPECTED_ENTRIES: frozenset[str] = frozenset(
    {"overrides", ".event4u-bridge.yml", ".gitkeep"},
)

MIGRATE_HINT = (
    "Run `npx @event4u/agent-config migrate` to sweep legacy project-scope "
    "artefacts in one pass. The unified `migrate` command (see "
    "`docs/contracts/migrate-command.md`) leaves `agents/overrides/` + "
    "`agents/.event4u-bridge.yml` as the only consumer-side files; the "
    "wizard recreates fresh config on `agent-config setup`."
)


def is_source_repo(project_root: Path) -> bool:
    """True when running inside the agent-config source repo.

    The maintainer surface is identified by **any** of:
      - ``.agent-src.uncondensed/`` at the workspace root (legacy / single-pack layout),
      - ``packages/<pack>/.agent-src.uncondensed/`` (current monorepo layout — see ``AGENTS.md``),
      - ``dist/agent-src/`` at the workspace root (condensed authoring tree).

    Consumer repos ship none of these — they only carry the deployed
    `.augment/`, `.claude/`, etc. plus `agents/overrides/`.
    """
    if (project_root / ".agent-src.uncondensed").is_dir():
        return True
    if (project_root / "dist/agent-src").is_dir():
        return True
    packages = project_root / "packages"
    if packages.is_dir():
        for sub in packages.iterdir():
            if (sub / ".agent-src.uncondensed").is_dir():
                return True
    return False


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


def find_consumer_warnings(root: Path) -> list[str]:
    """Return WARNINGs for consumer repos that hold legacy artefacts.

    Consumer-target shape (Phase 4 of road-to-global-only-install):
    `agents/overrides/` + `agents/.event4u-bridge.yml` are the only
    expected entries. Anything else is a soft warning — the linter
    still exits 0, but the message points the user at the migration
    subcommand so the legacy directory can be reclaimed.
    """
    warnings: list[str] = []
    if not root.is_dir():
        return warnings

    for path in sorted(root.iterdir()):
        if path.name in CONSUMER_EXPECTED_ENTRIES:
            continue
        # Flat-file UNKNOWNs are already an error — don't double-count.
        if path.is_file() and path.name not in ALLOWED_FLAT_FILES:
            continue
        kind = "dir" if path.is_dir() else "file"
        warnings.append(f"{path} ({kind}): legacy artefact outside the consumer-target shape.")

    return warnings


def main() -> int:
    args = sys.argv[1:]
    strict = "--strict" in args
    quiet = "--quiet" in args

    project_root = Path.cwd()
    unknown = find_violations(AGENTS_ROOT)
    consumer_mode = not is_source_repo(project_root)
    warnings = find_consumer_warnings(AGENTS_ROOT) if consumer_mode else []

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

    if warnings:
        if not quiet:
            print("⚠️  agents/ consumer-shape warnings:\n")
            for w in warnings:
                print(f"  - {w}")
            print(f"\n{MIGRATE_HINT}")
        if strict:
            return 1

    if not unknown and not warnings and not quiet:
        print("✅  agents/ layout clean.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
