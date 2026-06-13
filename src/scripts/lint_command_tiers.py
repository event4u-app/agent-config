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
# (which symlinks to dist/agent-src/commands/) renders the tier filter.
COMMANDS_DIR_CONDENSED = REPO / "dist/agent-src" / "commands"

VALID_TIERS = frozenset({"0", "1", "2"})
# ADR-090: `visibility:` is the named source of truth; `tier:` is the
# back-compat integer alias. Both are validated; when both are present they
# MUST agree per this mapping.
VALID_VISIBILITIES = frozenset({"visible", "advanced", "internal"})
TIER_TO_VISIBILITY = {"0": "visible", "1": "advanced", "2": "internal"}


def parse_field(text: str, key: str) -> str | None:
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---\n", 4)
    if end == -1:
        return None
    for line in text[4:end].splitlines():
        if ":" not in line:
            continue
        k, _, v = line.partition(":")
        if k.strip() == key:
            return v.strip().strip('"').strip("'")
    return None


def parse_tier(text: str) -> str | None:
    return parse_field(text, "tier")


def visibility_error(text: str) -> str | None:
    """Validate the visibility field (ADR-090). Returns an error string or None.

    Requires a present + valid visibility, and consistency with the tier alias
    whenever both are declared.
    """
    vis = parse_field(text, "visibility")
    if vis is None:
        return "missing visibility"
    if vis not in VALID_VISIBILITIES:
        return f"invalid visibility '{vis}'"
    tier = parse_field(text, "tier")
    if tier in TIER_TO_VISIBILITY and TIER_TO_VISIBILITY[tier] != vis:
        return f"visibility '{vis}' disagrees with tier '{tier}' (expected '{TIER_TO_VISIBILITY[tier]}')"
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
    vis_errors: list[tuple[str, str]] = []

    for cmd in commands:
        rel = cmd.relative_to(commands_dir).as_posix()
        text = cmd.read_text(encoding="utf-8")
        tier = parse_tier(text)
        if tier is None:
            missing.append(rel)
        elif tier not in VALID_TIERS:
            invalid.append((rel, tier))
        if (ve := visibility_error(text)) is not None:
            vis_errors.append((rel, ve))

    if missing or invalid or vis_errors:
        print(
            f"❌  lint_command_tiers: {len(missing)} missing tier, "
            f"{len(invalid)} invalid tier, {len(vis_errors)} visibility "
            f"(of {len(commands)} commands)",
            file=sys.stderr,
        )
        for name in missing:
            print(f"    missing tier: {name}", file=sys.stderr)
        for name, tier in invalid:
            print(f"    invalid tier '{tier}': {name}", file=sys.stderr)
        for name, err in vis_errors:
            print(f"    {err}: {name}", file=sys.stderr)
        print(
            f"    valid tiers: {sorted(VALID_TIERS)}; "
            f"valid visibility: {sorted(VALID_VISIBILITIES)}",
            file=sys.stderr,
        )
        print(
            "    contract: docs/contracts/command-surface-tiers.md (ADR-090)",
            file=sys.stderr,
        )
        return 1

    if not quiet:
        print(
            f"✅  lint_command_tiers: {len(commands)} commands, "
            f"all tier + visibility values valid"
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
    missing: list[str] = []
    invalid: list[tuple[str, str]] = []
    vis_errors: list[tuple[str, str]] = []
    for c in commands:
        rel = c.relative_to(REPO).as_posix()
        text = c.read_text(encoding="utf-8")
        tier = parse_tier(text)
        if tier is None:
            missing.append(rel)
        elif tier not in VALID_TIERS:
            invalid.append((rel, tier))
        if (ve := visibility_error(text)) is not None:
            vis_errors.append((rel, ve))
    if missing or invalid or vis_errors:
        print(
            f"❌  lint_command_tiers: {len(missing)} missing tier, "
            f"{len(invalid)} invalid tier, {len(vis_errors)} visibility "
            f"(of {len(commands)} domain commands)",
            file=sys.stderr,
        )
        for name in missing:
            print(f"    missing tier: {name}", file=sys.stderr)
        for name, tier in invalid:
            print(f"    invalid tier '{tier}': {name}", file=sys.stderr)
        for name, err in vis_errors:
            print(f"    {err}: {name}", file=sys.stderr)
        return 1
    if not quiet:
        print(
            f"✅  lint_command_tiers: {len(commands)} domain commands, "
            f"all tier + visibility values valid"
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
    # .augment/commands → dist/agent-src/commands symlink). It must also
    # carry tier so the surface stays uniform.
    if COMMANDS_DIR_CONDENSED.is_dir():
        rc |= lint(COMMANDS_DIR_CONDENSED, quiet=QUIET)
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
