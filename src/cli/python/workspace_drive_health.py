#!/usr/bin/env python3
"""Drive health + kill-switch — ADR-073.

The Tier-1 drive loop (ADR-070/071/072) records every turn in the session store
(`host.turn` / `host.error`) — that store is the **canonical** history. But the
kill-switch needs a *cheap, frequent* read ("is this host healthy enough to
drive?") on every launch; scanning encrypted session files per launch is wrong.
So this module keeps a tiny per-host **cache** counter at
`<root>/<host>.json` and a kill-switch derived from it.

Design (AI-council 2026-06-08, claude-sonnet-4-5 + gpt-4o, design mode):

- **Counter is a cache; the session log is canonical.** A missing / unreadable
  health file fails **open** (host treated as healthy) — the cache never
  fabricates a kill.
- **Minimal schema** — `consecutive_failures`, `killed`, lifetime totals, last
  outcome. No time-bucketed histograms (that would be v0 over-engineering).
- **Auto-trip at N=5 consecutive failures** + a **manual** `kill`. A success
  resets the streak (but not a tripped `killed` flag).
- **Manual reset only in v0.** A tripped host stays inbox-only until an operator
  clears it — auto-cooldown / probe-drive is v1 (no flapping data yet).
- **Atomic writes** (temp + `os.replace`) so a concurrent writer never sees a
  half-written file. Increments are best-effort under true concurrency (a lost
  increment is acceptable — the session log remains the source of truth).

Deferred to v1 (debt): auto-cooldown + probe-drive recovery, failure-rate
windows, per-error-kind weighting, reconciliation against the canonical session
log.

CLI::

    workspace_drive_health.py record --host <h> --outcome ok|fail [--error-kind <k>] --root <dir>
    workspace_drive_health.py status [--host <h>] [--json] --root <dir>
    workspace_drive_health.py kill   --host <h> --root <dir>
    workspace_drive_health.py reset  --host <h> --root <dir>
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

KILL_STREAK = 5  # consecutive failures that auto-trip the kill-switch (council)
HOST_RE = re.compile(r"^[a-z][a-z0-9-]*$")


def _host_path(root: Path, host: str) -> Path:
    if not HOST_RE.match(host or ""):
        raise ValueError(f"invalid host id: {host!r}")
    return root / f"{host}.json"


def _default_state(host: str) -> dict:
    return {
        "host": host,
        "consecutive_failures": 0,
        "killed": False,
        "total_success": 0,
        "total_failure": 0,
        "last_outcome": None,
        "last_error_kind": None,
    }


def _read(root: Path, host: str) -> dict:
    """Read a host's health cache. Fails open: any error → default (healthy)."""
    try:
        path = _host_path(root, host)
    except ValueError:
        return _default_state(host)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            base = _default_state(host)
            base.update({k: data[k] for k in base if k in data})
            return base
    except (OSError, json.JSONDecodeError):
        pass
    return _default_state(host)


def _write(root: Path, host: str, state: dict) -> None:
    path = _host_path(root, host)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(f".{os.getpid()}.tmp")
    tmp.write_text(json.dumps(state, sort_keys=True), encoding="utf-8")
    os.replace(tmp, path)  # atomic — a concurrent reader never sees a partial file


def record(root: Path, host: str, ok: bool, error_kind: str | None = None) -> dict:
    """Record one drive outcome. Auto-trips `killed` at KILL_STREAK failures."""
    state = _read(root, host)
    if ok:
        state["consecutive_failures"] = 0
        state["total_success"] += 1
        state["last_outcome"] = "ok"
        state["last_error_kind"] = None
    else:
        state["consecutive_failures"] += 1
        state["total_failure"] += 1
        state["last_outcome"] = "fail"
        state["last_error_kind"] = error_kind
        if state["consecutive_failures"] >= KILL_STREAK:
            state["killed"] = True
    _write(root, host, state)
    return state


def is_killed(root: Path, host: str) -> bool:
    """Fast kill-switch read. Missing / unreadable cache → False (fail open)."""
    return _read(root, host).get("killed") is True


def kill(root: Path, host: str) -> dict:
    state = _read(root, host)
    state["killed"] = True
    _write(root, host, state)
    return state


def reset(root: Path, host: str) -> dict:
    state = _read(root, host)
    state["killed"] = False
    state["consecutive_failures"] = 0
    _write(root, host, state)
    return state


def status(root: Path, host: str | None = None) -> dict:
    if host is not None:
        return _read(root, host)
    out: dict[str, dict] = {}
    if root.is_dir():
        for f in sorted(root.glob("*.json")):
            h = f.stem
            if HOST_RE.match(h):
                out[h] = _read(root, h)
    return out


def _validate_cli_root(root: Path) -> Path:
    resolved = root.resolve()
    if resolved.name != "health":
        raise SystemExit(f"--root must be a workspace/health directory; got '{root}'")
    return resolved


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="workspace_drive_health")
    sub = p.add_subparsers(dest="cmd", required=True)

    rec = sub.add_parser("record")
    rec.add_argument("--host", required=True)
    rec.add_argument("--outcome", required=True, choices=("ok", "fail"))
    rec.add_argument("--error-kind")
    rec.add_argument("--root", type=Path, required=True)

    st = sub.add_parser("status")
    st.add_argument("--host")
    st.add_argument("--json", action="store_true")
    st.add_argument("--root", type=Path, required=True)

    for name in ("kill", "reset"):
        sp = sub.add_parser(name)
        sp.add_argument("--host", required=True)
        sp.add_argument("--root", type=Path, required=True)

    args = p.parse_args(argv)
    root = _validate_cli_root(args.root)

    if args.cmd == "record":
        state = record(root, args.host, args.outcome == "ok", args.error_kind)
        print(json.dumps(state, sort_keys=True))
        return 0
    if args.cmd == "status":
        result = status(root, args.host)
        if args.json or args.host is None:
            print(json.dumps(result, sort_keys=True))
        else:
            print(f"{args.host}: killed={result['killed']} "
                  f"streak={result['consecutive_failures']} "
                  f"ok={result['total_success']} fail={result['total_failure']}")
        return 0
    if args.cmd == "kill":
        print(json.dumps(kill(root, args.host), sort_keys=True))
        return 0
    if args.cmd == "reset":
        print(json.dumps(reset(root, args.host), sort_keys=True))
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
