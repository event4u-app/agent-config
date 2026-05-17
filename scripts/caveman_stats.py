#!/usr/bin/env python3
"""Caveman per-session / per-conversation / lifetime token-delta lens.

Reads sessions.jsonl, groups by sessionId + conversation_id, emits per-row
caveman delta tokens. Honors the suspended-multiplier contract in
`docs/contracts/caveman-telemetry.md` (delta = 0 while suspended).
"""
from __future__ import annotations
import argparse, json, sys
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_JSONL = REPO_ROOT / "agents" / "cost-tracking" / "sessions.jsonl"
TELEMETRY_DOC = REPO_ROOT / "docs" / "contracts" / "caveman-telemetry.md"

# Mirrors `docs/contracts/caveman-telemetry.md` `v1` constants.
MULTIPLIER_VERSION = "v1"
MULTIPLIER_VALUE = 0.9155
MULTIPLIER_ACTIVE = False  # suspended pending v2


def _load(path: Path) -> list[dict]:
    if not path.is_file():
        return []
    rows: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows


def _delta(row: dict) -> int:
    """Per-row delta with suspended-multiplier guard."""
    if not MULTIPLIER_ACTIVE:
        return 0
    explicit = row.get("caveman_delta_tokens")
    if isinstance(explicit, (int, float)):
        return int(explicit)
    compressed = row.get("caveman_compressed_tokens")
    if isinstance(compressed, (int, float)) and compressed > 0:
        return int(compressed * MULTIPLIER_VALUE - compressed)
    return 0


def aggregate(rows: list[dict]) -> dict:
    _zero = lambda: {"sessions": 0, "delta_tokens": 0, "compressed_tokens": 0}
    by_session: dict[str, dict] = defaultdict(_zero)
    by_conv: dict[str, dict] = defaultdict(_zero)
    lifetime = _zero()
    for row in rows:
        sid = str(row.get("sessionId") or row.get("session_id") or "unknown")
        cid = str(row.get("conversation_id") or "unknown")
        delta = _delta(row)
        comp = int(row.get("caveman_compressed_tokens") or 0)
        for bucket in (by_session[sid], by_conv[cid], lifetime):
            bucket["sessions"] += 1
            bucket["delta_tokens"] += delta
            bucket["compressed_tokens"] += comp
    return {
        "schema_version": "caveman-stats/v1",
        "multiplier_version": MULTIPLIER_VERSION,
        "multiplier_value": MULTIPLIER_VALUE,
        "multiplier_active": MULTIPLIER_ACTIVE,
        "lifetime": lifetime,
        "by_session": dict(by_session),
        "by_conversation": dict(by_conv),
    }


def render_text(report: dict) -> str:
    lines = [
        f"caveman-stats {report['schema_version']} · multiplier {report['multiplier_version']}"
        f" ({'ACTIVE' if report['multiplier_active'] else 'SUSPENDED'}) · "
        f"value {report['multiplier_value']:.4f}",
        "",
        f"  lifetime: {report['lifetime']['sessions']} sessions · "
        f"delta_tokens = {report['lifetime']['delta_tokens']:+,} · "
        f"compressed_tokens = {report['lifetime']['compressed_tokens']:,}",
        "",
        "  by conversation:",
    ]
    for cid, b in sorted(report["by_conversation"].items()):
        lines.append(
            f"    {cid}: {b['sessions']} sessions · "
            f"delta = {b['delta_tokens']:+,} · compressed = {b['compressed_tokens']:,}"
        )
    if not report["multiplier_active"]:
        lines += [
            "",
            "  Note: multiplier suspended — see docs/contracts/caveman-telemetry.md",
            "  (delta_tokens = 0 until kill-criterion satisfied in caveman-v2).",
        ]
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--input", type=Path, default=DEFAULT_JSONL)
    parser.add_argument("--format", choices=["text", "json"], default="text")
    args = parser.parse_args(argv)

    rows = _load(args.input)
    report = aggregate(rows)

    if args.format == "json":
        print(json.dumps(report, indent=2))
    else:
        print(render_text(report))
    return 0


if __name__ == "__main__":
    sys.exit(main())
