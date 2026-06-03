#!/usr/bin/env python3
"""Local-only workspace analytics — Phase 7 of ``road-to-employee-product``.

Implements ``docs/contracts/local-analytics.md``. **Never** POSTs. Writes to
``~/.event4u/agent-config/workspace/analytics/events.jsonl`` only. Shares the
``workspace_event/v0`` vocabulary with the 3.1.0 telemetry SDK; transports
are disjoint (this surface is local-disk, that one is an undeployed Worker).

CLI::

    workspace_analytics.py emit <event> [--data k=v ...]
    workspace_analytics.py show [--window 30d|7d|24h] [--event <name>]
                                 [--role <slug>] [--format markdown|csv|json]
    workspace_analytics.py prune

Opt-out (either short-circuits before any file is opened)::

    AGENT_CONFIG_NO_LOCAL_ANALYTICS=1     # env
    .agent-settings.yml → analytics.local: off
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable

# Sibling import: robust under both direct script execution and the importlib
# test loader (see workspace_secrets module docstring).
sys.path.insert(0, str(Path(__file__).resolve().parent))
import workspace_secrets  # noqa: E402

# --- Storage layout (contract §Storage) ------------------------------------

WORKSPACE_HOME = Path.home() / ".event4u" / "agent-config" / "workspace" / "analytics"
EVENTS_PATH = WORKSPACE_HOME / "events.jsonl"
RETENTION_LOCK = WORKSPACE_HOME / "retention.lock"

SCHEMA = "workspace_event/v0"
RETENTION_DAYS = 90

# Closed event set per contract §Event vocabulary. Emitter rejects anything
# not on this list so the analytics surface stays auditable.
ALLOWED_EVENTS = frozenset({
    "launcher.opened", "launcher.task_picked", "launcher.task_launched",
    "session.started", "session.host_turn", "session.completed",
    "document.created", "document.edited", "document.exported",
    "explain.opened", "explain.mode_toggled", "why.invoked",
    "knowledge.queried", "knowledge.source_clicked",
    # 6.0.0-C Phase 3 — evidence-based-pruning measurement events. Local,
    # anonymized, opt-out and 90-day retention like every other event; these
    # feed the pruning thresholds in docs/contracts/evidence-based-pruning.md
    # (tier-2 rule load %, persona citation-in-use, skill activation). Payloads
    # carry only ids + the active profile, never message bodies — see
    # docs/contracts/command-clusters.md § Tier-usage signal contract.
    "rule.tier2_loaded",     # a tier-2 (router-gated) rule was loaded this turn
    "persona.cited",         # a persona was cited-in-use by a skill/command
    "skill.activated",       # a skill was activated under the active profile
})

ENV_OPT_OUT = "AGENT_CONFIG_NO_LOCAL_ANALYTICS"


# --- Opt-out gate ----------------------------------------------------------

def is_disabled(settings_path: Path | None = None) -> bool:
    """Return True when env or settings opt-out is in effect.

    ``settings_path`` defaults to ``.agent-settings.yml`` at CWD. Missing or
    malformed settings → emitter stays ON (default per contract §Opt-out).
    """
    if os.environ.get(ENV_OPT_OUT, "").strip() not in ("", "0"):
        return True
    p = settings_path if settings_path is not None else Path(".agent-settings.yml")
    if not p.exists():
        return False
    try:
        # Stdlib-only YAML peek — no PyYAML dep. Look for `analytics:` block
        # then a `local:` child with `off`/`false`/`no`. Anything else → on.
        text = p.read_text(encoding="utf-8")
    except OSError:
        return False
    in_block = False
    for raw in text.splitlines():
        line = raw.rstrip()
        if not line or line.lstrip().startswith("#"):
            continue
        if not line.startswith(" ") and line.endswith(":"):
            in_block = line.strip() == "analytics:"
            continue
        if in_block and line.lstrip().startswith("local:"):
            value = line.split(":", 1)[1].strip().lower().strip("'\"")
            return value in ("off", "false", "no", "0")
    return False


# --- Emitter ---------------------------------------------------------------

@dataclass(frozen=True)
class Event:
    ts: str
    schema: str
    event: str
    data: dict


def emit(event: str, data: dict | None = None, *, settings_path: Path | None = None) -> bool:
    """Append one ``workspace_event/v0`` record.

    Returns True on write, False on opt-out / disk-full / unknown event. Never
    raises — UI threads call this on the hot path.
    """
    if event not in ALLOWED_EVENTS:
        print(f"workspace_analytics: rejecting unknown event {event!r}", file=sys.stderr)
        return False
    if is_disabled(settings_path):
        return False
    # Pre-write secret-scan hook (Phase 8 Step 5). Telemetry is disposable and
    # machine-generated, so scrub silently. Fail safe: if the scrub itself
    # errors, DROP the event rather than persist it unscrubbed — the contract
    # is "never raises / never leaks", not "never loses an event".
    try:
        safe_data, _ = workspace_secrets.scrub_obj(data or {})
    except Exception as err:  # noqa: BLE001 — never let the hot path raise
        print(f"workspace_analytics: drop event {event!r} (scrub failed: {err})", file=sys.stderr)
        return False
    record = {
        "ts": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "schema": SCHEMA,
        "event": event,
        "data": safe_data,
    }
    try:
        WORKSPACE_HOME.mkdir(parents=True, exist_ok=True)
        with EVENTS_PATH.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(record, sort_keys=True) + "\n")
    except OSError as err:
        print(f"workspace_analytics: drop event {event!r} ({err})", file=sys.stderr)
        return False
    return True


def read_events(path: Path | None = None) -> list[Event]:
    p = path if path is not None else EVENTS_PATH
    if not p.exists():
        return []
    out: list[Event] = []
    for line in p.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            rec = json.loads(line)
            out.append(Event(ts=rec["ts"], schema=rec["schema"], event=rec["event"], data=rec.get("data", {})))
        except (json.JSONDecodeError, KeyError):
            # Contract §Failure modes: skip malformed lines silently in query
            continue
    return out


def _parse_ts(ts: str) -> datetime:
    return datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


def query(
    since: datetime | None = None,
    event: str | None = None,
    role: str | None = None,
    *,
    path: Path | None = None,
) -> list[Event]:
    out = []
    for rec in read_events(path):
        if since is not None and _parse_ts(rec.ts) < since:
            continue
        if event is not None and rec.event != event:
            continue
        if role is not None and rec.data.get("role") != role:
            continue
        out.append(rec)
    return out


# --- Prune (contract §Storage: 90-day rolling, cheap fs lock) -------------

def prune(*, path: Path | None = None, retention_days: int = RETENTION_DAYS) -> int:
    """Drop records older than ``retention_days``. Returns count dropped."""
    p = path if path is not None else EVENTS_PATH
    if not p.exists():
        return 0
    lock = RETENTION_LOCK if path is None else p.parent / "retention.lock"
    try:
        lock.parent.mkdir(parents=True, exist_ok=True)
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        os.close(fd)
    except FileExistsError:
        return 0  # another prune pass holds the lock
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
        keep: list[str] = []
        dropped = 0
        for line in p.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                rec = json.loads(line)
                if _parse_ts(rec["ts"]) < cutoff:
                    dropped += 1
                    continue
            except (json.JSONDecodeError, KeyError, ValueError):
                pass
            keep.append(line)
        tmp = p.with_suffix(".jsonl.tmp")
        tmp.write_text("\n".join(keep) + ("\n" if keep else ""), encoding="utf-8")
        tmp.replace(p)
        return dropped
    finally:
        try:
            lock.unlink()
        except FileNotFoundError:
            pass


# --- /analytics:show renderer ---------------------------------------------

WINDOWS = {"24h": timedelta(hours=24), "7d": timedelta(days=7), "30d": timedelta(days=30)}


def _window_since(window: str) -> datetime:
    if window not in WINDOWS:
        raise ValueError(f"unknown window {window!r}; choose from {sorted(WINDOWS)}")
    return datetime.now(timezone.utc) - WINDOWS[window]


def show(
    window: str = "30d",
    event_filter: str | None = None,
    role_filter: str | None = None,
    fmt: str = "markdown",
    *,
    path: Path | None = None,
) -> str:
    since = _window_since(window)
    events = query(since=since, event=event_filter, role=role_filter, path=path)
    if fmt == "json":
        return json.dumps([{"ts": e.ts, "event": e.event, "data": e.data} for e in events], indent=2)
    if fmt == "csv":
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["ts", "event", "role", "task", "host_tier", "duration_ms"])
        for e in events:
            d = e.data
            w.writerow([e.ts, e.event, d.get("role", ""), d.get("task", ""), d.get("host_tier", ""), d.get("duration_ms", "")])
        return buf.getvalue()
    return _render_markdown(events, window)


def _render_markdown(events: list[Event], window: str) -> str:
    top: dict[tuple[str, str], int] = {}
    launched: dict[str, int] = {}
    completed: dict[str, int] = {}
    durations: list[int] = []
    sources: list[str] = []
    for e in events:
        d = e.data
        role = d.get("role", "?")
        task = d.get("task", "?")
        if e.event == "launcher.task_launched":
            top[(role, task)] = top.get((role, task), 0) + 1
            launched[role] = launched.get(role, 0) + 1
        elif e.event == "session.completed":
            completed[role] = completed.get(role, 0) + 1
            dur = d.get("duration_ms")
            if isinstance(dur, int):
                durations.append(dur)
        elif e.event == "knowledge.source_clicked":
            src = d.get("source")
            if src:
                sources.append(src)
    out = [f"# Workspace analytics — last {window}\n"]
    if not events:
        out.append("_No events recorded in this window._\n")
        return "\n".join(out)
    out.append("## Top prompts\n")
    for (role, task), n in sorted(top.items(), key=lambda kv: -kv[1])[:10]:
        out.append(f"- `{role}` · `{task}` — {n}")
    out.append("\n## Launcher → completion rate per role\n")
    for role in sorted(set(launched) | set(completed)):
        ln, cn = launched.get(role, 0), completed.get(role, 0)
        pct = round(100 * cn / ln) if ln else 0
        out.append(f"- `{role}` — {pct}% ({ln} launched · {cn} completed)")
    if durations:
        avg = sum(durations) // len(durations) // 1000
        m, s = divmod(avg, 60)
        out.append(f"\n**Average session length:** {m}m {s}s")
    out.append(f"\n**Knowledge sources clicked:** {len(sources)}")
    if sources:
        unique = sorted(set(sources))[:5]
        out.append(f"_({' · '.join(unique)})_")
    return "\n".join(out) + "\n"



# --- CLI ------------------------------------------------------------------

def _parse_kv(items: list[str]) -> dict:
    out: dict = {}
    for it in items:
        if "=" not in it:
            raise SystemExit(f"--data expects key=value, got {it!r}")
        k, v = it.split("=", 1)
        # int coercion for duration_ms / counts; everything else stays str
        try:
            out[k] = int(v)
        except ValueError:
            out[k] = v
    return out


def _main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="workspace_analytics", description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)

    e = sub.add_parser("emit", help="append a workspace_event/v0 record")
    e.add_argument("event")
    e.add_argument("--data", action="append", default=[], metavar="K=V")

    s = sub.add_parser("show", help="render /analytics:show report")
    s.add_argument("--window", default="30d", choices=sorted(WINDOWS))
    s.add_argument("--event", default=None)
    s.add_argument("--role", default=None)
    s.add_argument("--format", default="markdown", choices=("markdown", "csv", "json"))

    sub.add_parser("prune", help="drop events older than retention window")

    args = parser.parse_args(argv)

    if args.cmd == "emit":
        ok = emit(args.event, _parse_kv(args.data))
        return 0 if ok else 1
    if args.cmd == "show":
        sys.stdout.write(show(args.window, args.event, args.role, args.format))
        return 0
    if args.cmd == "prune":
        n = prune()
        sys.stdout.write(f"pruned {n} event(s)\n")
        return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(_main(sys.argv[1:]))
