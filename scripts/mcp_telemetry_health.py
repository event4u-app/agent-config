"""MCP telemetry healthcheck — Phase 1 J6.

Asserts that the per-consumer JSONL sink at
``<consumer_root>/agents/.mcp-telemetry/calls.jsonl`` received at least
one record inside a configurable window (default 24 h). Exits non-zero
on silence so the caller's alert sink — Sentry, email, GitHub Actions
failure, cron mailer — fires.

Per ``agents/roadmaps/road-to-mcp-full-coverage.md`` §Phase 1 J6, the
healthcheck protects Phase 2 K1 against waking to an empty dataset: a
silent telemetry pipeline must be visible *during* Phase 1, not after
the observation window closes.

Usage:

  python3 scripts/mcp_telemetry_health.py                # 24h window
  python3 scripts/mcp_telemetry_health.py --window-hours 6
  python3 scripts/mcp_telemetry_health.py --allow-missing  # CI mode
  python3 scripts/mcp_telemetry_health.py --json           # machine-readable
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# Re-use the canonical sink location so a contract change in
# telemetry.py propagates automatically.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from mcp_server.telemetry import (  # noqa: E402
    TELEMETRY_FILENAME,
    TELEMETRY_REL_DIR,
)

DEFAULT_WINDOW_HOURS = 24
_ISO_FMT = "%Y-%m-%dT%H:%M:%SZ"


@dataclass(frozen=True)
class HealthReport:
    """Outcome of a single healthcheck run. Serialised when --json fires."""

    status: str  # "healthy" | "silent" | "missing" | "unreadable"
    path: str
    window_hours: int
    records_in_window: int
    last_ts: str | None
    message: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "path": self.path,
            "window_hours": self.window_hours,
            "records_in_window": self.records_in_window,
            "last_ts": self.last_ts,
            "message": self.message,
        }


def _parse_iso(ts: str) -> float | None:
    """Best-effort ISO-8601 → epoch. Returns None for malformed input."""
    try:
        return time.mktime(time.strptime(ts, _ISO_FMT)) - time.timezone
    except (ValueError, TypeError):
        return None


def resolve_log_path(consumer_root: Path | None = None) -> Path:
    """Pick the JSONL location — matches telemetry.py's resolver."""
    root = (consumer_root or Path.cwd()).resolve()
    return root / TELEMETRY_REL_DIR / TELEMETRY_FILENAME


def evaluate(
    *,
    consumer_root: Path | None = None,
    window_hours: int = DEFAULT_WINDOW_HOURS,
    now: float | None = None,
) -> HealthReport:
    """Return a HealthReport — pure function, no exit calls."""
    target = resolve_log_path(consumer_root)
    cutoff = (now if now is not None else time.time()) - window_hours * 3600

    if not target.exists():
        return HealthReport(
            status="missing",
            path=str(target),
            window_hours=window_hours,
            records_in_window=0,
            last_ts=None,
            message=(
                f"Telemetry sink not found at {target}. "
                "Either the MCP server has never run, or the consumer root is wrong."
            ),
        )

    try:
        lines = target.read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        return HealthReport(
            status="unreadable",
            path=str(target),
            window_hours=window_hours,
            records_in_window=0,
            last_ts=None,
            message=f"Telemetry sink unreadable: {exc}",
        )

    in_window = 0
    last_ts: str | None = None
    for line in lines:
        if not line.strip():
            continue
        try:
            record = json.loads(line)
        except ValueError:
            continue
        ts = record.get("ts")
        if not isinstance(ts, str):
            continue
        epoch = _parse_iso(ts)
        if epoch is None:
            continue
        if last_ts is None or ts > last_ts:
            last_ts = ts
        if epoch >= cutoff:
            in_window += 1

    if in_window == 0:
        return HealthReport(
            status="silent",
            path=str(target),
            window_hours=window_hours,
            records_in_window=0,
            last_ts=last_ts,
            message=(
                f"No telemetry records in the past {window_hours}h. "
                "Phase 2 K1 dataset is at risk — verify the MCP server is reachable "
                "and that consumers are calling tools."
            ),
        )

    return HealthReport(
        status="healthy",
        path=str(target),
        window_hours=window_hours,
        records_in_window=in_window,
        last_ts=last_ts,
        message=f"{in_window} record(s) logged in the past {window_hours}h.",
    )


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "MCP telemetry healthcheck — exits non-zero if no calls were "
            "logged in the configured window."
        ),
    )
    parser.add_argument(
        "--consumer-root",
        type=Path,
        default=None,
        help="Root directory containing agents/.mcp-telemetry/ (default: cwd).",
    )
    parser.add_argument(
        "--window-hours",
        type=int,
        default=DEFAULT_WINDOW_HOURS,
        help=f"Hours back to scan (default: {DEFAULT_WINDOW_HOURS}).",
    )
    parser.add_argument(
        "--allow-missing",
        action="store_true",
        help="Treat 'sink missing' as success — useful for first-run / CI smoke.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit the HealthReport as JSON instead of plain text.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    report = evaluate(
        consumer_root=args.consumer_root,
        window_hours=args.window_hours,
    )

    if args.json:
        print(json.dumps(report.as_dict(), separators=(",", ":")))
    else:
        icon = {"healthy": "✅", "silent": "❌", "missing": "⚠️", "unreadable": "❌"}[report.status]
        print(f"{icon}  {report.message}")
        if report.last_ts:
            print(f"   last record: {report.last_ts}")
        print(f"   sink: {report.path}")

    if report.status == "healthy":
        return 0
    if report.status == "missing" and args.allow_missing:
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
