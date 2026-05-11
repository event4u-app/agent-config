#!/usr/bin/env python3
"""Mine repeated phase patterns from ``agents/state/audit/*.jsonl``.

Consumer side of `audit-log-v1` (see
`docs/contracts/audit-log-v1.md`). Reads append-only JSONL audit
lines emitted by the `work_engine` phase hook and surfaces patterns
that repeat across **independent** runs — i.e. distinct `work_id`
values — so the human reviewer can promote them via the
`learning-to-rule-or-skill` skill.

Read-only: never mutates the JSONL, never writes outside `--output`.

Pattern shape (one per row):

  {
    "summary":   "<phase>:<outcome>:<rules_hash>",
    "phase":     "verify",
    "outcome":   "success",
    "rules_applied": ["verify-before-complete", "commit-policy"],
    "count":     7,                # distinct work_ids
    "line_ids":  ["01HXY...", ...],
    "first_seen": "2026-05-01T...",
    "last_seen":  "2026-05-11T..."
  }

Repetition gate: a pattern is emitted only when ``count >= 2`` and
the two contributing lines come from **different** ``work_id`` values
(independence floor — same gate as the skill's evidence rule).

Usage::

  python3 scripts/extract_audit_patterns.py                  # human table
  python3 scripts/extract_audit_patterns.py --json           # machine
  python3 scripts/extract_audit_patterns.py --min-count 3
  python3 scripts/extract_audit_patterns.py --month 2026-05  # one file
  python3 scripts/extract_audit_patterns.py --audit-dir <p>  # override
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_AUDIT_DIR = ROOT / "agents" / "state" / "audit"
SCHEMA_VERSION = 1


@dataclass
class Pattern:
    summary: str
    phase: str
    outcome: str
    rules_applied: list[str]
    count: int = 0
    line_ids: list[str] = field(default_factory=list)
    work_ids: set[str] = field(default_factory=set)
    first_seen: str = ""
    last_seen: str = ""

    def to_dict(self) -> dict:
        d = asdict(self)
        d["work_ids"] = sorted(self.work_ids)
        return d


def _iter_lines(audit_dir: Path, month: str | None) -> Iterable[dict]:
    """Yield parsed JSONL records from the audit directory.

    Silently skips malformed lines (forward-compat per contract § 86).
    """
    if not audit_dir.exists():
        return
    files = (
        [audit_dir / f"{month}.jsonl"] if month
        else sorted(audit_dir.glob("*.jsonl"))
    )
    for path in files:
        if not path.exists():
            continue
        with path.open("r", encoding="utf-8") as fh:
            for raw in fh:
                raw = raw.strip()
                if not raw:
                    continue
                try:
                    rec = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                if rec.get("schema_version") != SCHEMA_VERSION:
                    continue
                yield rec


def _pattern_key(rec: dict) -> tuple[str, str, tuple[str, ...]]:
    rules = tuple(sorted(rec.get("rules_applied") or []))
    return (rec.get("phase", ""), rec.get("outcome", ""), rules)


def _resolve_supersedes(records: list[dict]) -> list[dict]:
    """Apply supersede chains: drop records whose id is superseded."""
    superseded: set[str] = set()
    for rec in records:
        if rec.get("type") == "supersede" and rec.get("supersedes"):
            superseded.add(rec["supersedes"])
    return [r for r in records if r.get("id") not in superseded]


def mine(audit_dir: Path, month: str | None, min_count: int) -> list[dict]:
    """Group records into patterns; enforce independence floor."""
    records = _resolve_supersedes(list(_iter_lines(audit_dir, month)))
    groups: dict[tuple, Pattern] = {}
    for rec in records:
        if rec.get("type") not in (None, "phase"):
            continue
        key = _pattern_key(rec)
        if key not in groups:
            phase, outcome, rules = key
            rules_hash = "+".join(rules) or "<none>"
            groups[key] = Pattern(
                summary=f"{phase}:{outcome}:{rules_hash}",
                phase=phase,
                outcome=outcome,
                rules_applied=list(rules),
            )
        pat = groups[key]
        ts = rec.get("ts", "")
        wid = rec.get("work_id", "")
        if wid:
            pat.work_ids.add(wid)
        line_id = rec.get("id", "")
        if line_id:
            pat.line_ids.append(line_id)
        pat.count = len(pat.work_ids)
        if not pat.first_seen or ts < pat.first_seen:
            pat.first_seen = ts
        if not pat.last_seen or ts > pat.last_seen:
            pat.last_seen = ts
    out = [p.to_dict() for p in groups.values() if p.count >= min_count]
    out.sort(key=lambda d: (-d["count"], d["summary"]))
    return out


def _render_table(patterns: list[dict]) -> str:
    if not patterns:
        return "(no patterns at or above the min-count threshold)"
    lines = [
        f"{'count':>5}  {'phase':<10} {'outcome':<8} {'rules':<40} summary",
        f"{'-' * 5}  {'-' * 10} {'-' * 8} {'-' * 40} -------",
    ]
    for p in patterns:
        rules = ",".join(p["rules_applied"]) or "<none>"
        if len(rules) > 38:
            rules = rules[:35] + "..."
        lines.append(
            f"{p['count']:>5}  {p['phase']:<10} {p['outcome']:<8} "
            f"{rules:<40} {p['summary']}"
        )
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument(
        "--audit-dir", type=Path, default=DEFAULT_AUDIT_DIR,
        help="Override audit-log directory (default: %(default)s).",
    )
    ap.add_argument(
        "--month", help="Single YYYY-MM file instead of all months.",
    )
    ap.add_argument(
        "--min-count", type=int, default=2,
        help="Minimum distinct work_ids required (default: 2).",
    )
    ap.add_argument(
        "--json", action="store_true", help="Emit machine-readable JSON.",
    )
    args = ap.parse_args(argv)

    if args.min_count < 2:
        print(
            "❌  --min-count must be >= 2 (independence floor per "
            "audit-log-v1 § Privacy floor).",
            file=sys.stderr,
        )
        return 2

    patterns = mine(args.audit_dir, args.month, args.min_count)
    if args.json:
        json.dump(patterns, sys.stdout, indent=2, sort_keys=True)
        sys.stdout.write("\n")
    else:
        print(_render_table(patterns))
    return 0


if __name__ == "__main__":
    sys.exit(main())
