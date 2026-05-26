#!/usr/bin/env python3
"""Emit `cost-summary/v1` JSON per `docs/contracts/cost-summary-schema.md`.

Reads `agents/cost-tracking/sessions.jsonl` (or `--input`), aggregates by
session, conversation, and model. Honors the telegraph suspended-multiplier
contract (delta = 0 while suspended; see `telegraph-telemetry.md`).
"""
from __future__ import annotations
import argparse, json, sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_JSONL = REPO_ROOT / "agents" / "cost-tracking" / "sessions.jsonl"
SCHEMA = "cost-summary/v1"
MULTIPLIER_VERSION = "v1"
MULTIPLIER_ACTIVE = False


def _load(path: Path) -> list[dict]:
    if not path.is_file():
        return []
    out = []
    for line in path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        try:
            out.append(json.loads(s))
        except json.JSONDecodeError:
            continue
    return out


def _delta(row: dict) -> int:
    if not MULTIPLIER_ACTIVE:
        return 0
    return int(row.get("telegraph_delta_tokens") or 0)


def _zero_kv() -> dict:
    return {"sessions": 0, "total_cost_usd": 0.0, "input_tokens": 0,
            "output_tokens": 0, "telegraph_delta_tokens": 0}


def _zero_model() -> dict:
    return {"sessions": 0, "total_cost_usd": 0.0, "input_tokens": 0, "output_tokens": 0}


def aggregate(rows: list[dict]) -> dict:
    by_sess: dict = defaultdict(_zero_kv)
    by_conv: dict = defaultdict(_zero_kv)
    by_model: dict = defaultdict(_zero_model)
    totals = _zero_kv()
    for row in rows:
        sid = str(row.get("sessionId") or row.get("session_id") or "unknown")
        cid = str(row.get("conversation_id") or "unknown")
        model = str(row.get("model") or "unknown")
        cost = float(row.get("total_cost_usd") or 0)
        itok = int(row.get("input_tokens") or 0)
        otok = int(row.get("output_tokens") or 0)
        delta = _delta(row)
        for bucket in (by_sess[sid], by_conv[cid], totals):
            bucket["sessions"] += 1
            bucket["total_cost_usd"] += cost
            bucket["input_tokens"] += itok
            bucket["output_tokens"] += otok
            bucket["telegraph_delta_tokens"] += delta
        m = by_model[model]
        m["sessions"] += 1
        m["total_cost_usd"] += cost
        m["input_tokens"] += itok
        m["output_tokens"] += otok
    totals["telegraph_multiplier_version"] = MULTIPLIER_VERSION
    totals["telegraph_multiplier_active"] = MULTIPLIER_ACTIVE
    return {
        "schema_version": SCHEMA,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "totals": totals,
        "by_session": [{"key": k, **v} for k, v in sorted(by_sess.items())],
        "by_conversation": [{"key": k, **v} for k, v in sorted(by_conv.items())],
        "by_model": [{"model": k, **v} for k, v in sorted(by_model.items())],
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--input", type=Path, default=DEFAULT_JSONL)
    p.add_argument("--format", choices=["json"], default="json")
    args = p.parse_args(argv)
    print(json.dumps(aggregate(_load(args.input)), indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
