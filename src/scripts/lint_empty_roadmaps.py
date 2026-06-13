#!/usr/bin/env python3
"""Hard-Gate linter: no empty roadmap files under ``agents/roadmaps/``.

A roadmap ``.md`` that is 0 bytes (or only whitespace) is never valid — it
carries no goal, no phases, no content. Empty roadmaps have been introduced
twice by an external ``chore: add uncomitted roadmaps`` auto-commit that
staged 0-byte placeholders (2026-06-13: ``road-to-6.0.0-final-readiness.md``
and ``road-to-reaping-catches-pre-inventory-orphans.md``). The local
pre-commit dashboard check did not catch them — the dashboard generator
silently skips empty files — and the commits bypassed it anyway. This linter
is the authoritative backstop: it fails CI (and the pre-commit hook) so an
empty roadmap can never reach ``main`` again, regardless of how it was staged.

Scope: every ``*.md`` under ``agents/roadmaps/`` (active, ``archive/``,
``skipped/``, ``stubs/``, ``later/``) — empty is invalid everywhere. The
``.gitkeep`` placeholders are not ``.md`` and are ignored.

Cap: ≤ 120 LOC, stdlib only. Hooked into ``task ci`` / ``task ci-fast`` via
``task lint-empty-roadmaps`` and into the pre-commit hook.

Exit codes: 0 = clean, 1 = at least one empty roadmap found.
"""
from __future__ import annotations

import sys
from pathlib import Path

QUIET = "--quiet" in sys.argv

ROADMAP_DIR = Path("agents/roadmaps")


def _repo_root() -> Path:
    """Walk up from CWD until a dir containing ``agents/roadmaps`` is found."""
    here = Path.cwd()
    for candidate in (here, *here.parents):
        if (candidate / ROADMAP_DIR).is_dir():
            return candidate
    return here


def find_empty_roadmaps(root: Path) -> list[Path]:
    base = root / ROADMAP_DIR
    if not base.is_dir():
        return []
    empties: list[Path] = []
    for md in sorted(base.rglob("*.md")):
        try:
            text = md.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            # Unreadable / binary -> not an empty-text file; leave to other gates.
            continue
        if text.strip() == "":
            empties.append(md.relative_to(root))
    return empties


def main() -> int:
    root = _repo_root()
    empties = find_empty_roadmaps(root)

    if not empties:
        if not QUIET:
            print("✅  lint-empty-roadmaps: no empty roadmap files.")
        return 0

    print("❌  lint-empty-roadmaps: empty (0-byte / whitespace-only) roadmap file(s):")
    for rel in empties:
        print(f"      {rel}")
    print()
    print("   A roadmap with no content is invalid. Either:")
    print("     • restore the intended content, or")
    print("     • delete the file (if its content lives in agents/roadmaps/archive/).")
    print("   Empty roadmap stubs are usually an artefact of an auto-commit that")
    print("   staged a 0-byte placeholder — remove it; do not commit it.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
