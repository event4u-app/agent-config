"""MCP telemetry SQLite store — Phase 2 K1.

Ingests the JSONL sink written by ``scripts/mcp_server/telemetry.py``
into a queryable SQLite database. Idempotent: each JSONL line is hashed
and stored as the primary key, so re-running ``ingest`` is safe and
won't double-count records.

Contract:

- Source of truth stays the JSONL file. SQLite is a derived view.
- Schema is documented in ``docs/contracts/mcp-telemetry-store.md``.
- Stdlib-only — no SQLAlchemy / pandas, so consumers can run this
  without extra dependencies.

Phase 2 K2 (``scripts/mcp_telemetry_query.py``) reads from this store.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

sys.path.insert(0, str(Path(__file__).resolve().parent))
from mcp_server.telemetry import (  # noqa: E402
    TELEMETRY_FILENAME,
    TELEMETRY_REL_DIR,
)

DEFAULT_DB_REL = "agents/.mcp-telemetry/calls.sqlite3"
SCHEMA_VERSION = 1


@dataclass(frozen=True)
class IngestReport:
    """Outcome of one ``ingest`` run."""

    source_path: str
    db_path: str
    lines_read: int
    lines_skipped: int
    rows_inserted: int
    rows_already_present: int

    def as_dict(self) -> dict[str, Any]:
        return {
            "source_path": self.source_path,
            "db_path": self.db_path,
            "lines_read": self.lines_read,
            "lines_skipped": self.lines_skipped,
            "rows_inserted": self.rows_inserted,
            "rows_already_present": self.rows_already_present,
        }


def resolve_source(consumer_root: Path | None = None) -> Path:
    root = (consumer_root or Path.cwd()).resolve()
    return root / TELEMETRY_REL_DIR / TELEMETRY_FILENAME


def resolve_db(consumer_root: Path | None = None) -> Path:
    root = (consumer_root or Path.cwd()).resolve()
    return root / DEFAULT_DB_REL


def _connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS calls (
            line_hash TEXT PRIMARY KEY,
            tool_name TEXT NOT NULL,
            client_id_hash TEXT NOT NULL,
            ts TEXT NOT NULL,
            transport TEXT NOT NULL,
            outcome TEXT NOT NULL,
            ingested_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_calls_tool ON calls(tool_name)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_calls_ts ON calls(ts)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_calls_outcome ON calls(outcome)"
    )
    conn.commit()
    return conn


def _iter_lines(source: Path) -> Iterable[str]:
    with source.open("r", encoding="utf-8") as fh:
        for line in fh:
            yield line


def ingest(
    *,
    consumer_root: Path | None = None,
    source_override: Path | None = None,
    db_override: Path | None = None,
) -> IngestReport:
    """Read the JSONL sink and upsert into SQLite. Idempotent."""
    source = source_override or resolve_source(consumer_root)
    db_path = db_override or resolve_db(consumer_root)

    if not source.exists():
        # Still create the DB so K2 has something to query against.
        conn = _connect(db_path)
        conn.close()
        return IngestReport(
            source_path=str(source),
            db_path=str(db_path),
            lines_read=0,
            lines_skipped=0,
            rows_inserted=0,
            rows_already_present=0,
        )

    conn = _connect(db_path)
    inserted = 0
    already = 0
    read = 0
    skipped = 0
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    try:
        for raw in _iter_lines(source):
            stripped = raw.strip()
            if not stripped:
                continue
            read += 1
            try:
                record = json.loads(stripped)
            except ValueError:
                skipped += 1
                continue
            line_hash = hashlib.sha256(stripped.encode("utf-8")).hexdigest()
            cur = conn.execute(
                "INSERT OR IGNORE INTO calls "
                "(line_hash, tool_name, client_id_hash, ts, transport, "
                "outcome, ingested_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    line_hash,
                    str(record.get("tool_name", "")),
                    str(record.get("client_id_hash", "")),
                    str(record.get("ts", "")),
                    str(record.get("transport", "")),
                    str(record.get("outcome", "")),
                    now,
                ),
            )
            if cur.rowcount == 1:
                inserted += 1
            else:
                already += 1
        conn.commit()
    finally:
        conn.close()
    return IngestReport(
        source_path=str(source),
        db_path=str(db_path),
        lines_read=read,
        lines_skipped=skipped,
        rows_inserted=inserted,
        rows_already_present=already,
    )


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Ingest MCP telemetry JSONL into SQLite (Phase 2 K1)."
    )
    parser.add_argument("--consumer-root", type=Path, default=None)
    parser.add_argument("--source", type=Path, default=None)
    parser.add_argument("--db", type=Path, default=None)
    parser.add_argument("--json", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    report = ingest(
        consumer_root=args.consumer_root,
        source_override=args.source,
        db_override=args.db,
    )
    if args.json:
        print(json.dumps(report.as_dict(), separators=(",", ":")))
    else:
        print(
            f"✅  ingested {report.rows_inserted} new row(s) "
            f"(skipped {report.lines_skipped} malformed, "
            f"{report.rows_already_present} already present)"
        )
        print(f"   source: {report.source_path}")
        print(f"   db:     {report.db_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
