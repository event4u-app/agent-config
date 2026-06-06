#!/usr/bin/env python3
"""``./agent-config telemetry:status`` — read-only status report.

Prints the current ``telemetry.artifact_engagement`` configuration
plus log statistics. Safe even when telemetry is disabled — never
creates the log, never validates, never writes. ``--format json`` is
the machine-readable contract.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from telemetry.engagement import EngagementSchemaError, parse_event
from telemetry.settings import TelemetrySettings, read_settings


def _last_event_ts(log_path: Path) -> str | None:
    """Return the ``ts`` of the last well-formed event, or None.

    Reads from the tail to keep the cost bounded on long logs. We
    skip malformed lines silently — Phase 4 surfaces those via the
    aggregator's ``--strict`` flag.
    """
    if not log_path.is_file():
        return None
    try:
        with log_path.open("rb") as fh:
            fh.seek(0, 2)  # EOF
            size = fh.tell()
            chunk_size = min(size, 4096)
            fh.seek(size - chunk_size)
            tail = fh.read().decode("utf-8", errors="replace")
    except OSError:
        return None
    for line in reversed(tail.splitlines()):
        line = line.strip()
        if not line:
            continue
        try:
            event = parse_event(line + "\n")
        except EngagementSchemaError:
            continue
        return event.ts
    return None


def _log_stats(log_path: Path) -> dict[str, Any]:
    if not log_path.is_file():
        return {"exists": False, "size_bytes": 0, "line_count": 0}
    try:
        size = log_path.stat().st_size
        with log_path.open("rb") as fh:
            line_count = sum(1 for _ in fh)
    except OSError as exc:
        return {"exists": True, "error": str(exc)}
    return {"exists": True, "size_bytes": size, "line_count": line_count}


def _build_report(settings: TelemetrySettings) -> dict[str, Any]:
    log_path = settings.log_path
    return {
        "enabled": settings.enabled,
        "section_present": settings.section_present,
        "granularity": settings.granularity,
        "record": {
            "consulted": settings.record_consulted,
            "applied": settings.record_applied,
        },
        "log": {
            "path": str(log_path),
            **_log_stats(log_path),
            "last_event_ts": _last_event_ts(log_path),
        },
    }


def _render_text(report: dict[str, Any]) -> str:
    lines: list[str] = []
    enabled = "✅  enabled" if report["enabled"] else "⛔  disabled"
    if not report["section_present"]:
        enabled += " (no telemetry section in .agent-settings.yml — using defaults)"
    lines.append(f"  artifact-engagement: {enabled}")
    lines.append(f"  granularity:         {report['granularity']}")
    rec = report["record"]
    lines.append(
        f"  record:              consulted={rec['consulted']} "
        f"applied={rec['applied']}"
    )
    log = report["log"]
    lines.append(f"  log path:            {log['path']}")
    if log.get("exists"):
        if "error" in log:
            lines.append(f"  log error:           {log['error']}")
        else:
            lines.append(
                f"  log size:            {log['size_bytes']} bytes "
                f"({log['line_count']} events)"
            )
            if log.get("last_event_ts"):
                lines.append(f"  last event ts:       {log['last_event_ts']}")
    else:
        lines.append("  log:                 not yet created")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="agent-config telemetry:status",
        description=(
            "Print the artifact-engagement telemetry status. Read-only "
            "— never creates the log, never modifies settings."
        ),
    )
    parser.add_argument("--format", choices=("text", "json"), default="text")
    parser.add_argument(
        "--settings",
        type=Path,
        default=Path(".agent-settings.yml"),
        help="Override settings path (tests).",
    )
    args = parser.parse_args(argv)

    try:
        settings = read_settings(args.settings)
    except OSError as exc:
        print(f"❌  cannot read settings: {exc}", file=sys.stderr)
        return 2

    report = _build_report(settings)
    if args.format == "json":
        print(json.dumps(report, sort_keys=True, indent=2))
    else:
        print(_render_text(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
