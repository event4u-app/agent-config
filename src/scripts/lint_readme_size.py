#!/usr/bin/env python3
"""CI guard for README.md line budget.

The role-first-onboarding roadmap (Phase 2 Step 6) freezes README at
its current length: replace, do not grow. Every line added above the
fold must displace an existing line. Budget: 750 lines max.
"""

from __future__ import annotations

import sys
from pathlib import Path

README = Path("README.md")
LIMIT = 750


def main() -> int:
    quiet = "--quiet" in sys.argv
    if not README.exists():
        print(f"error: {README} not found", file=sys.stderr)
        return 1
    n = sum(1 for _ in README.read_text(encoding="utf-8").splitlines())
    if n > LIMIT:
        print(f"FAIL  {README}: {n} lines (limit {LIMIT}). Trim before merge.")
        return 1
    if not quiet:
        print(f"OK    {README}: {n} lines (limit {LIMIT}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
