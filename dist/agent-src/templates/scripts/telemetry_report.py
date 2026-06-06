#!/usr/bin/env python3
"""``./agent-config telemetry:report`` — aggregate the engagement log.

Reads ``.agent-engagement.jsonl``, groups events by ``(kind, id)``,
quartile-buckets the artefacts (essential / useful / retirement
candidate), and prints a markdown table or JSON document.

Usage:
    # Defaults: --since 30d --top 20 markdown
    ./agent-config telemetry:report

    # Last 7 days, JSON, no truncation
    ./agent-config telemetry:report --since 7d --format json --top 0

    # Override log path (tests; consumer copies; reports on archived logs)
    ./agent-config telemetry:report --log-path /tmp/snapshot.jsonl

Exit codes:
    0   success (empty log → empty-but-valid report)
    2   IO / settings parse error, unparseable --since, or
        redaction-validator failure on a row sourced from the log
        (a path-shaped or extension-shaped id slipped past the write
        gate; the report is refused rather than shared)
"""
from __future__ import annotations

import argparse
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from telemetry.aggregator import aggregate
from telemetry.engagement import EngagementSchemaError
from telemetry.report_renderer import render_json, render_markdown
from telemetry.settings import read_settings

_DURATION_RE = re.compile(r"^\s*(\d+)\s*([dhm])\s*$")


def _parse_since(value: str | None) -> tuple[datetime | None, str | None]:
    """Parse ``30d`` / ``7d`` / ``24h`` / ``60m`` into a UTC cutoff.

    Returns ``(cutoff_or_None, human_label)``. ``value`` of ``None`` or
    ``"all"`` means "no lower bound" — both cutoff and label are
    ``None``. Raises ``ValueError`` on malformed input so the CLI can
    surface a clean error and exit 2.
    """
    if value is None or value.strip().lower() == "all":
        return None, None
    match = _DURATION_RE.match(value)
    if not match:
        raise ValueError(
            f"--since must be <int>{{d,h,m}} or 'all', got {value!r}"
        )
    qty = int(match.group(1))
    unit = match.group(2)
    delta = {
        "d": timedelta(days=qty),
        "h": timedelta(hours=qty),
        "m": timedelta(minutes=qty),
    }[unit]
    cutoff = datetime.now(tz=timezone.utc) - delta
    label = f"last {qty}{unit}"
    return cutoff, label


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="agent-config telemetry:report",
        description=(
            "Render an artefact-engagement report from the JSONL log. "
            "Read-only; never mutates settings or the log."
        ),
    )
    parser.add_argument(
        "--since",
        default="30d",
        help=(
            "Lower-bound time window: <int>{d,h,m} or 'all'. "
            "Default: 30d. Events at or before the cutoff are excluded."
        ),
    )
    parser.add_argument(
        "--top",
        type=int,
        default=20,
        help=(
            "Truncate each bucket to N rows. Default: 20. Use 0 to "
            "disable truncation."
        ),
    )
    parser.add_argument(
        "--format",
        choices=("markdown", "json"),
        default="markdown",
    )
    parser.add_argument(
        "--log-path",
        type=Path,
        default=None,
        help=(
            "Override the log path. Default: read "
            "telemetry.artifact_engagement.output.path from "
            ".agent-settings.yml (falls back to .agent-engagement.jsonl)."
        ),
    )
    parser.add_argument(
        "--settings",
        type=Path,
        default=Path(".agent-settings.yml"),
        help="Override settings path (tests).",
    )
    args = parser.parse_args(argv)

    try:
        cutoff, since_label = _parse_since(args.since)
    except ValueError as exc:
        print(f"❌  {exc}", file=sys.stderr)
        return 2

    if args.log_path is not None:
        log_path = args.log_path
    else:
        try:
            settings = read_settings(args.settings)
        except OSError as exc:
            print(f"❌  cannot read settings: {exc}", file=sys.stderr)
            return 2
        log_path = settings.log_path

    try:
        result = aggregate(log_path, since=cutoff)
    except OSError as exc:
        print(f"❌  cannot read log {log_path}: {exc}", file=sys.stderr)
        return 2

    top = None if args.top <= 0 else args.top
    try:
        if args.format == "json":
            rendered = render_json(result, top=top, since_label=since_label)
        else:
            rendered = render_markdown(result, top=top, since_label=since_label)
    except EngagementSchemaError as exc:
        print(
            f"❌  redaction validator refused report: {exc}",
            file=sys.stderr,
        )
        return 2
    sys.stdout.write(rendered)

    if result.skipped_lines:
        print(
            f"⚠️   skipped {result.skipped_lines} malformed line(s)",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
