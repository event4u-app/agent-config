#!/usr/bin/env python3
"""Write-side helper: drop an engineering-memory signal.

Shared by producers (`/bug-fix`, `/do-and-judge`, `/propose-memory`,
incident role exit). Routes to the optional `agent-memory` package when
`memory_status.status() == "present"`; otherwise appends an intake
line under `agents/memory/intake/signals-YYYY-MM.jsonl` — append-only
JSONL with `merge=union` (see `road-to-memory-merge-safety.md`).

Rate limiting:
- Per-path, per-type, within a rolling window (default 7 days).
- Silent skip on duplicate — the producer's caller should not error,
  since over-emission is a correctness bug, not a failure mode.

Usage:
    python3 scripts/memory_signal.py \\
        --type historical-patterns \\
        --path "app/Http/Controllers/Billing/Checkout.php" \\
        --body "Null deref when currency is missing — add guard."
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import secrets
import sys
from pathlib import Path
from typing import Any

INTAKE_ROOT = Path("agents/memory/intake")
VALID_TYPES = {
    "historical-patterns",
    "incident-learnings",
    "ownership",
    "domain-invariants",
    "architecture-decisions",
    "product-rules",
}
RATE_LIMIT_WINDOW_DAYS = 7


def _now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def _new_id() -> str:
    # Short, URL-safe, stable enough for intake ids.
    return f"sig-{secrets.token_hex(6)}"


def _monthly_file() -> Path:
    ym = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m")
    return INTAKE_ROOT / f"signals-{ym}.jsonl"


def _recently_emitted(entry_type: str, path: str, body: str,
                      window_days: int = RATE_LIMIT_WINDOW_DAYS) -> bool:
    """True if an identical (type, path, body) was written within the window."""
    if not INTAKE_ROOT.is_dir():
        return False
    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=window_days)
    for jsonl in sorted(INTAKE_ROOT.glob("signals-*.jsonl")):
        try:
            with jsonl.open(encoding="utf-8") as fh:
                for line in fh:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        obj = json.loads(line)
                    except ValueError:
                        continue
                    if obj.get("entry_type") != entry_type:
                        continue
                    if obj.get("path") != path:
                        continue
                    if obj.get("body") != body:
                        continue
                    ts = obj.get("ts")
                    if not isinstance(ts, str):
                        continue
                    try:
                        emitted = dt.datetime.fromisoformat(ts)
                    except ValueError:
                        continue
                    if emitted >= cutoff:
                        return True
        except OSError:
            continue
    return False


def emit(entry_type: str, path: str, body: str,
         extra: dict[str, Any] | None = None,
         origin: str = "agent",
         force: bool = False) -> dict[str, Any] | None:
    """Append a signal entry. Returns the written record, or None when skipped.

    On `present` backend, routing to the package is a no-op here today —
    the package adapter is wired in `road-to-agent-memory-integration.md`
    Phase 3. For now, the file path is the single source of truth so
    merge-safety is preserved in every mode.
    """
    if entry_type not in VALID_TYPES:
        raise ValueError(f"unknown memory type: {entry_type}")
    if not path or not body:
        raise ValueError("path and body are required")
    if not force and _recently_emitted(entry_type, path, body):
        return None
    record: dict[str, Any] = {
        "id": _new_id(),
        "ts": _now_iso(),
        "origin": origin,
        "entry_type": entry_type,
        "path": path,
        "body": body,
    }
    if extra:
        # Reserved keys stay intact; extras only fill unclaimed slots.
        for k, v in extra.items():
            record.setdefault(k, v)
    INTAKE_ROOT.mkdir(parents=True, exist_ok=True)
    target = _monthly_file()
    with target.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False) + "\n")
    return record


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--type", dest="entry_type", required=True,
                    choices=sorted(VALID_TYPES))
    ap.add_argument("--path", required=True,
                    help="Affected file/module path (e.g., app/Http/Foo.php)")
    ap.add_argument("--body", required=True, help="One- to few-sentence finding")
    ap.add_argument("--origin", default="agent",
                    help="Producer identifier, e.g., bug-fix, do-and-judge")
    ap.add_argument("--extra", default="",
                    help="Optional JSON blob of extra keys (symptom, owner, ...)")
    ap.add_argument("--force", action="store_true",
                    help="Bypass rate-limit dedupe")
    args = ap.parse_args()
    extra: dict[str, Any] = {}
    if args.extra:
        try:
            extra = json.loads(args.extra)
            if not isinstance(extra, dict):
                raise ValueError
        except ValueError:
            print("error: --extra must be a JSON object", file=sys.stderr)
            return 2
    rec = emit(args.entry_type, args.path, args.body,
               extra=extra, origin=args.origin, force=args.force)
    if rec is None:
        print(f"  ℹ️  skipped (already emitted within "
              f"{RATE_LIMIT_WINDOW_DAYS}d): {args.entry_type} @ {args.path}")
        return 0
    print(f"  ✅  signal emitted: id={rec['id']} type={rec['entry_type']} "
          f"path={rec['path']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
