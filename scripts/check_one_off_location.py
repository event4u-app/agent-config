#!/usr/bin/env python3
"""One-off script-location guard (Phase 0a.2 of road-to-rule-hardening).

Every ``_one_off_*.py`` script under ``scripts/`` must live inside the
archive folder ``scripts/ai_council/one_off_archive/<YYYY-MM>/``. The
guard fails CI if a new probe lands anywhere else in the tree.

Rationale: one-off council probes / phase-specific measurements are
inherently single-purpose; their durable artefact is the council
session under ``agents/council-sessions/``. Keeping them in the
archive prevents the ``scripts/`` root from accumulating noise and
makes their lifecycle visible (folder == month archived).

Exit codes:
    0 = clean
    1 = violation (script outside the archive)
    3 = internal error
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = REPO_ROOT / "scripts"
ARCHIVE = SCRIPTS / "ai_council" / "one_off_archive"
ARCHIVE_MONTH_RE = re.compile(r"^\d{4}-\d{2}$")


def find_violations() -> list[Path]:
    """Return one-off scripts that are outside the archive folder."""
    violations: list[Path] = []
    for path in SCRIPTS.rglob("_one_off_*.py"):
        if not path.is_file():
            continue
        # Must live under scripts/ai_council/one_off_archive/<YYYY-MM>/
        try:
            rel = path.relative_to(ARCHIVE)
        except ValueError:
            violations.append(path)
            continue
        # rel = "<YYYY-MM>/<name>.py"
        parts = rel.parts
        if len(parts) != 2 or not ARCHIVE_MONTH_RE.match(parts[0]):
            violations.append(path)
    return violations


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    parser.add_argument("--quiet", action="store_true", help="Only print on failure")
    args = parser.parse_args()

    try:
        violations = find_violations()
    except Exception as exc:  # pragma: no cover — defensive
        print(f"❌  internal error: {exc}", file=sys.stderr)
        return 3

    if violations:
        print("❌  one-off scripts outside the archive:", file=sys.stderr)
        for path in violations:
            rel = path.relative_to(REPO_ROOT)
            print(f"    {rel}", file=sys.stderr)
        print(
            "\n  Move them under "
            "scripts/ai_council/one_off_archive/<YYYY-MM>/ "
            "(see that folder's README.md).",
            file=sys.stderr,
        )
        return 1

    if not args.quiet:
        print("✅  all _one_off_*.py scripts are archived")
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
