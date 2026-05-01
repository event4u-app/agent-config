#!/usr/bin/env python3
"""``./agent-config telemetry:record`` — append one engagement event.

Reads the ``telemetry.artifact_engagement`` namespace from
``.agent-settings.yml``. When ``enabled: false`` (default) the script
exits 0 silently and performs zero file IO — the default-off doctrine
for this whole feature.

Usage:
    # JSON payload via --payload-file (consumed atomically)
    ./agent-config telemetry:record --payload-file payload.json

    # JSON payload via stdin
    cat payload.json | ./agent-config telemetry:record --stdin

    # Direct construction (idempotent within boundary if reused via
    # the BoundarySession class — at the CLI layer, each call writes
    # one line)
    ./agent-config telemetry:record \\
        --task-id ticket-PROJ-42 --boundary task \\
        --consulted skills:php-coder --consulted rules:scope-control \\
        --applied skills:php-coder

Exit codes:
    0   success or disabled (silent)
    1   schema-validation failure
    2   IO / settings parse error
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Resolve sibling ``telemetry/`` package — Python adds the script's
# directory to sys.path automatically, so this import works whether
# the script is dispatched from the package or from a consumer copy.
from telemetry.boundary import record_event
from telemetry.engagement import (
    EngagementEvent,
    EngagementSchemaError,
    now_utc_iso,
)
from telemetry.settings import TelemetrySettings, read_settings


def _parse_kv_list(values: list[str]) -> dict[str, list[str]]:
    """Turn ``["skills:a", "skills:b", "rules:c"]`` into a kind→ids dict."""
    out: dict[str, list[str]] = {}
    for raw in values:
        if ":" not in raw:
            raise SystemExit(
                f"❌  --consulted/--applied must be 'kind:id', got {raw!r}"
            )
        kind, _, art_id = raw.partition(":")
        kind = kind.strip()
        art_id = art_id.strip()
        if not kind or not art_id:
            raise SystemExit(
                f"❌  empty kind or id in {raw!r}"
            )
        out.setdefault(kind, []).append(art_id)
    return out


def _build_event_from_args(args: argparse.Namespace) -> EngagementEvent:
    return EngagementEvent(
        ts=args.ts or now_utc_iso(),
        task_id=args.task_id,
        boundary_kind=args.boundary,
        consulted=_parse_kv_list(args.consulted or []),
        applied=_parse_kv_list(args.applied or []),
    )


def _build_event_from_payload(raw: str) -> EngagementEvent:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"❌  payload is not valid JSON: {exc}")
    if not isinstance(data, dict):
        raise SystemExit("❌  payload must be a JSON object")
    return EngagementEvent(
        ts=data.get("ts") or now_utc_iso(),
        task_id=data.get("task_id", ""),
        boundary_kind=data.get("boundary_kind", ""),
        consulted=data.get("consulted", {}) or {},
        applied=data.get("applied", {}) or {},
        tokens_estimate=data.get("tokens_estimate"),
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="agent-config telemetry:record",
        description=(
            "Append one artefact-engagement event to the local JSONL log. "
            "Default-off — silent exit 0 unless explicitly enabled."
        ),
    )
    parser.add_argument("--task-id", default="")
    parser.add_argument(
        "--boundary",
        default="task",
        choices=("task", "phase-step", "tool-call"),
    )
    parser.add_argument("--consulted", action="append")
    parser.add_argument("--applied", action="append")
    parser.add_argument("--ts", default="")
    parser.add_argument("--payload-file", type=Path)
    parser.add_argument("--stdin", action="store_true")
    parser.add_argument(
        "--settings",
        type=Path,
        default=Path(".agent-settings.yml"),
        help="Override settings path (tests).",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Bypass the enabled-flag (tests + maintainer one-shots).",
    )
    args = parser.parse_args(argv)

    try:
        settings: TelemetrySettings = read_settings(args.settings)
    except OSError as exc:
        print(f"❌  cannot read settings: {exc}", file=sys.stderr)
        return 2

    if not settings.enabled and not args.force:
        # Default-off: silent success. Crucially: no payload parsing,
        # no schema construction — zero work attributable to telemetry.
        return 0

    if args.payload_file:
        try:
            raw = args.payload_file.read_text(encoding="utf-8")
        except OSError as exc:
            print(f"❌  cannot read --payload-file: {exc}", file=sys.stderr)
            return 2
        event = _build_event_from_payload(raw)
    elif args.stdin:
        event = _build_event_from_payload(sys.stdin.read())
    else:
        if not args.task_id:
            print("❌  --task-id required (or pass --payload-file/--stdin)",
                  file=sys.stderr)
            return 1
        event = _build_event_from_args(args)

    try:
        record_event(settings.log_path, event)
    except EngagementSchemaError as exc:
        print(f"❌  schema validation failed: {exc}", file=sys.stderr)
        return 1
    except OSError as exc:
        print(f"❌  cannot write engagement log: {exc}", file=sys.stderr)
        return 2

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
