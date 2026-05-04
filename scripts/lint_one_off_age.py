#!/usr/bin/env python3
"""One-off-script age linter.

Scans `scripts/_one_off/<YYYY-MM>/_one_off_*.py` and enforces the
TTL policy from `docs/contracts/one-off-script-lifecycle.md`:

  * Age ≤ 60 days   → active, silent.
  * 60 < Age ≤ 90   → warning, exit 0.
  * Age > 90        → hard fail, exit 1 (purge candidate).

Scripts MAY extend their TTL exactly once via a frontmatter block:

    \"\"\"
    ---
    ttl_extended_until: YYYY-MM-DD
    ttl_reason: <free text>
    ---
    \"\"\"

The extended date is honoured up to 180 days past the month-directory
date. Anything beyond hard-fails with no second extension.

Exit codes: 0 = clean (incl. warnings), 1 = hard fail, 3 = internal error.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ONE_OFF_DIR = ROOT / "scripts" / "_one_off"

NAME_RE = re.compile(r"^_one_off_[a-z0-9-]+\.py$")
MONTH_RE = re.compile(r"^\d{4}-\d{2}$")
TTL_RE = re.compile(
    r"---\s*\n\s*ttl_extended_until:\s*(\d{4}-\d{2}-\d{2})\s*\n",
    re.MULTILINE,
)

WARN_DAYS = 60
HARD_DAYS = 90
EXTEND_CAP_DAYS = 180


@dataclass
class Finding:
    path: str
    age_days: int
    severity: str  # "warn" | "fail"
    reason: str


def _today_utc() -> date:
    return datetime.now(timezone.utc).date()


def _month_anchor(month_dir: str) -> date | None:
    if not MONTH_RE.match(month_dir):
        return None
    y, m = map(int, month_dir.split("-"))
    try:
        return date(y, m, 1)
    except ValueError:
        return None


def _read_extension(path: Path) -> date | None:
    try:
        head = path.read_text(encoding="utf-8")[:1024]
    except OSError:
        return None
    m = TTL_RE.search(head)
    if not m:
        return None
    try:
        return datetime.strptime(m.group(1), "%Y-%m-%d").date()
    except ValueError:
        return None


def scan(root: Path, today: date | None = None) -> list[Finding]:
    today = today or _today_utc()
    base = root / "scripts" / "_one_off"
    if not base.exists():
        return []
    out: list[Finding] = []
    for month_dir in sorted(base.iterdir()):
        if not month_dir.is_dir():
            continue
        anchor = _month_anchor(month_dir.name)
        if anchor is None:
            out.append(Finding(
                path=str(month_dir.relative_to(root)),
                age_days=-1,
                severity="fail",
                reason="invalid month directory name (expect YYYY-MM)",
            ))
            continue
        for f in sorted(month_dir.iterdir()):
            if f.name == "README.md" or f.is_dir():
                continue
            if not NAME_RE.match(f.name):
                out.append(Finding(
                    path=str(f.relative_to(root)),
                    age_days=-1,
                    severity="fail",
                    reason="filename does not match _one_off_<slug>.py",
                ))
                continue
            age = (today - anchor).days
            extension = _read_extension(f)
            if extension is not None:
                cap = (extension - anchor).days
                if cap > EXTEND_CAP_DAYS:
                    out.append(Finding(
                        path=str(f.relative_to(root)),
                        age_days=age,
                        severity="fail",
                        reason=f"ttl_extended_until exceeds 180-day cap ({cap}d)",
                    ))
                    continue
                if age <= cap:
                    continue  # extension still valid, silent
            if age > HARD_DAYS:
                out.append(Finding(
                    path=str(f.relative_to(root)),
                    age_days=age,
                    severity="fail",
                    reason=f"age {age}d exceeds {HARD_DAYS}-day hard limit",
                ))
            elif age > WARN_DAYS:
                out.append(Finding(
                    path=str(f.relative_to(root)),
                    age_days=age,
                    severity="warn",
                    reason=f"age {age}d in soft window ({WARN_DAYS}–{HARD_DAYS}d)",
                ))
    return out


def format_text(findings: list[Finding]) -> str:
    if not findings:
        return "✅  No one-off-script age violations."
    lines = []
    fails = [f for f in findings if f.severity == "fail"]
    warns = [f for f in findings if f.severity == "warn"]
    if fails:
        lines.append(f"❌  {len(fails)} one-off script(s) past hard limit:")
        for f in fails:
            lines.append(f"  🔴 {f.path}  →  {f.reason}")
    if warns:
        lines.append(f"⚠️  {len(warns)} one-off script(s) in soft window:")
        for f in warns:
            lines.append(f"  🟡 {f.path}  →  {f.reason}")
    lines.append(
        "\nPurge candidates per docs/contracts/one-off-script-lifecycle.md."
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--format", choices=["text", "json"], default="text")
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args()
    try:
        findings = scan(args.root)
    except Exception as e:    # pragma: no cover
        print(f"Internal error: {e}", file=sys.stderr)
        return 3
    if args.format == "json":
        print(json.dumps([asdict(f) for f in findings], indent=2))
    else:
        print(format_text(findings))
    return 1 if any(f.severity == "fail" for f in findings) else 0


if __name__ == "__main__":
    sys.exit(main())
