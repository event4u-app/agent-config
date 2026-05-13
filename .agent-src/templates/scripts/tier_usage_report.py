#!/usr/bin/env python3
"""Tier-usage report — aggregate the local tier-usage log into a frequency table.

Phase 5 Step 3 of road-to-surface-discipline. Reads the JSONL log
written by the dispatcher (default ``.agent-tier-usage.jsonl``; override
via ``telemetry.tier_usage.output.path``) and emits a per-command
frequency table grouped by tier, plus distinct ``user_hash`` counts.
Run-local-only; no upload, no remote aggregation.

Privacy floor mirrors the contract in
``docs/contracts/command-clusters.md#tier-usage-signal-contract`` and
the four-layer enforcement model used by artefact-engagement telemetry.
Records that carry any field outside the contract whitelist are dropped
at the read gate — the report refuses to render leaked shapes rather
than re-emit them.

Usage:
    python3 tier_usage_report.py                       # last 30d, table
    python3 tier_usage_report.py --window-days 7       # last 7d
    python3 tier_usage_report.py --window-days 0       # full log
    python3 tier_usage_report.py --json                # JSON for tooling
    python3 tier_usage_report.py --log-path X.jsonl    # archived snapshot

Exit codes:
    0   success or telemetry disabled (single header line)
    1   no records survived the privacy floor on a non-empty file
    2   IO error (permission denied; passed path missing)
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from telemetry.settings import DEFAULT_TIER_USAGE_LOG_PATH, read_tier_usage_settings

#: Contract whitelist (see ``docs/contracts/command-clusters.md``).
ALLOWED_FIELDS = frozenset({"ts_bucket", "command", "tier", "outcome", "user_hash"})
ALLOWED_OUTCOMES = frozenset({"success", "error", "blocked"})


def _parse_record(raw: str) -> dict[str, Any] | None:
    """Return a sanitized record or ``None`` when the line violates the floor."""
    try:
        obj = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(obj, dict):
        return None
    if not set(obj.keys()).issubset(ALLOWED_FIELDS):
        return None
    cmd = obj.get("command")
    if not isinstance(cmd, str) or not cmd or "/" in cmd or "\\" in cmd:
        return None
    if not isinstance(obj.get("tier"), int) or obj["tier"] not in (0, 1, 2, 3):
        return None
    if obj.get("outcome") not in ALLOWED_OUTCOMES:
        return None
    uh = obj.get("user_hash")
    if not isinstance(uh, str) or len(uh) != 16:
        return None
    if not isinstance(obj.get("ts_bucket"), str):
        return None
    return obj


def _within_window(ts_bucket: str, window_days: int | None) -> bool:
    if window_days is None or window_days == 0:
        return True
    try:
        ts = datetime.fromisoformat(ts_bucket.replace("Z", "+00:00"))
    except ValueError:
        return False
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return ts >= datetime.now(timezone.utc) - timedelta(days=window_days)


def aggregate(
    log_path: Path, window_days: int,
) -> tuple[dict[tuple[int, str], dict[str, Any]], int, int]:
    """Return ``((tier, command) -> stats, total_lines, kept)`` over the window."""
    buckets: dict[tuple[int, str], dict[str, Any]] = defaultdict(
        lambda: {"count": 0, "users": set()},
    )
    total = 0
    kept = 0
    if not log_path.exists():
        return {}, 0, 0
    with log_path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            total += 1
            rec = _parse_record(line)
            if rec is None:
                continue
            if not _within_window(rec["ts_bucket"], window_days):
                continue
            kept += 1
            key = (int(rec["tier"]), rec["command"])
            buckets[key]["count"] += 1
            buckets[key]["users"].add(rec["user_hash"])
    out = {k: {"count": v["count"], "distinct_users": len(v["users"])}
           for k, v in buckets.items()}
    return out, total, kept


def render(
    table: dict[tuple[int, str], dict[str, Any]],
    window_days: int,
) -> str:
    suffix = f" (last {window_days}d)" if window_days else " (full log)"
    if not table:
        return f"(no tier-usage records{suffix})\n"
    rows = sorted(table.items(), key=lambda kv: (kv[0][0], -kv[1]["count"], kv[0][1]))
    header = f"{'Tier':<6}{'Command':<32}{'Calls':>8}{'Users':>8}"
    lines = [header, "-" * len(header)]
    for (tier, command), stats in rows:
        lines.append(
            f"{tier:<6}{command:<32}{stats['count']:>8}{stats['distinct_users']:>8}",
        )
    lines.append(f"\n(window:{suffix.strip()})")
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Tier-usage frequency report.")
    parser.add_argument("--window-days", type=int, default=30,
                        help="trailing window in days (0 = full log)")
    parser.add_argument("--json", action="store_true",
                        help="emit JSON instead of the table")
    parser.add_argument("--log-path", type=Path, default=None,
                        help="override settings; read an archived log")
    parser.add_argument("--settings-file", type=Path, default=Path(".agent-settings.yml"))
    args = parser.parse_args(argv)

    settings = read_tier_usage_settings(args.settings_file)
    log_path = args.log_path or settings.log_path or DEFAULT_TIER_USAGE_LOG_PATH

    if args.log_path is None and not settings.enabled:
        sys.stdout.write(
            "(tier-usage telemetry disabled; set "
            "`telemetry.tier_usage.enabled: true` in .agent-settings.yml)\n",
        )
        return 0

    try:
        table, total, kept = aggregate(log_path, args.window_days)
    except OSError as exc:
        print(f"❌  {exc}", file=sys.stderr)
        return 2

    if total > 0 and kept == 0:
        print(f"❌  {total} record(s) read; 0 survived the privacy floor — "
              "report refused", file=sys.stderr)
        return 1

    if args.json:
        payload = {
            "window_days": args.window_days,
            "log_path": str(log_path),
            "records_total": total,
            "records_kept": kept,
            "rows": [
                {"tier": t, "command": c, "count": v["count"],
                 "distinct_users": v["distinct_users"]}
                for (t, c), v in sorted(table.items(), key=lambda kv: (kv[0][0], kv[0][1]))
            ],
        }
        sys.stdout.write(json.dumps(payload, indent=2) + "\n")
    else:
        sys.stdout.write(render(table, args.window_days))
    return 0


if __name__ == "__main__":
    sys.exit(main())
