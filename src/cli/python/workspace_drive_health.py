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
- **Auto-trip at N=5 consecutive failures** + a **manual** `kill`.
- **Auto-cooldown recovery (ADR-073 v1, circuit-breaker).** An auto-tripped host
  is `open` (inbox-only) during a cooldown, then `half_open` — the next real
  launch drives as a **probe**: success closes the circuit (un-kills), failure
  re-opens it and restarts the cooldown. Bounded by `MAX_AUTO_TRIPS` (after
  which the host goes sticky → manual reset). A **manual** `kill` is sticky
  (never auto-recovers). Cooldown is env-tunable
  (`AGENT_CONFIG_DRIVE_COOLDOWN_SEC`, default 600 s); the whole behaviour is
  behind `AGENT_CONFIG_DRIVE_AUTO_RECOVERY` (default on; off → v0 manual-only).
- **Atomic writes** (temp + `os.replace`) so a concurrent writer never sees a
  half-written file. Increments are best-effort under true concurrency (a lost
  increment is acceptable — the session log remains the source of truth).

Deferred to v2 (debt): an async / synthetic recovery probe (so a real user
never pays probe latency — v1 reuses the next real launch, acceptable for a
local single-user tool), a full compare-and-swap probe lock (v1 uses a
time-lease, adequate for launch-paced single-user writes), per-host cooldown
override, exponential cooldown back-off, per-error-kind trip weighting, and
reconciliation of the cache against the canonical session log.

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
MAX_AUTO_TRIPS = 3  # flapping guard: after N auto-trips a host goes sticky (ADR-073 v1)
PROBE_LEASE_SEC = 120  # a probe in flight for < this blocks a concurrent probe
HOST_RE = re.compile(r"^[a-z][a-z0-9-]*$")


def _now() -> float:
    import time
    return time.time()


def _cooldown_sec() -> int:
    """Auto-recovery cooldown (ADR-073 v1). Env-tunable, global; no code deploy
    needed to retune. Default 600 s (10 min)."""
    raw = os.getenv("AGENT_CONFIG_DRIVE_COOLDOWN_SEC", "600")
    try:
        return max(int(raw), 0)
    except ValueError:
        return 600


def _auto_recovery_enabled() -> bool:
    """Feature flag / escape hatch (council: mandatory). Default ON; set to
    0/false/off to revert to v0 manual-reset-only behaviour."""
    v = os.getenv("AGENT_CONFIG_DRIVE_AUTO_RECOVERY", "").strip().lower()
    return v not in {"0", "false", "off", "no"}


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
        # ADR-073 v1 circuit-breaker fields:
        "killed_at": None,           # epoch when tripped (auto or manual)
        "kill_reason": None,         # "auto" (cooldown-recoverable) | "manual" (sticky)
        "trip_count": 0,             # auto-trips so far (flapping guard → sticky at MAX_AUTO_TRIPS)
        "probe_started_at": None,    # half-open probe-in-flight lease
        "last_was_probe": False,     # observability: was the last outcome a recovery probe?
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


def record(root: Path, host: str, ok: bool, error_kind: str | None = None,
           *, is_probe: bool = False, now: float | None = None) -> dict:
    """Record one drive outcome. A success closes the circuit (un-kills — safe
    because a real drive only runs when closed or half-open). A failure trips
    the auto kill-switch at KILL_STREAK; a *probe* failure re-opens immediately
    and restarts the cooldown. ``trip_count`` bounds flapping → sticky."""
    now = _now() if now is None else now
    state = _read(root, host)
    state["probe_started_at"] = None              # any recorded outcome ends the probe lease
    state["last_was_probe"] = is_probe
    if ok:
        state["consecutive_failures"] = 0
        state["total_success"] += 1
        state["last_outcome"] = "ok"
        state["last_error_kind"] = None
        # Auto-recovery: a successful drive closes the circuit. A manual
        # (sticky) kill is NOT auto-cleared — only `reset` clears it.
        if state["killed"] and state["kill_reason"] == "auto":
            state["killed"] = False
            state["killed_at"] = None
            state["kill_reason"] = None
    else:
        state["consecutive_failures"] += 1
        state["total_failure"] += 1
        state["last_outcome"] = "fail"
        state["last_error_kind"] = error_kind
        if is_probe and state["killed"]:
            # half-open probe failed → re-open, restart the cooldown.
            state["killed_at"] = now
            state["trip_count"] += 1
        elif not state["killed"] and state["consecutive_failures"] >= KILL_STREAK:
            state["killed"] = True
            state["kill_reason"] = "auto"
            state["killed_at"] = now
            state["trip_count"] += 1
    _write(root, host, state)
    return state


def gate(root: Path, host: str, *, now: float | None = None, mark_probe: bool = True) -> str:
    """Circuit-breaker decision for the launch path → ``closed`` | ``open`` |
    ``half_open``. A missing cache fails open (``closed``). When it returns
    ``half_open`` and ``mark_probe`` is set, it stamps the probe-in-flight lease
    so a concurrent launch sees ``open`` instead of a second simultaneous probe.
    """
    now = _now() if now is None else now
    state = _read(root, host)
    if not state["killed"]:
        return "closed"
    # Sticky cases → stay open (manual reset only):
    if (not _auto_recovery_enabled()
            or state["kill_reason"] == "manual"
            or state["trip_count"] >= MAX_AUTO_TRIPS
            or state["killed_at"] is None):
        return "open"
    if now < state["killed_at"] + _cooldown_sec():
        return "open"                              # still cooling
    # Cooled down → half-open, unless a probe is already in flight (lease).
    started = state.get("probe_started_at")
    if started is not None and now < started + PROBE_LEASE_SEC:
        return "open"
    if mark_probe:
        state["probe_started_at"] = now
        _write(root, host, state)
    return "half_open"


def is_killed(root: Path, host: str) -> bool:
    """Raw kill flag (status read). Missing / unreadable cache → False."""
    return _read(root, host).get("killed") is True


def kill(root: Path, host: str, *, now: float | None = None) -> dict:
    """Manual kill — **sticky**: never auto-recovers, only `reset` clears it."""
    state = _read(root, host)
    state["killed"] = True
    state["kill_reason"] = "manual"
    state["killed_at"] = _now() if now is None else now
    state["probe_started_at"] = None
    _write(root, host, state)
    return state


def reset(root: Path, host: str) -> dict:
    state = _read(root, host)
    state.update({
        "killed": False, "consecutive_failures": 0, "killed_at": None,
        "kill_reason": None, "trip_count": 0, "probe_started_at": None,
    })
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
    rec.add_argument("--is-probe", action="store_true", help="this outcome was a half-open recovery probe")
    rec.add_argument("--root", type=Path, required=True)

    g = sub.add_parser("gate")
    g.add_argument("--host", required=True)
    g.add_argument("--root", type=Path, required=True)

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
        state = record(root, args.host, args.outcome == "ok", args.error_kind, is_probe=args.is_probe)
        print(json.dumps(state, sort_keys=True))
        return 0
    if args.cmd == "gate":
        print(gate(root, args.host))
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
