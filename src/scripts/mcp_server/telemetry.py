"""MCP telemetry sink — Phase 1 J4 instrumentation.

Per ``agents/roadmaps/archive/road-to-mcp-full-coverage.md`` §Phase 1 J4 +
``docs/contracts/mcp-tool-stub-envelope.md``, both transports log every
``tools/call`` with ``{tool_name, client_id_hash, ts, transport,
outcome}``. Payload bodies are never logged; the client identifier is
hashed at the server boundary so the queryable store never sees raw
identity.

Outcomes:

- ``implemented`` — real handler ran (no envelope returned).
- ``stub`` — catalog entry missing this transport; ``not_implemented``
  envelope returned.
- ``latent_demand`` — caller asked for a tool not in the catalog.

The sink writes JSONL to ``agents/runtime/mcp-telemetry/calls.jsonl`` under the
consumer root. Failure to write must not break the wire surface: the
``record_call`` helper swallows OSError + ValueError and emits a single
warning to stderr.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import time
from pathlib import Path
from typing import Literal

Outcome = Literal["implemented", "stub", "latent_demand"]

# Stable file location relative to consumer_root. Phase 2 K1 routes
# this into a queryable store; Phase 1 only needs the file to exist.
TELEMETRY_REL_DIR = "agents/runtime/mcp-telemetry"
TELEMETRY_FILENAME = "calls.jsonl"

# Truncation length for the client_id hash. 12 hex chars = 48 bits of
# entropy — enough to distinguish hundreds of consumers without
# becoming a re-identification vector.
_HASH_LEN = 12


def _client_id_seed() -> str:
    """Identity components that together pin a consumer install.

    USER + machine hostname + repo path is a stable triple that survives
    sessions without leaking PII into the log. The hash never reverses.
    """
    user = os.environ.get("USER") or os.environ.get("USERNAME") or "unknown"
    host = os.environ.get("HOSTNAME")
    if not host and hasattr(os, "uname"):
        host = os.uname().nodename
    host = host or "unknown"
    cwd = str(Path.cwd().resolve())
    return f"{user}|{host}|{cwd}"


def hash_client_id(seed: str | None = None) -> str:
    """SHA-256(seed) truncated to 12 hex chars. Boundary-only call."""
    raw = seed if seed is not None else _client_id_seed()
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return digest[:_HASH_LEN]


def _resolve_log_path(consumer_root: Path | None = None) -> Path:
    """Pick the JSONL location. Defaults to CWD when no override given."""
    root = (consumer_root or Path.cwd()).resolve()
    return root / TELEMETRY_REL_DIR / TELEMETRY_FILENAME


def _now_iso() -> str:
    """ISO-8601 UTC timestamp, seconds precision."""
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def build_record(
    *,
    tool_name: str,
    outcome: Outcome,
    transport: str,
    client_id_hash_value: str | None = None,
    ts: str | None = None,
) -> dict[str, object]:
    """Pure helper — assemble the record without touching the filesystem."""
    return {
        "tool_name": tool_name,
        "client_id_hash": client_id_hash_value or hash_client_id(),
        "ts": ts or _now_iso(),
        "transport": transport,
        "outcome": outcome,
    }


def record_call(
    *,
    tool_name: str,
    outcome: Outcome,
    transport: str,
    consumer_root: Path | None = None,
    client_id_hash_value: str | None = None,
) -> dict[str, object] | None:
    """Append one JSONL record. Returns the record or None on failure.

    Failures are swallowed: telemetry must never break the wire surface.
    A single ``mcp-server: warn: telemetry`` line is emitted to stderr
    so silent-failure windows show up in the boot log and the J6
    healthcheck can detect them.
    """
    record = build_record(
        tool_name=tool_name,
        outcome=outcome,
        transport=transport,
        client_id_hash_value=client_id_hash_value,
    )
    target = _resolve_log_path(consumer_root)
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(record, separators=(",", ":")) + "\n")
    except (OSError, ValueError) as exc:
        print(
            f"mcp-server: warn: telemetry write failed: {exc}",
            file=sys.stderr,
        )
        return None
    return record
