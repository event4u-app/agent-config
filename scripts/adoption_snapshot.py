#!/usr/bin/env python3
"""Pull the four public adoption signals into a single dated JSONL row.

Phase D Step 2 of ``road-to-adoption-proof-and-ci-green.md``.
Signals (per ``docs/contracts/adoption-signal-floor.md``):

  1. npm install count          — last 7 days, full lifetime.
  2. npm version distribution    — latest published version.
  3. GitHub stars / forks        — current count.
  4. Topic-search rank           — best-rank position for the two
     project-scoped topics (`agent-skills`, `cinematic-ai-video`).

Output: one JSONL row appended to
``agents/runtime/metrics/adoption-snapshots.jsonl``. Each row carries
an ISO-8601 ``snapshot_at`` timestamp + the four signal payloads.

CLI:

  scripts/adoption_snapshot.py [--out <path>] [--no-network]

  --no-network          Skip the four HTTP calls; emit a row with
                        ``error: "skipped"`` on each signal. Used by
                        the pytest path so tests never hit the wire.
  --out                 Override the output JSONL path (default:
                        ``agents/runtime/metrics/adoption-snapshots.jsonl``).

Exit codes:

  0 — row appended successfully.
  1 — IO failure writing the JSONL.
  2 — every signal failed (network outage; the row is appended but
      annotated, so trend reports can spot the outage).
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
from pathlib import Path
from typing import Any
from urllib.error import URLError, HTTPError
from urllib.request import Request, urlopen


REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = REPO_ROOT / "agents" / "runtime" / "metrics" / "adoption-snapshots.jsonl"

NPM_PACKAGE = "@event4u/agent-config"
NPM_DOWNLOADS_URL = f"https://api.npmjs.org/downloads/range/last-week/{NPM_PACKAGE}"
NPM_REGISTRY_URL = f"https://registry.npmjs.org/{NPM_PACKAGE.replace('/', '%2F')}"
GH_REPO = "event4u-app/agent-config"
GH_REPO_URL = f"https://api.github.com/repos/{GH_REPO}"
GH_TOPICS = ("agent-skills", "cinematic-ai-video")
GH_SEARCH_URL_TEMPLATE = "https://api.github.com/search/repositories?q=topic:{topic}&sort=stars&order=desc&per_page=100"

TIMEOUT_S = 10


def _utc_now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _http_get_json(url: str, headers: dict[str, str] | None = None) -> dict[str, Any]:
    req = Request(url, headers=headers or {})
    with urlopen(req, timeout=TIMEOUT_S) as resp:
        body = resp.read().decode("utf-8")
    return json.loads(body)


def fetch_npm_downloads() -> dict[str, Any]:
    try:
        data = _http_get_json(NPM_DOWNLOADS_URL)
        downloads = data.get("downloads", [])
        total_7d = sum(d.get("downloads", 0) for d in downloads if isinstance(d, dict))
        return {"package": NPM_PACKAGE, "last_7_days": total_7d, "source": "npm"}
    except (URLError, HTTPError, ValueError) as exc:
        return {"package": NPM_PACKAGE, "error": str(exc)[:120], "source": "npm"}


def fetch_npm_version() -> dict[str, Any]:
    try:
        data = _http_get_json(NPM_REGISTRY_URL)
        latest = data.get("dist-tags", {}).get("latest", "")
        versions = list(data.get("versions", {}).keys())
        return {
            "latest": latest,
            "version_count": len(versions),
            "source": "npm-registry",
        }
    except (URLError, HTTPError, ValueError) as exc:
        return {"error": str(exc)[:120], "source": "npm-registry"}


def fetch_github_stars() -> dict[str, Any]:
    try:
        headers = {"Accept": "application/vnd.github+json"}
        token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
        if token:
            headers["Authorization"] = f"Bearer {token}"
        data = _http_get_json(GH_REPO_URL, headers=headers)
        return {
            "repo": GH_REPO,
            "stars": data.get("stargazers_count", 0),
            "forks": data.get("forks_count", 0),
            "watchers": data.get("watchers_count", 0),
            "source": "github-repo",
        }
    except (URLError, HTTPError, ValueError) as exc:
        return {"repo": GH_REPO, "error": str(exc)[:120], "source": "github-repo"}


def fetch_topic_rank() -> dict[str, Any]:
    out: dict[str, Any] = {"source": "github-search"}
    for topic in GH_TOPICS:
        try:
            headers = {"Accept": "application/vnd.github+json"}
            token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
            if token:
                headers["Authorization"] = f"Bearer {token}"
            data = _http_get_json(GH_SEARCH_URL_TEMPLATE.format(topic=topic), headers=headers)
            items = data.get("items", [])
            rank = next(
                (i + 1 for i, item in enumerate(items) if item.get("full_name") == GH_REPO),
                None,
            )
            out[topic] = {
                "rank": rank,
                "total_results": data.get("total_count", 0),
            }
        except (URLError, HTTPError, ValueError) as exc:
            out[topic] = {"error": str(exc)[:120]}
    return out


def collect_signals(skip_network: bool) -> dict[str, Any]:
    if skip_network:
        skipped = {"error": "skipped", "source": "skipped"}
        return {
            "npm_downloads": skipped,
            "npm_version": skipped,
            "github_stars": skipped,
            "topic_rank": skipped,
        }
    return {
        "npm_downloads": fetch_npm_downloads(),
        "npm_version": fetch_npm_version(),
        "github_stars": fetch_github_stars(),
        "topic_rank": fetch_topic_rank(),
    }


def build_row(signals: dict[str, Any]) -> dict[str, Any]:
    return {
        "snapshot_at": _utc_now_iso(),
        "schema": "adoption-snapshot/v0",
        "signals": signals,
    }


def append_row(out_path: Path, row: dict[str, Any]) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(row) + "\n")


def all_signals_failed(signals: dict[str, Any]) -> bool:
    """True when every signal (or every topic in topic_rank) errored.

    A signal block carries `error` when its HTTP call failed. For
    `topic_rank`, the outer dict does NOT carry `error`; instead each
    nested per-topic entry does. The outage predicate counts the
    composite as a failure when every nested topic errored.
    """
    for name, value in signals.items():
        if not isinstance(value, dict):
            return False  # Unknown shape — treat as success to be conservative.
        if name == "topic_rank":
            # Outage when every nested topic errored.
            nested = [v for k, v in value.items() if k != "source" and isinstance(v, dict)]
            if not nested:
                return False
            if any("error" not in v for v in nested):
                return False
        else:
            if "error" not in value:
                return False
    return True


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(prog="adoption_snapshot")
    p.add_argument("--out", type=Path, default=DEFAULT_OUT, help="JSONL output path.")
    p.add_argument(
        "--no-network",
        action="store_true",
        help="Skip the four HTTP calls (used by the pytest path).",
    )
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    signals = collect_signals(skip_network=args.no_network)
    row = build_row(signals)
    try:
        append_row(args.out, row)
    except OSError as exc:
        print(f"error: failed to append snapshot: {exc}", file=sys.stderr)
        return 1
    print(f"appended snapshot @ {row['snapshot_at']} → {args.out}")
    if not args.no_network and all_signals_failed(signals):
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
