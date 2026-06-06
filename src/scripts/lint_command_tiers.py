#!/usr/bin/env python3
"""Lint slash-command frontmatter for the `tier:` key.

Hard-fails CI if any command under .agent-src.uncondensed/commands/
lacks a `tier:` declaration or uses an unknown tier value. The valid
tier set is locked by docs/contracts/command-surface-tiers.md.

Hooked into `task ci` after `task lint-rule-tiers`.

Exit codes:
  0  every command declares a valid tier
  1  one or more commands missing or using an invalid tier
"""
from __future__ import annotations

import sys
from pathlib import Path

QUIET = "--quiet" in sys.argv

REPO = Path(__file__).resolve().parents[2]

# Commands live under every artefact root post-monorepo Phase 4.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib.agent_src import artefact_roots  # noqa: E402

# Post-ADR-051 the command sources live at src/domains/<pack>/**/command.md;
# legacy artefact-root commands/ dirs are kept for older checkouts. A root
# whose commands/ holds only evals (no .md) is not a command source.
COMMANDS_DIRS = [
    root / "commands" for root in artefact_roots()
    if (root / "commands").is_dir()
    and any(p.name != "AGENTS.md" for p in (root / "commands").rglob("*.md"))
]
DOMAINS_DIR = REPO / "src" / "domains"
# Consumer-facing projection — must also carry tier so .augment/commands/
# (which symlinks to .agent-src/commands/) renders the tier filter.
COMMANDS_DIR_CONDENSED = REPO / ".agent-src" / "commands"

VALID_TIERS = frozenset({"0", "1", "2"})


def parse_tier(text: str) -> str | None:
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---\n", 4)
    if end == -1:
        return None
    for line in text[4:end].splitlines():
        if ":" not in line:
            continue
        k, _, v = line.partition(":")
        if k.strip() == "tier":
            return v.strip().strip('"').strip("'")
    return None


def lint(commands_dir: Path, *, quiet: bool = False) -> int:
    """Lint a commands directory. Returns 0 on success, 1 on failure."""
    if not commands_dir.is_dir():
        print(
            f"lint_command_tiers: no commands dir at {commands_dir}",
            file=sys.stderr,
        )
        return 1

    files = sorted(commands_dir.rglob("*.md"))
    # Sub-AGENTS.md companions are not slash commands.
    commands = [p for p in files if p.name != "AGENTS.md"]

    if not commands:
        print(
            f"lint_command_tiers: no commands found under {commands_dir}",
            file=sys.stderr,
        )
        return 1

    missing: list[str] = []
    invalid: list[tuple[str, str]] = []

    for cmd in commands:
        rel = cmd.relative_to(commands_dir).as_posix()
        tier = parse_tier(cmd.read_text(encoding="utf-8"))
        if tier is None:
            missing.append(rel)
        elif tier not in VALID_TIERS:
            invalid.append((rel, tier))

    if missing or invalid:
        print(
            f"❌  lint_command_tiers: {len(missing)} missing, "
            f"{len(invalid)} invalid (of {len(commands)} commands)",
            file=sys.stderr,
        )
        for name in missing:
            print(f"    missing tier: {name}", file=sys.stderr)
        for name, tier in invalid:
            print(f"    invalid tier '{tier}': {name}", file=sys.stderr)
        print(
            f"    valid tiers: {sorted(VALID_TIERS)}",
            file=sys.stderr,
        )
        print(
            "    contract: docs/contracts/command-surface-tiers.md",
            file=sys.stderr,
        )
        return 1

    if not quiet:
        print(
            f"✅  lint_command_tiers: {len(commands)} commands, "
            f"all tier values valid"
        )
    return 0


def lint_domain_sources(*, quiet: bool = False) -> int:
    """Lint src/domains/**/command.md — the post-ADR-051 authoring tree."""
    commands = sorted(DOMAINS_DIR.rglob("command.md"))
    if not commands:
        print(
            f"lint_command_tiers: no command.md found under {DOMAINS_DIR}",
            file=sys.stderr,
        )
        return 1
    missing = [
        c.relative_to(REPO).as_posix() for c in commands
        if parse_tier(c.read_text(encoding="utf-8")) is None
    ]
    invalid = [
        (c.relative_to(REPO).as_posix(), t) for c in commands
        if (t := parse_tier(c.read_text(encoding="utf-8"))) is not None
        and t not in VALID_TIERS
    ]
    if missing or invalid:
        print(
            f"❌  lint_command_tiers: {len(missing)} missing, "
            f"{len(invalid)} invalid (of {len(commands)} domain commands)",
            file=sys.stderr,
        )
        for name in missing:
            print(f"    missing tier: {name}", file=sys.stderr)
        for name, tier in invalid:
            print(f"    invalid tier '{tier}': {name}", file=sys.stderr)
        return 1
    if not quiet:
        print(
            f"✅  lint_command_tiers: {len(commands)} domain commands, "
            f"all tier values valid"
        )
    return 0


def main() -> int:
    if not COMMANDS_DIRS and not DOMAINS_DIR.is_dir():
        print(
            "lint_command_tiers: no commands dir found under any artefact root",
            file=sys.stderr,
        )
        return 1
    rc = 0
    if DOMAINS_DIR.is_dir():
        rc |= lint_domain_sources(quiet=QUIET)
    for commands_dir in COMMANDS_DIRS:
        rc |= lint(commands_dir, quiet=QUIET)
    # The condensed projection is the consumer-facing tree (via the
    # .augment/commands → .agent-src/commands symlink). It must also
    # carry tier so the surface stays uniform.
    if COMMANDS_DIR_CONDENSED.is_dir():
        rc |= lint(COMMANDS_DIR_CONDENSED, quiet=QUIET)
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
