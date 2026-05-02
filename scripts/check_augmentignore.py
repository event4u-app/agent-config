#!/usr/bin/env python3
"""
Advisory check for `.augmentignore` (road-to-governance-cleanup F6.3).

Runs as part of `task ci` to surface `/optimize augmentignore` as a
periodic reminder. Always exits 0 — this is a warn-only advisory, not
a gate. Failures here never block CI.

Checks performed:
  1. Does `.augmentignore` exist at repo root?
  2. Is its mtime older than 90 days? (stale reminder)
  3. Is it suspiciously short (<5 non-blank, non-comment lines)?

If any check trips, prints a friendly hint and exits 0. If all clean,
prints a single-line OK and exits 0.
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

STALE_DAYS = 90
MIN_USEFUL_LINES = 5
REPO_ROOT = Path(__file__).resolve().parent.parent


def check() -> int:
    target = REPO_ROOT / ".augmentignore"
    notes: list[str] = []

    if not target.exists():
        notes.append("⚠️  .augmentignore is missing — run `/optimize augmentignore` to scaffold it.")
        _emit(notes)
        return 0

    age_days = (time.time() - target.stat().st_mtime) / 86400
    if age_days > STALE_DAYS:
        notes.append(
            f"ℹ️  .augmentignore is {int(age_days)} days old (threshold: {STALE_DAYS}) — "
            "consider running `/optimize augmentignore` to refresh."
        )

    useful = [
        ln for ln in target.read_text().splitlines()
        if ln.strip() and not ln.strip().startswith("#")
    ]
    if len(useful) < MIN_USEFUL_LINES:
        notes.append(
            f"ℹ️  .augmentignore has only {len(useful)} active entries — "
            "run `/optimize augmentignore` to detect tech-stack ignores you may be missing."
        )

    _emit(notes)
    return 0


def _emit(notes: list[str]) -> None:
    if not notes:
        print("✅  .augmentignore advisory: nothing to suggest.")
        return
    print("📒  .augmentignore advisory (non-blocking):")
    for n in notes:
        print(f"    {n}")
    print("    (This is a reminder, not a CI failure.)")


if __name__ == "__main__":
    sys.exit(check())
