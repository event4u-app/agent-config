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

_CLI_CANDIDATES = ("memory", "agent-memory", "agentmem")
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
    # Populated only when status == "present" — sourced from the
    # `health` CLI envelope so the v1 health() reports real package
    # capabilities instead of file-fallback placeholders.
    backend_version: str = ""
    features: tuple = ()


def _find_cli() -> str:
    for name in _CLI_CANDIDATES:
        path = shutil.which(name)
        if path:
            return path
    return ""


def _parse_health_envelope(stdout: str) -> dict | None:
    """Extract the v1 health envelope from `memory health` stdout.

    The package emits a single JSON object on stdout (pino structured
    logs go to stderr). We tolerate older builds that may have leaked
    log lines into stdout by scanning for the first top-level object
    that carries ``contract_version``.
    """
    text = (stdout or "").strip()
    if not text:
        return None
    try:
        obj = json.loads(text)
    except ValueError:
        obj = None
    if isinstance(obj, dict) and obj.get("contract_version"):
        return obj
    # Fallback: line-by-line scan for an envelope-shaped object — covers
    # the case where structured logs accidentally share stdout.
    for line in text.splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            cand = json.loads(line)
        except ValueError:
            continue
        if isinstance(cand, dict) and cand.get("contract_version"):
            return cand
    return None


def _probe_health(cli_path: str) -> tuple[bool, str, dict | None]:
    """Returns (healthy, reason, envelope).

    On success ``envelope`` is the parsed v1 health envelope (may still
    be ``None`` for very old CLIs that don't emit one). On failure it
    is always ``None``.
    """
    try:
        out = subprocess.run(
            [cli_path, "health"],
            capture_output=True, text=True,
            timeout=_HEALTH_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired:
        return False, f"health() timed out after {_HEALTH_TIMEOUT_SECONDS}s", None
    except FileNotFoundError:
        return False, "CLI vanished between which() and invoke", None
    if out.returncode != 0:
        # First line of combined output, capped, for the reason field.
        msg = (out.stderr or out.stdout or "exit != 0").strip().splitlines()
        head = msg[0][:120] if msg else "exit != 0"
        return False, f"health() returned {out.returncode}: {head}", None
    envelope = _parse_health_envelope(out.stdout)
    return True, "ok", envelope


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
        healthy, reason, envelope = _probe_health(cli)
        elapsed = int((time.monotonic() - t0) * 1000)
        if healthy:
            backend_version = ""
            features: tuple = ()
            if isinstance(envelope, dict):
                bv = envelope.get("backend_version")
                if isinstance(bv, str):
                    backend_version = bv
                feats = envelope.get("features")
                if isinstance(feats, list) and all(
                    isinstance(f, str) for f in feats
                ):
                    features = tuple(feats)
            result = Result("present", "package", reason, elapsed, cli,
                            backend_version=backend_version,
                            features=features)
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

    When the package backs the call (``status == "present"``), the
    envelope reports the package's own ``backend_version`` and
    ``features`` so consumers can feature-detect against real
    capabilities. Otherwise the file-fallback markers are returned.
    """
    r = status(refresh=refresh)
    envelope_status = {
        "present": "ok",
        "misconfigured": "degraded",
        "absent": "ok",
    }[r.status]
    if r.status == "present" and (r.backend_version or r.features):
        backend_version = r.backend_version or _FILE_BACKEND_VERSION
        features = list(r.features) if r.features else list(_FILE_BACKEND_FEATURES)
    else:
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
