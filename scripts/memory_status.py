#!/usr/bin/env python3
"""Detect the agent-memory backend.

Single source of truth for whether skills should use the file fallback
(`scripts/memory_lookup.py`) or route through the optional
`@event4u/agent-memory` package.

Exit codes / statuses:

  * `absent`        — package not installed or CLI not on PATH
  * `misconfigured` — installed but `health()` fails within the timeout
  * `present`       — installed, healthy, usable now

Result is cached per process under `os.environ["AGENT_MEMORY_STATUS"]`
and (optionally) under `.agent-memory/status.cache` per session.

Usage:
    python3 scripts/memory_status.py                 # human-readable line
    python3 scripts/memory_status.py --format json   # stable JSON
    from scripts.memory_status import status         # Python import
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Literal

Status = Literal["absent", "misconfigured", "present"]

_CLI_CANDIDATES = ("agent-memory", "agentmem")
_HEALTH_TIMEOUT_SECONDS = 2.0
_CACHE_ENV = "AGENT_MEMORY_STATUS"
_CACHE_FILE = Path(".agent-memory") / "status.cache"

# Retrieval contract version served by the file-backed fallback.
# Source of truth: schemas/retrieval-v1.schema.json.
CONTRACT_VERSION = 1
_FILE_BACKEND_VERSION = "0.0.0-file"
_FILE_BACKEND_FEATURES = ("file-fallback",)


@dataclass
class Result:
    status: Status
    backend: str            # "file" or "package"
    reason: str             # short explanation
    elapsed_ms: int         # time spent probing (0 if cached)
    cli_path: str = ""      # resolved CLI path, if any


def _find_cli() -> str:
    for name in _CLI_CANDIDATES:
        path = shutil.which(name)
        if path:
            return path
    return ""


def _probe_health(cli_path: str) -> tuple[bool, str]:
    """Returns (healthy, reason)."""
    try:
        out = subprocess.run(
            [cli_path, "health"],
            capture_output=True, text=True,
            timeout=_HEALTH_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired:
        return False, f"health() timed out after {_HEALTH_TIMEOUT_SECONDS}s"
    except FileNotFoundError:
        return False, "CLI vanished between which() and invoke"
    if out.returncode != 0:
        # First line of combined output, capped, for the reason field.
        msg = (out.stderr or out.stdout or "exit != 0").strip().splitlines()
        head = msg[0][:120] if msg else "exit != 0"
        return False, f"health() returned {out.returncode}: {head}"
    return True, "ok"


def _read_cache() -> Result | None:
    cached = os.environ.get(_CACHE_ENV)
    if cached:
        try:
            data = json.loads(cached)
            return Result(**data)
        except (ValueError, TypeError):
            pass
    if _CACHE_FILE.is_file():
        try:
            data = json.loads(_CACHE_FILE.read_text(encoding="utf-8"))
            return Result(**data)
        except (OSError, ValueError, TypeError):
            pass
    return None


def _write_cache(result: Result) -> None:
    payload = json.dumps(asdict(result))
    os.environ[_CACHE_ENV] = payload
    try:
        _CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        _CACHE_FILE.write_text(payload, encoding="utf-8")
    except OSError:
        # Best-effort cache; skills MUST still work without it.
        pass


def status(refresh: bool = False) -> Result:
    """Return the cached or freshly-probed backend status.

    Always returns in well under ``_HEALTH_TIMEOUT_SECONDS`` seconds on
    cache hit; bounded by the timeout on cache miss. Never raises —
    probe failures degrade to ``absent`` / ``misconfigured`` rather than
    surfacing exceptions.
    """
    if not refresh:
        cached = _read_cache()
        if cached is not None:
            cached.elapsed_ms = 0
            return cached
    t0 = time.monotonic()
    cli = _find_cli()
    if not cli:
        result = Result("absent", "file",
                        "agent-memory CLI not on PATH", 0)
    else:
        healthy, reason = _probe_health(cli)
        elapsed = int((time.monotonic() - t0) * 1000)
        if healthy:
            result = Result("present", "package", reason, elapsed, cli)
        else:
            result = Result("misconfigured", "file", reason, elapsed, cli)
    _write_cache(result)
    return result


def health(refresh: bool = False) -> dict:
    """Return a v1 retrieval-contract health envelope.

    Schema: ``schemas/retrieval-v1.schema.json`` (HealthResponse).
    Maps the three-state :func:`status` result onto the contract's
    ``ok | degraded | error`` so consumers can read
    ``contract_version`` without caring about the file-vs-package split.
    """
    r = status(refresh=refresh)
    envelope_status = {
        "present": "ok",
        "misconfigured": "degraded",
        "absent": "ok",
    }[r.status]
    # When the package is present, report its version from `health()`
    # output; until we parse that, keep the file-fallback marker so the
    # envelope never lies about what backed the response.
    backend_version = _FILE_BACKEND_VERSION
    features = list(_FILE_BACKEND_FEATURES)
    return {
        "contract_version": CONTRACT_VERSION,
        "status": envelope_status,
        "backend_version": backend_version,
        "features": features,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--format", choices=["text", "json"], default="text")
    ap.add_argument("--refresh", action="store_true",
                    help="Bypass the session cache and probe fresh")
    ap.add_argument("--health", action="store_true",
                    help="Emit a v1 retrieval-contract health envelope "
                         "instead of the legacy status line")
    args = ap.parse_args()
    if args.health:
        print(json.dumps(health(refresh=args.refresh)))
        return 0
    r = status(refresh=args.refresh)
    if args.format == "json":
        print(json.dumps(asdict(r)))
    else:
        icon = {"present": "✅", "misconfigured": "⚠️", "absent": "ℹ️"}[r.status]
        print(f"  {icon}  backend={r.backend}  status={r.status}  "
              f"elapsed={r.elapsed_ms}ms  reason={r.reason}")
    # `absent` is a valid operational state, not a failure.
    return 0


if __name__ == "__main__":
    sys.exit(main())
