#!/usr/bin/env python3
"""
Command-count messaging gate (regression guard for road-to-pr-34-followups 1.2).

Public surfaces (README.md, AGENTS.md, docs/getting-started.md) advertise
the size of the command catalog. PR #34 collapses atomic commands into
clusters via deprecation shims — the externally meaningful number is the
**active** command count (non-shim files), not the raw file count. This
gate sources canonical counts from `.agent-src.uncompressed/commands/`
frontmatter and fails when any documented number drifts from those.

Canonical counts:
    total   = number of *.md files under .agent-src.uncompressed/commands/
    shims   = files whose frontmatter declares `superseded_by:`
    active  = total - shims

Patterns checked (per file):

    README.md
      hero row     "<strong>{N} Commands</strong>"            → active
      browse line  "Browse all {N} active commands"           → active
      browse meta  "{N} files total"                          → total
      browse meta  "{N} are deprecation shims"                → shims
      tools blurb  "{N} native commands"                      → active

    AGENTS.md
      tree         "commands/  ({N} files — {A} active + {S} deprecation shims)"

    docs/getting-started.md
      browse line  "Browse all {N} active commands"           → active

Exit codes: 0 = clean, 1 = drift detected.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COMMANDS_DIR = ROOT / ".agent-src.uncompressed" / "commands"
README = ROOT / "README.md"
AGENTS = ROOT / "AGENTS.md"
GETTING_STARTED = ROOT / "docs" / "getting-started.md"

FM_RE = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL)
SUPERSEDED_RE = re.compile(r"^superseded_by:\s*\S", re.MULTILINE)


def canonical_counts() -> tuple[int, int, int]:
    if not COMMANDS_DIR.is_dir():
        print(f"❌  {COMMANDS_DIR.relative_to(ROOT)} not found", file=sys.stderr)
        sys.exit(1)
    total = shims = 0
    for f in COMMANDS_DIR.rglob("*.md"):
        if f.name == "AGENTS.md":
            continue
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
        # README.md
        (README, r"<strong>(\d+) Commands</strong>", active, "hero row"),
        (README, r"Browse all (\d+) active commands", active, "browse line"),
        (README, r"\((\d+) files total ", total, "browse meta · total files"),
        (README, r"— (\d+) are deprecation shims", shims, "browse meta · shims"),
        (README, r"\+ (\d+) native commands\)", active, "tools blurb"),
        # AGENTS.md (`commands/  (84 files — 69 active + 15 deprecation shims)`)
        (AGENTS, r"commands/\s+\((\d+) files —", total, "tree · total files"),
        (AGENTS, r"files — (\d+) active", active, "tree · active"),
        (AGENTS, r"active \+ (\d+) deprecation shims", shims, "tree · shims"),
        # docs/getting-started.md
        (GETTING_STARTED, r"Browse all (\d+) active commands", active, "browse line"),
    ]

    errors: list[str] = []
    for path, pattern, expected, label in checks:
        err = _check(path, pattern, expected, label)
        if err:
            errors.append(err)

    if not errors:
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
