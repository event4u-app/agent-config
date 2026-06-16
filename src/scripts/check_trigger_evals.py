#!/usr/bin/env python3
"""Trigger-eval freshness + structural smoke gate (road-to-contract-integrity F4).

`triggers.json` files encode each skill's *behavioural intent* ("when
should this skill activate?"), not just static predicates — and the
surrounding repo context drifts (a monorepo grows test files, a sibling
skill is added), so trigger sets need regression-locking even though the
predicates themselves do not decay (2026-06-16 council, contested then
upheld). This gate is the regression lock.

For every `src/skills/*/evals/triggers.json` it asserts:
  1. **Freshness** — a top-level `last_eval` ISO date (`YYYY-MM-DD`) is
     present and no older than `MAX_AGE_DAYS` (90). A missing or stale
     `last_eval` fails: the trigger set has not been validated recently.
  2. **Structural smoke** (offline, no API) — `queries` is a non-empty
     list; every entry has a non-empty `q` and a boolean `trigger`; and
     **both** classes are represented (≥1 should-trigger and ≥1
     should-not-trigger). This is the lightweight smoke-eval; the
     model-based routing eval (`skill_trigger_eval.py`) is separate and
     key-gated, never run in CI.

`--today YYYY-MM-DD` overrides the reference date (tests / reproducible
runs). Stdlib only, ≤150 LOC. Hooked into `task ci-fast` via
`task check-trigger-evals`.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
GLOB = "src/skills/*/evals/triggers.json"
MAX_AGE_DAYS = 90


def _parse_iso(value: str) -> date | None:
    try:
        return date.fromisoformat(value)
    except (ValueError, TypeError):
        return None


def _check_one(path: Path, today: date) -> list[str]:
    rel = path.relative_to(REPO_ROOT)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        return [f"{rel}: unreadable JSON ({exc})"]

    errors: list[str] = []

    raw = data.get("last_eval")
    when = _parse_iso(raw) if isinstance(raw, str) else None
    if when is None:
        errors.append(f"{rel}: missing or non-ISO `last_eval` (got {raw!r})")
    else:
        age = (today - when).days
        if age > MAX_AGE_DAYS:
            errors.append(
                f"{rel}: `last_eval` {raw} is {age}d old (> {MAX_AGE_DAYS}d) "
                f"— re-run skill_trigger_eval.py and bump it"
            )

    # Two supported shapes: a single `queries` list of {q, trigger:bool},
    # or split `should_trigger` / `should_not_trigger` lists of query strings.
    pos = neg = 0
    if "queries" in data:
        queries = data.get("queries")
        if not isinstance(queries, list) or not queries:
            errors.append(f"{rel}: `queries` must be a non-empty list")
            return errors
        for i, q in enumerate(queries):
            if not isinstance(q, dict) or not q.get("q"):
                errors.append(f"{rel}: query #{i} missing non-empty `q`")
                continue
            trig = q.get("trigger")
            if not isinstance(trig, bool):
                errors.append(f"{rel}: query #{i} `trigger` must be a boolean")
                continue
            pos += trig
            neg += not trig
    elif "should_trigger" in data or "should_not_trigger" in data:
        for key, sign in (("should_trigger", 1), ("should_not_trigger", -1)):
            items = data.get(key)
            if not isinstance(items, list) or not items:
                errors.append(f"{rel}: `{key}` must be a non-empty list")
                continue
            for i, it in enumerate(items):
                q = it.get("q") if isinstance(it, dict) else it
                if not isinstance(q, str) or not q.strip():
                    errors.append(f"{rel}: `{key}` #{i} is not a non-empty query")
                    continue
                pos += sign > 0
                neg += sign < 0
    else:
        errors.append(
            f"{rel}: no `queries` nor `should_trigger`/`should_not_trigger`"
        )
        return errors

    if pos == 0 or neg == 0:
        errors.append(
            f"{rel}: needs both classes (have {pos} should-trigger, "
            f"{neg} should-not-trigger)"
        )
    return errors


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--today", help="reference date YYYY-MM-DD (default: today)")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    today = _parse_iso(args.today) if args.today else date.today()
    if today is None:
        print(f"❌ check-trigger-evals: bad --today {args.today!r}", file=sys.stderr)
        return 2

    files = sorted(REPO_ROOT.glob(GLOB))
    errors: list[str] = []
    for path in files:
        errors.extend(_check_one(path, today))

    if errors:
        print("❌ check-trigger-evals: trigger-set regression(s):", file=sys.stderr)
        for e in errors:
            print(f"   - {e}", file=sys.stderr)
        return 1

    if not args.quiet:
        print(f"✅ check-trigger-evals: {len(files)} trigger set(s) fresh + valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
