#!/usr/bin/env python3
"""Project-analysis freshness loop — a cheap *heuristic* staleness signal.

`project-analyzer` output under ``agents/evidence/analysis/*.md`` is rich but has
no signal for *"is this still current?"*. This script adds a one-line freshness
header and a probe that tells the agent whether a high-tier re-analysis is
likely worth it. File-first, no runtime.

> The signal is a **heuristic, not a guarantee** (council 2026-06-15): a low
> changed-file count over the analyzed paths suggests freshness; it does not
> *prove* the analysis still holds (a one-line change can invalidate it). Use it
> to decide whether re-analysis is *worth the tokens*, not as a correctness gate.

Header shape (top of each analysis file):

    <!-- analyzed: 2026-06-15 | commit: 57588489 | files: 4 -->

Usage:
  python3 src/scripts/analysis_freshness.py --stamp agents/evidence/analysis/foo.md
  python3 src/scripts/analysis_freshness.py --stamp-all
  python3 src/scripts/analysis_freshness.py --check agents/evidence/analysis/foo.md
  python3 src/scripts/analysis_freshness.py --check-all
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent
REPO_ROOT = _HERE.parent.parent
ANALYSIS_DIR = REPO_ROOT / "agents" / "evidence" / "analysis"

_HEADER_RE = re.compile(
    r"<!--\s*analyzed:\s*(?P<date>[\d-]+)\s*\|\s*commit:\s*(?P<commit>[0-9a-f]+)"
    r"\s*\|\s*files:\s*(?P<files>\d+)\s*-->"
)
# Repo-relative path tokens an analysis doc tends to reference.
_PATH_RE = re.compile(r"`(?P<p>(?:src|docs|agents|scripts|tests)/[\w./-]+)`")

# Heuristic staleness bands by count of changed files over the analyzed paths.
_AGING = 1
_STALE = 8


def _git(*args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(REPO_ROOT), *args],
        capture_output=True, text=True, check=False,
    ).stdout.strip()


def _head_short() -> str:
    return _git("rev-parse", "--short", "HEAD") or "unknown"


def _referenced_paths(text: str) -> list[str]:
    """Best-effort: repo paths the doc cites (deduped, existing only)."""
    seen: list[str] = []
    for m in _PATH_RE.finditer(text):
        p = m.group("p")
        if p not in seen and (REPO_ROOT / p).exists():
            seen.append(p)
    return seen


def cmd_stamp(path: Path) -> int:
    text = path.read_text(encoding="utf-8")
    paths = _referenced_paths(text)
    # Backfill the analyzed date from the file's own last commit (honest for
    # retro-stamps); go-forward stamps land on today via a fresh re-stamp.
    date = _git("log", "-1", "--format=%cs", "--", str(path)) or _git(
        "log", "-1", "--format=%cs"
    )
    header = f"<!-- analyzed: {date} | commit: {_head_short()} | files: {len(paths)} -->"
    body = _HEADER_RE.sub("", text, count=1).lstrip("\n") if _HEADER_RE.search(text) else text
    path.write_text(header + "\n" + body, encoding="utf-8")
    print(f"  stamped {path.relative_to(REPO_ROOT)} → {header}")
    return 0


def cmd_check(path: Path) -> int:
    text = path.read_text(encoding="utf-8")
    m = _HEADER_RE.search(text)
    if not m:
        print(f"  ⚠️  {path.relative_to(REPO_ROOT)} — no freshness header (run --stamp)")
        return 0
    commit, paths = m.group("commit"), _referenced_paths(text)
    scope = paths or ["."]
    changed = _git("diff", "--name-only", f"{commit}..HEAD", "--", *scope).splitlines()
    changed = [c for c in changed if c.strip()]
    n = len(changed)
    band = "fresh" if n == 0 else "aging" if n < _STALE else "STALE — re-analysis likely worth it"
    if n >= _AGING:
        verdict = f"⚠️  {band}" if n >= _STALE else f"·  {band}"
    else:
        verdict = "✅  fresh"
    print(f"  {verdict} — {path.relative_to(REPO_ROOT)}: {n} changed file(s) "
          f"over {len(scope)} analyzed path(s) since {commit}")
    return 0


def _iter_analysis() -> list[Path]:
    return sorted(ANALYSIS_DIR.glob("*.md"))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    g = parser.add_mutually_exclusive_group(required=True)
    g.add_argument("--stamp", metavar="FILE", help="add/refresh the freshness header")
    g.add_argument("--stamp-all", action="store_true", help="stamp every analysis file")
    g.add_argument("--check", metavar="FILE", help="report the staleness signal")
    g.add_argument("--check-all", action="store_true", help="check every analysis file")
    args = parser.parse_args(argv)

    if args.stamp:
        return cmd_stamp(Path(args.stamp))
    if args.check:
        return cmd_check(Path(args.check))
    if args.stamp_all:
        for p in _iter_analysis():
            cmd_stamp(p)
        return 0
    if args.check_all:
        for p in _iter_analysis():
            cmd_check(p)
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
