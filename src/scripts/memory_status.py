#!/usr/bin/env python3
"""File-backed memory status (no external backend).

The optional `@event4u/agent-memory` package was removed; retrieval
(`scripts/memory_lookup.py`) and signal-writing (`scripts/memory_signal.py`)
are entirely file-backed now. `status()` / `health()` report the file
backend so the v1 retrieval-contract health envelope stays stable for
consumers (e.g. the MCP `memory_status` tool).

Usage:
    python3 scripts/memory_status.py                 # human-readable line
    python3 scripts/memory_status.py --format json   # stable JSON
    python3 scripts/memory_status.py --health        # v1 health envelope
    from scripts.memory_status import status, health # Python import
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, asdict

# Retrieval contract version served by the file-backed backend.
# Source of truth: internal/schemas/retrieval-v1.schema.json.
CONTRACT_VERSION = 1
_FILE_BACKEND_VERSION = "0.0.0-file"
_FILE_BACKEND_FEATURES = ("file-fallback",)


@dataclass
class Result:
    status: str = "file"     # always "file" — no external backend
    backend: str = "file"
    reason: str = "file-backed memory (no external backend)"
    elapsed_ms: int = 0


def status(refresh: bool = False) -> Result:
    """Return the (constant) file-backend status. Never raises."""
    return Result()


def health(refresh: bool = False) -> dict:
    """Return a v1 retrieval-contract health envelope (file backend)."""
    return {
        "contract_version": CONTRACT_VERSION,
        "status": "ok",
        "backend_version": _FILE_BACKEND_VERSION,
        "features": list(_FILE_BACKEND_FEATURES),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--format", choices=["text", "json"], default="text")
    ap.add_argument("--refresh", action="store_true",
                    help="No-op (kept for back-compat); status is constant")
    ap.add_argument("--health", action="store_true",
                    help="Emit a v1 retrieval-contract health envelope "
                         "instead of the status line")
    args = ap.parse_args()
    if args.health:
        print(json.dumps(health()))
        return 0
    r = status()
    if args.format == "json":
        print(json.dumps(asdict(r)))
    else:
        print(f"  ℹ️  backend={r.backend}  status={r.status}  "
              f"reason={r.reason}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
