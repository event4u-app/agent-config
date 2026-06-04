#!/usr/bin/env python3
"""Roll up ``adoption-snapshots.jsonl`` into a Markdown trend report.

Phase D Step 3 of ``road-to-adoption-proof-and-ci-green.md``.
Reads the JSONL produced by ``scripts/adoption_snapshot.py`` and
writes an ``agents/runtime/metrics/adoption-report.md`` snapshot
covering an 8-week rolling window per signal.

Mirrors the shape of ``scripts/skill_usage_report.py``: a single
file, ≤ 200 LOC, no external deps. The report is regenerated on
every invocation (idempotent for a given JSONL state).

CLI:

  scripts/adoption_report.py [--in <path>] [--out <path>] [--weeks 8]

  --in                  JSONL input (default
                        ``agents/runtime/metrics/adoption-snapshots.jsonl``).
  --out                 Markdown output (default
                        ``agents/runtime/metrics/adoption-report.md``).
  --weeks               Window size (default 8).

Exit codes:

  0 — report written.
  1 — IO failure on read or write.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_IN = REPO_ROOT / "agents" / "runtime" / "metrics" / "adoption-snapshots.jsonl"
DEFAULT_OUT = REPO_ROOT / "agents" / "runtime" / "metrics" / "adoption-report.md"


def parse_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if not path.exists():
        return rows
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows


def filter_window(rows: list[dict[str, Any]], weeks: int) -> list[dict[str, Any]]:
    if not rows:
        return rows
    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(weeks=weeks)
    out: list[dict[str, Any]] = []
    for r in rows:
        ts = r.get("snapshot_at", "")
        try:
            when = dt.datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ").replace(
                tzinfo=dt.timezone.utc
            )
        except ValueError:
            continue
        if when >= cutoff:
            out.append(r)
    return out


def render_section(title: str, lines: list[str]) -> str:
    return f"## {title}\n\n" + "\n".join(lines) + "\n\n"


def render_npm_downloads(rows: list[dict[str, Any]]) -> str:
    lines = []
    lines.append("| Snapshot | Last 7 days (npm installs) |")
    lines.append("|---|---:|")
    for r in rows:
        signal = r.get("signals", {}).get("npm_downloads", {})
        if "error" in signal:
            cell = f"_(error: {signal['error'][:40]})_"
        else:
            cell = f"{signal.get('last_7_days', 0):,}"
        lines.append(f"| `{r.get('snapshot_at', '?')}` | {cell} |")
    return render_section("npm install count (last 7 days, weekly snapshot)", lines)


def render_npm_version(rows: list[dict[str, Any]]) -> str:
    lines = []
    lines.append("| Snapshot | Latest version | Version count |")
    lines.append("|---|---|---:|")
    for r in rows:
        signal = r.get("signals", {}).get("npm_version", {})
        if "error" in signal:
            lines.append(f"| `{r.get('snapshot_at', '?')}` | _(error)_ | _(error)_ |")
        else:
            latest = signal.get("latest", "?")
            count = signal.get("version_count", 0)
            lines.append(f"| `{r.get('snapshot_at', '?')}` | `{latest}` | {count} |")
    return render_section("npm version distribution", lines)


def render_github_stars(rows: list[dict[str, Any]]) -> str:
    lines = []
    lines.append("| Snapshot | Stars | Forks | Watchers |")
    lines.append("|---|---:|---:|---:|")
    for r in rows:
        signal = r.get("signals", {}).get("github_stars", {})
        if "error" in signal:
            lines.append(f"| `{r.get('snapshot_at', '?')}` | _(error)_ | _(error)_ | _(error)_ |")
        else:
            lines.append(
                f"| `{r.get('snapshot_at', '?')}` | "
                f"{signal.get('stars', 0):,} | "
                f"{signal.get('forks', 0):,} | "
                f"{signal.get('watchers', 0):,} |"
            )
    return render_section("GitHub stars / forks / watchers", lines)


def render_topic_rank(rows: list[dict[str, Any]]) -> str:
    lines = []
    lines.append("| Snapshot | `agent-skills` rank | `cinematic-ai-video` rank |")
    lines.append("|---|---:|---:|")
    for r in rows:
        signal = r.get("signals", {}).get("topic_rank", {})
        as_block = signal.get("agent-skills", {})
        cav_block = signal.get("cinematic-ai-video", {})
        as_rank = "_(error)_" if "error" in as_block else (as_block.get("rank") or "—")
        cav_rank = "_(error)_" if "error" in cav_block else (cav_block.get("rank") or "—")
        lines.append(
            f"| `{r.get('snapshot_at', '?')}` | {as_rank} | {cav_rank} |"
        )
    return render_section("Topic-search rank (`agent-skills` + `cinematic-ai-video`)", lines)


def render_report(rows: list[dict[str, Any]], weeks: int) -> str:
    header = (
        "# Adoption report — rolling trend\n\n"
        f"> Generated by `scripts/adoption_report.py` from "
        f"`agents/runtime/metrics/adoption-snapshots.jsonl`.\n"
        f"> Window: rolling {weeks} weeks. Source contract: "
        f"`docs/contracts/adoption-signal-floor.md`.\n\n"
    )
    if not rows:
        header += (
            "_No snapshots in the current window — run `python3 scripts/adoption_snapshot.py` "
            "(scheduled weekly via the cron in `.github/workflows/`) to populate the trend._\n"
        )
        return header
    return (
        header
        + render_npm_downloads(rows)
        + render_npm_version(rows)
        + render_github_stars(rows)
        + render_topic_rank(rows)
    )


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(prog="adoption_report")
    p.add_argument("--in", dest="in_path", type=Path, default=DEFAULT_IN)
    p.add_argument("--out", type=Path, default=DEFAULT_OUT)
    p.add_argument("--weeks", type=int, default=8)
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        rows = parse_jsonl(args.in_path)
    except OSError as exc:
        print(f"error: failed to read {args.in_path}: {exc}", file=sys.stderr)
        return 1
    rows = filter_window(rows, args.weeks)
    rows.sort(key=lambda r: r.get("snapshot_at", ""))
    report = render_report(rows, args.weeks)
    try:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(report, encoding="utf-8")
    except OSError as exc:
        print(f"error: failed to write {args.out}: {exc}", file=sys.stderr)
        return 1
    print(f"adoption_report: wrote {args.out} ({len(rows)} snapshot(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main())
