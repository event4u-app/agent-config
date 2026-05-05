#!/usr/bin/env python3
"""Refresh `agents/.agent-prices.md` from the LiteLLM model-prices feed.

Source: https://raw.githubusercontent.com/BerriAI/litellm/main/
        model_prices_and_context_window.json

Network failure or invalid response → fall back to
`scripts.ai_council._default_prices.DEFAULT_PRICES` so the file is
always written. Stdlib only; no extra dependency.

Usage:
    python3 scripts/update_prices.py            # writes agents/.agent-prices.md
    python3 scripts/update_prices.py --check    # exit 1 if file is stale
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from scripts.ai_council._default_prices import DEFAULT_PRICES, as_rows  # noqa: E402
from scripts.ai_council.pricing import (  # noqa: E402
    PRICES_FILE,
    _render_markdown,
    is_stale,
    load_prices,
)

LITELLM_URL = (
    "https://raw.githubusercontent.com/BerriAI/litellm/main/"
    "model_prices_and_context_window.json"
)
HTTP_TIMEOUT_SECONDS = 10

# Models we surface in the table. Anything not in this allow-list is
# dropped from the LiteLLM payload; users can add more by editing the
# Markdown file directly.
ALLOW_LIST: set[tuple[str, str]] = set(DEFAULT_PRICES.keys())


def _fetch_litellm() -> dict[str, dict[str, object]] | None:
    try:
        req = urllib.request.Request(LITELLM_URL, headers={"User-Agent": "agent-config"})
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT_SECONDS) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        if not isinstance(data, dict):
            return None
        return data
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        print(f"[update_prices] upstream unreachable: {exc}", file=sys.stderr)
        return None


def _to_rows_from_litellm(payload: dict[str, dict[str, object]]) -> list[tuple[str, str, float, float]]:
    """Translate LiteLLM keys into our (provider, model, input_per_1m, output_per_1m) tuples."""
    rows: list[tuple[str, str, float, float]] = []
    for key, entry in payload.items():
        if not isinstance(entry, dict):
            continue
        provider = str(entry.get("litellm_provider", "")).lower()
        # LiteLLM keys are sometimes "provider/model"; strip the prefix.
        model = key.split("/", 1)[1] if "/" in key else key
        if (provider, model) not in ALLOW_LIST:
            continue
        in_cost = entry.get("input_cost_per_token")
        out_cost = entry.get("output_cost_per_token")
        if not isinstance(in_cost, (int, float)) or not isinstance(out_cost, (int, float)):
            continue
        # LiteLLM ships per-token USD; convert to per-1M.
        rows.append((provider, model, float(in_cost) * 1_000_000, float(out_cost) * 1_000_000))
    rows.sort()
    return rows


def refresh(path: Path = PRICES_FILE) -> str:
    """Write a fresh `agents/.agent-prices.md`. Returns the source label used."""
    payload = _fetch_litellm()
    if payload is not None:
        rows = _to_rows_from_litellm(payload)
        if rows:
            today = _dt.datetime.now(_dt.timezone.utc).date().isoformat()
            path.write_text(_render_markdown(today, "litellm-github", rows), encoding="utf-8")
            return "litellm-github"
    # Network or filter failed → shipped defaults.
    today = _dt.datetime.now(_dt.timezone.utc).date().isoformat()
    path.write_text(_render_markdown(today, "shipped-default", as_rows()), encoding="utf-8")
    return "shipped-default"


def _cmd_check(path: Path) -> int:
    if not path.exists():
        print(f"[update_prices] {path} missing — run `python3 scripts/update_prices.py`")
        return 1
    table = load_prices(path)
    if is_stale(table):
        print(f"[update_prices] {path} stale (last_updated={table.last_updated})")
        return 1
    print(f"[update_prices] {path} fresh (last_updated={table.last_updated})")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="exit 1 if stale")
    parser.add_argument("--path", default=str(PRICES_FILE), help="override target path")
    args = parser.parse_args()
    target = Path(args.path)
    if args.check:
        return _cmd_check(target)
    src = refresh(target)
    print(f"[update_prices] wrote {target} (source={src})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
