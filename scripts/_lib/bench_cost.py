# Cost capture for `scripts/bench_run.py` — step-4 Phase 2 Step 2.
#
# Reads Claude Code session jsonl summaries (one summary line per session)
# from agents/cost-tracking/sessions.jsonl — produced by scripts/cost/track.mjs
# — and aggregates totals using model rates from internal/bench/pricing.yaml.
#
# Returns the dict shape declared in docs/contracts/benchmark-report-schema.md
# § JSON schema (v1) `cost`. When the source jsonl is missing, returns the
# `unavailable` sentinel block (NEVER silently drops, per schema invariant).
"""Cost capture helper for the bench runner."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:  # pragma: no cover — bench_run handles the same import
    yaml = None  # type: ignore[assignment]

UNKNOWN_TIER = "unknown"
TIER_KEYS = ("haiku", "sonnet", "opus", UNKNOWN_TIER)


def load_pricing(pricing_path: Path) -> tuple[dict[str, dict[str, float]], str | None]:
    """Return ({tier: rates}, oldest_sourced_on) from internal/bench/pricing.yaml."""
    if yaml is None or not pricing_path.is_file():
        return {}, None
    data = yaml.safe_load(pricing_path.read_text(encoding="utf-8")) or {}
    rates: dict[str, dict[str, float]] = {}
    oldest: str | None = None
    for row in data.get("models", []):
        tier = row.get("tier")
        if not tier:
            continue
        rates[tier] = {
            "input": float(row.get("input", 0.0)),
            "output": float(row.get("output", 0.0)),
            "cache_write": float(row.get("cache_write", 0.0)),
            "cache_read": float(row.get("cache_read", 0.0)),
        }
        sourced = row.get("sourced_on")
        # YAML 1.1 parses ISO dates to datetime.date; coerce to ISO string.
        if sourced is not None and not isinstance(sourced, str):
            sourced = sourced.isoformat() if hasattr(sourced, "isoformat") else str(sourced)
        if isinstance(sourced, str) and (oldest is None or sourced < oldest):
            oldest = sourced
    return rates, oldest


def _empty_totals() -> dict[str, int | float]:
    return {
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_read_input_tokens": 0,
        "cache_creation_input_tokens": 0,
        "total_cost_usd": 0.0,
    }


def _empty_per_tier() -> dict[str, dict[str, int | float]]:
    return {t: {"messages": 0, "cost_usd": 0.0} for t in TIER_KEYS}


def unavailable_block(reason: str, source: str, pricing_sourced_on: str | None) -> dict[str, Any]:
    """Schema-compliant `cost` block when no session jsonl is readable."""
    return {
        "source": "unavailable",
        "reason": reason,
        "scanned_path": source,
        "sessions_scanned": 0,
        "totals": _empty_totals(),
        "per_tier": _empty_per_tier(),
        "pricing_sourced_on": pricing_sourced_on,
    }


def aggregate_sessions(
    sessions_jsonl: Path,
    pricing_path: Path,
) -> dict[str, Any]:
    """Read agents/cost-tracking/sessions.jsonl and aggregate per-tier totals."""
    rates, pricing_sourced_on = load_pricing(pricing_path)
    if not sessions_jsonl.is_file():
        return unavailable_block(
            reason="sessions_jsonl_missing",
            source=str(sessions_jsonl),
            pricing_sourced_on=pricing_sourced_on,
        )

    totals = _empty_totals()
    per_tier = _empty_per_tier()
    sessions_scanned = 0

    for line in sessions_jsonl.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            summary = json.loads(line)
        except json.JSONDecodeError:
            continue
        sessions_scanned += 1
        for _model, slot in (summary.get("byModel") or {}).items():
            tier = slot.get("tier", UNKNOWN_TIER)
            if tier not in per_tier:
                tier = UNKNOWN_TIER
            totals["input_tokens"] += int(slot.get("input_tokens", 0))
            totals["output_tokens"] += int(slot.get("output_tokens", 0))
            totals["cache_read_input_tokens"] += int(slot.get("cache_read_input_tokens", 0))
            totals["cache_creation_input_tokens"] += int(slot.get("cache_creation_input_tokens", 0))
            cost = float(slot.get("cost_usd", 0.0))
            # Recompute from rates if upstream cost is zero AND we have rates;
            # otherwise trust the upstream attribution (it priced at capture time).
            if cost == 0.0 and tier in rates:
                r = rates[tier]
                cost = (
                    int(slot.get("input_tokens", 0)) / 1e6 * r["input"]
                    + int(slot.get("output_tokens", 0)) / 1e6 * r["output"]
                    + int(slot.get("cache_creation_input_tokens", 0)) / 1e6 * r["cache_write"]
                    + int(slot.get("cache_read_input_tokens", 0)) / 1e6 * r["cache_read"]
                )
            per_tier[tier]["messages"] += int(slot.get("messages", 0))
            per_tier[tier]["cost_usd"] += cost
            totals["total_cost_usd"] += cost

    # Round currency to 6 decimals for stable diffs.
    totals["total_cost_usd"] = round(float(totals["total_cost_usd"]), 6)
    for t in per_tier.values():
        t["cost_usd"] = round(float(t["cost_usd"]), 6)

    return {
        "source": str(sessions_jsonl),
        "sessions_scanned": sessions_scanned,
        "totals": totals,
        "per_tier": per_tier,
        "pricing_sourced_on": pricing_sourced_on,
    }
