#!/usr/bin/env python3
"""
Beta-review-marker checker for `docs/contracts/`.

Every contract whose frontmatter declares `stability: beta` MUST carry
exactly one of the following frontmatter markers (per
`docs/contracts/STABILITY.md` § Beta-review markers, ratified in
`road-to-productization.md` § P5.4):

  - `promote-to: stable`
  - `keep-beta-until: YYYY-MM-DD`     (max 90 days from the last review)
  - `superseded-by: <contract-id>`

Exit codes: 0 = clean, 1 = violations found, 3 = internal error.

Usage:
    python3 scripts/check_beta_review_markers.py
    python3 scripts/check_beta_review_markers.py --json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTRACTS_DIR = Path("docs/contracts")

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)
STABILITY_RE = re.compile(r"^stability:\s*(\w+)\s*$", re.MULTILINE)
PROMOTE_RE = re.compile(r"^promote-to:\s*stable\s*$", re.MULTILINE)
KEEP_RE = re.compile(r"^keep-beta-until:\s*(\d{4}-\d{2}-\d{2})\s*$", re.MULTILINE)
SUPERSEDED_RE = re.compile(r"^superseded-by:\s*\S+\s*$", re.MULTILINE)

MAX_REVIEW_WINDOW_DAYS = 90


@dataclass
class Violation:
    file: str
    reason: str
    severity: str  # "error" | "warning"


def read_frontmatter(path: Path) -> str | None:
    if not path.exists():
        return None
    txt = path.read_text(encoding="utf-8")
    m = FRONTMATTER_RE.match(txt)
    return m.group(1) if m else None


def check_one(path: Path, today: date) -> list[Violation]:
    fm = read_frontmatter(path)
    if fm is None:
        return []
    sm = STABILITY_RE.search(fm)
    if not sm or sm.group(1) != "beta":
        return []
    markers = [
        ("promote-to", bool(PROMOTE_RE.search(fm))),
        ("keep-beta-until", bool(KEEP_RE.search(fm))),
        ("superseded-by", bool(SUPERSEDED_RE.search(fm))),
    ]
    set_markers = [name for name, present in markers if present]
    rel = str(path.relative_to(ROOT))
    if not set_markers:
        return [Violation(
            file=rel,
            reason="stability=beta but no review marker; add one of "
                   "`promote-to: stable` | `keep-beta-until: <date>` | "
                   "`superseded-by: <id>` (see STABILITY.md § Beta-review markers)",
            severity="error",
        )]
    if len(set_markers) > 1:
        return [Violation(
            file=rel,
            reason=f"multiple beta-review markers set ({', '.join(set_markers)}); "
                   "exactly one is allowed",
            severity="error",
        )]
    km = KEEP_RE.search(fm)
    if km:
        review_date = date.fromisoformat(km.group(1))
        max_date = today + timedelta(days=MAX_REVIEW_WINDOW_DAYS)
        if review_date > max_date:
            return [Violation(
                file=rel,
                reason=f"keep-beta-until={review_date} exceeds the "
                       f"{MAX_REVIEW_WINDOW_DAYS}-day window (max: {max_date})",
                severity="error",
            )]
    return []


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    args = ap.parse_args()
    today = date.today()
    violations: list[Violation] = []
    for p in sorted((ROOT / CONTRACTS_DIR).glob("*.md")):
        violations.extend(check_one(p, today))
    if args.json:
        print(json.dumps({"violations": [asdict(v) for v in violations]}, indent=2))
    else:
        if not violations:
            print("✅  All beta contracts carry a valid review marker.")
        else:
            for v in violations:
                icon = "❌" if v.severity == "error" else "⚠️ "
                print(f"{icon}  {v.file}: {v.reason}")
            print(f"\n{len(violations)} violation(s).")
    return 1 if any(v.severity == "error" for v in violations) else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # pragma: no cover
        print(f"internal error: {exc}", file=sys.stderr)
        sys.exit(3)
