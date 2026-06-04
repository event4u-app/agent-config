"""MCP telemetry query CLI — Phase 2 K2.

Reads the SQLite store written by ``scripts/mcp_telemetry_store.py``
and surfaces:

- Per-tool attempt counts.
- Distinct-consumer counts (``client_id_hash``).
- Outcome ratios (``implemented`` / ``stub`` / ``latent_demand``).
- Latent-demand names — tool names not in the catalog.

Refresh cadence: cheap enough to run on every ``task mcp:report``
invocation. Stdlib-only; reads (never writes) the DB.
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from mcp_telemetry_store import resolve_db  # noqa: E402

# Lazy import the catalog so the query CLI stays usable when only the
# JSONL is present (e.g. an analyst node without the full package).
try:
    from mcp_server.catalog import load_catalog  # noqa: E402

    _CATALOG_AVAILABLE = True
except Exception:  # pragma: no cover - defensive
    _CATALOG_AVAILABLE = False


@dataclass(frozen=True)
class ToolRow:
    tool_name: str
    attempts: int
    distinct_consumers: int
    implemented: int
    stub: int
    latent_demand: int
    last_ts: str | None

    def as_dict(self) -> dict[str, Any]:
        return {
            "tool_name": self.tool_name,
            "attempts": self.attempts,
            "distinct_consumers": self.distinct_consumers,
            "implemented": self.implemented,
            "stub": self.stub,
            "latent_demand": self.latent_demand,
            "last_ts": self.last_ts,
        }


def _connect_ro(db_path: Path) -> sqlite3.Connection:
    if not db_path.exists():
        raise FileNotFoundError(f"telemetry db not found: {db_path}")
    uri = f"file:{db_path.as_posix()}?mode=ro"
    return sqlite3.connect(uri, uri=True)


def _query_tools(conn: sqlite3.Connection) -> list[ToolRow]:
    rows = conn.execute(
        """
        SELECT
          tool_name,
          COUNT(*) AS attempts,
          COUNT(DISTINCT client_id_hash) AS distinct_consumers,
          SUM(CASE WHEN outcome = 'implemented' THEN 1 ELSE 0 END),
          SUM(CASE WHEN outcome = 'stub' THEN 1 ELSE 0 END),
          SUM(CASE WHEN outcome = 'latent_demand' THEN 1 ELSE 0 END),
          MAX(ts)
        FROM calls
        GROUP BY tool_name
        ORDER BY attempts DESC, tool_name ASC
        """
    ).fetchall()
    return [
        ToolRow(
            tool_name=r[0],
            attempts=r[1],
            distinct_consumers=r[2],
            implemented=r[3] or 0,
            stub=r[4] or 0,
            latent_demand=r[5] or 0,
            last_ts=r[6],
        )
        for r in rows
    ]


def _catalog_names() -> frozenset[str]:
    if not _CATALOG_AVAILABLE:
        return frozenset()
    try:
        return frozenset(e.name for e in load_catalog())
    except Exception:
        return frozenset()


def summarise(db_path: Path) -> dict[str, Any]:
    """Pure-function summary used by both the CLI and the tests."""
    conn = _connect_ro(db_path)
    try:
        tools = _query_tools(conn)
    finally:
        conn.close()
    catalog = _catalog_names()
    total_attempts = sum(t.attempts for t in tools)
    total_consumers = len({})  # placeholder; recomputed below
    consumer_set: set[str] = set()
    conn2 = _connect_ro(db_path)
    try:
        for (cid,) in conn2.execute(
            "SELECT DISTINCT client_id_hash FROM calls"
        ):
            consumer_set.add(cid)
    finally:
        conn2.close()
    total_consumers = len(consumer_set)
    latent_names = [
        t.tool_name for t in tools
        if t.latent_demand > 0
        and catalog
        and t.tool_name not in catalog
    ]
    return {
        "db_path": str(db_path),
        "total_attempts": total_attempts,
        "total_distinct_consumers": total_consumers,
        "tools": [t.as_dict() for t in tools],
        "latent_demand_names": sorted(set(latent_names)),
        "catalog_known": len(catalog) > 0,
    }


def _print_human(report: dict[str, Any]) -> None:
    print(
        f"📊  {report['total_attempts']} attempts across "
        f"{len(report['tools'])} tool(s) — "
        f"{report['total_distinct_consumers']} distinct consumer(s)"
    )
    print(f"   db: {report['db_path']}")
    print()
    if not report["tools"]:
        print("(no telemetry rows — run scripts/mcp_telemetry_store.py first)")
        return
    print(
        f"  {'tool':<28}  {'att':>5}  {'cons':>5}  "
        f"{'impl':>5}  {'stub':>5}  {'lat':>5}  last_ts"
    )
    for t in report["tools"]:
        print(
            f"  {t['tool_name']:<28}  {t['attempts']:>5}  "
            f"{t['distinct_consumers']:>5}  {t['implemented']:>5}  "
            f"{t['stub']:>5}  {t['latent_demand']:>5}  "
            f"{t['last_ts'] or '—'}"
        )
    if report["latent_demand_names"]:
        print()
        print("⚠️  latent-demand names not in catalog:")
        for n in report["latent_demand_names"]:
            print(f"   - {n}")


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Query the MCP telemetry SQLite store (Phase 2 K2)."
    )
    parser.add_argument("--consumer-root", type=Path, default=None)
    parser.add_argument("--db", type=Path, default=None)
    parser.add_argument("--json", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    db_path = args.db or resolve_db(args.consumer_root)
    try:
        report = summarise(db_path)
    except FileNotFoundError as exc:
        msg = (
            f"❌  {exc}\n"
            "   run `python3 scripts/mcp_telemetry_store.py` first."
        )
        if args.json:
            print(json.dumps({"error": str(exc)}, separators=(",", ":")))
        else:
            print(msg, file=sys.stderr)
        return 1
    if args.json:
        print(json.dumps(report, separators=(",", ":")))
    else:
        _print_human(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
