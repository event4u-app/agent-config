#!/usr/bin/env python3
"""
Command-count messaging gate (regression guard for road-to-pr-34-followups 1.2).

Public surfaces (README.md, AGENTS.md, docs/getting-started.md) advertise
the size of the command catalog. PR #34 collapses atomic commands into
clusters via deprecation shims — the externally meaningful number is the
**active** command count (non-shim files), not the raw file count. This
gate sources canonical counts from `.agent-src.uncondensed/commands/`
frontmatter and fails when any documented number drifts from those.

Canonical counts:
    total   = number of *.md files under .agent-src.uncondensed/commands/
    shims   = files whose frontmatter declares `superseded_by:`
    active  = total - shims

Patterns checked (per file):

    README.md
      hero badge   "/badge/Commands-{N}-…"                    → active
      (Prose phrasings "Browse all {N} active commands" and
       "{N} native commands" were retired in the modernized
       README — the badge alone now carries the count.)

    AGENTS.md
      tree         "commands/  ({N} files — {A} active + {S} deprecation shims)"
      (Thin-Root: only checked when a `commands/` tree block exists.)

    docs/getting-started.md
      browse line  "Browse all {N} active commands"           → active

Exit codes: 0 = clean, 1 = drift detected.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib.agent_src import artefact_roots  # noqa: E402

QUIET = "--quiet" in sys.argv

ROOT = Path(__file__).resolve().parent.parent
README = ROOT / "README.md"
AGENTS = ROOT / "AGENTS.md"
GETTING_STARTED = ROOT / "docs" / "getting-started.md"

FM_RE = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL)
SUPERSEDED_RE = re.compile(r"^superseded_by:\s*\S", re.MULTILINE)


def _command_files() -> list[Path]:
    """Every command ``*.md`` file across all source roots (legacy + packages/*).

    Multi-root aware per ADR-017: post-move the commands live under
    ``packages/<pack>/.agent-src.uncondensed/commands/``, and the
    canonical count is the union across packs (deduped by logical path).
    """
    seen: dict[str, Path] = {}
    for root in artefact_roots():
        cmd_dir = root / "commands"
        if not cmd_dir.is_dir():
            continue
        for f in cmd_dir.rglob("*.md"):
            if f.name == "AGENTS.md":
                continue
            rel = f.relative_to(cmd_dir).as_posix()
            seen.setdefault(rel, f)
    return sorted(seen.values())


def canonical_counts() -> tuple[int, int, int]:
    files = _command_files()
    if not files:
        print("❌  no commands/ directory found under any artefact root", file=sys.stderr)
        sys.exit(1)
    total = shims = 0
    for f in files:
        total += 1
        m = FM_RE.match(f.read_text(encoding="utf-8"))
        fm = m.group(1) if m else ""
        if SUPERSEDED_RE.search(fm):
            shims += 1
    return total, shims, total - shims


def _check(path: Path, pattern: str, expected: int, label: str) -> str | None:
    if not path.exists():
        return f"missing file: {path.relative_to(ROOT)}"
    m = re.search(pattern, path.read_text(encoding="utf-8"))
    if not m:
        return f"{path.relative_to(ROOT)}: pattern not found for `{label}` — /{pattern}/"
    found = int(m.group(1))
    if found != expected:
        return f"{path.relative_to(ROOT)}: `{label}` says {found}, expected {expected}"
    return None


def main() -> int:
    total, shims, active = canonical_counts()
    print(f"Canonical counts: {total} files · {shims} shims · {active} active")

    checks = [
        # README.md — modernized: badge is the sole count surface
        (README, r"/badge/Commands-(\d+)-", active, "hero badge"),
        # docs/getting-started.md — still carries the prose browse line
        (GETTING_STARTED, r"Browse all (\d+) active commands", active, "browse line"),
    ]
    # Shim-specific messaging only applies during a deprecation window.
    # When shims == 0 the clauses are dropped from public docs entirely;
    # re-add these patterns when a new deprecation cycle starts.
    #
    # AGENTS.md is Thin-Root (per agents-md-thin-root skill) — it carries
    # pointers, not an inventory tree. Tree-shaped shim messaging only
    # applies when AGENTS.md actually contains a `commands/` tree block
    # (legacy form). README absorbs the deprecation advertisement either way.
    if shims > 0:
        checks.extend([
            (README, r"\((\d+) files total ", total, "browse meta · total files"),
            (README, r"— (\d+) are deprecation shims", shims, "browse meta · shims"),
        ])
        agents_text = AGENTS.read_text(encoding="utf-8") if AGENTS.exists() else ""
        if re.search(r"commands/\s+\(", agents_text):
            checks.extend([
                (AGENTS, r"commands/\s+\((\d+) files —", total, "tree · total files"),
                (AGENTS, r"files — (\d+) active", active, "tree · active"),
                (AGENTS, r"active \+ (\d+) deprecation shims", shims, "tree · shims"),
            ])

    errors: list[str] = []
    for path, pattern, expected, label in checks:
        err = _check(path, pattern, expected, label)
        if err:
            errors.append(err)

    if not errors:
        if not QUIET:
            print("✅  All command-count messaging in sync with registry.")
        return 0

    print(f"❌  Command-count messaging drift — {len(errors)} mismatch(es):")
    for e in errors:
        print(f"    {e}")
    print(
        "\nFix: update the documented numbers above, or run "
        "`task check-command-count` after editing."
    )
    print(
        "Why this gate exists: see `agents/roadmaps/road-to-pr-34-followups.md` § 1.2."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
