#!/usr/bin/env python3
"""Fail the build on leftover merge/stash conflict state.

Two signals, either of which fails:

1. **Unmerged index entries** (``git ls-files -u``) — a conflicted working
   tree (the exact state a botched ``git stash pop`` / merge / rebase leaves).
   Zero false positives.
2. **Conflict markers in tracked files** — a file carrying both a
   ``<<<<<<< `` line and a ``>>>>>>> `` line (the diff2/diff3 conflict
   envelope), so a resolved-but-not-cleaned file can never be committed or
   merged silently.

Why this exists: a `git stash pop` used as a throwaway probe conflicted on
stale generated files, its output was suppressed, and the conflicted state
went unnoticed until review (conflict-marker-guard, 2026-06-15).
A content/state guard makes that class structurally un-mergeable.

Files that legitimately document conflict markers (the merge-conflict skill,
git-workflow docs) can be allowlisted in
``check_no_conflict_markers_allowlist.json`` or carry a per-line
``conflict-marker-check: ignore`` comment.

Usage:
    python3 scripts/check_no_conflict_markers.py
    python3 scripts/check_no_conflict_markers.py --quiet
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
ALLOWLIST = Path(__file__).resolve().parent / "check_no_conflict_markers_allowlist.json"
ALLOWLIST_CAP = 20

START_RE = re.compile(r"^<{7}( |$)")
END_RE = re.compile(r"^>{7}( |$)")
BASE_RE = re.compile(r"^\|{7}( |$)")
IGNORE = "conflict-marker-check: ignore"


def _git(args: list[str]) -> str:
    return subprocess.run(
        ["git", *args], cwd=REPO, capture_output=True, text=True, check=False
    ).stdout


def load_allowlist() -> set[str]:
    if not ALLOWLIST.is_file():
        return set()
    data = json.loads(ALLOWLIST.read_text(encoding="utf-8"))
    entries = data.get("files", [])
    if len(entries) > ALLOWLIST_CAP:
        print(
            f"❌  check_no_conflict_markers: allowlist has {len(entries)} entries "
            f"(> {ALLOWLIST_CAP}) — tighten the guard, do not grow the allowlist.",
            file=sys.stderr,
        )
        raise SystemExit(2)
    return set(entries)


def unmerged_paths() -> list[str]:
    out = _git(["ls-files", "-u"])
    return sorted({line.split("\t", 1)[1] for line in out.splitlines() if "\t" in line})


def tracked_text_files() -> list[str]:
    return [p for p in _git(["ls-files"]).splitlines() if p]


def scan_markers(allow: set[str]) -> list[str]:
    hits: list[str] = []
    for rel in tracked_text_files():
        if rel in allow:
            continue
        path = REPO / rel
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue  # binary / unreadable — not a conflict-marker surface
        has_start = has_end = False
        for line in text.splitlines():
            if IGNORE in line:
                continue
            if START_RE.match(line) or BASE_RE.match(line):
                has_start = True
            elif END_RE.match(line):
                has_end = True
        if has_start and has_end:
            hits.append(rel)
    return hits


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args(argv)

    allow = load_allowlist()
    unmerged = unmerged_paths()
    marker_hits = scan_markers(allow)

    if unmerged or marker_hits:
        if unmerged:
            print("❌  check_no_conflict_markers: unmerged (conflicted) paths in the index:",
                  file=sys.stderr)
            for p in unmerged:
                print(f"    {p}", file=sys.stderr)
            print("    → resolve the conflict (`git checkout HEAD -- <file>` or finish the "
                  "merge), then re-stage.", file=sys.stderr)
        if marker_hits:
            print("❌  check_no_conflict_markers: conflict markers in tracked files:",
                  file=sys.stderr)
            for p in marker_hits:
                print(f"    {p}", file=sys.stderr)
            print("    → remove the <<<<<<< / ======= / >>>>>>> envelope, or allowlist a "
                  "doc that documents markers (capped at 20).", file=sys.stderr)
        return 1

    if not args.quiet:
        print(f"✅  check_no_conflict_markers: no conflicted index entries, no markers "
              f"({len(tracked_text_files())} tracked files scanned).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
