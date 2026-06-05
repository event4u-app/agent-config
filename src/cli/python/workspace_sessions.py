#!/usr/bin/env python3
"""Local workspace session store — Phase 4 of ``road-to-employee-product``.

Implements ``docs/contracts/daily-workspace.md`` §Session JSONL schema.
Per-user, local-only. One JSONL file per session under
``~/.event4u/agent-config/workspace/sessions/<yyyy-mm-dd>/<session-id>.jsonl``.

CLI::

    workspace_sessions.py start --role <slug> --task <slug>
    workspace_sessions.py append <session-id> --kind <kind> --data k=v ...
    workspace_sessions.py list [--limit 20]
    workspace_sessions.py read <session-id>
"""

from __future__ import annotations

import argparse
import json
import os
import secrets
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

# Sibling import: robust under both direct script execution and the importlib
# test loader (see workspace_secrets module docstring).
sys.path.insert(0, str(Path(__file__).resolve().parent))
import workspace_secrets  # noqa: E402

WORKSPACE_HOME = Path.home() / ".event4u" / "agent-config" / "workspace" / "sessions"

# Event kinds per contract §Session JSONL schema.
ALLOWED_KINDS = frozenset({
    "launcher.input", "host.turn", "host.output", "host.tool",
    "host.error", "inbox.handoff", "explain.rendered",
    "document.created", "document.edited",
})


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _new_session_id() -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return f"{stamp}-{secrets.token_hex(4)}"


def _session_path(session_id: str, *, root: Path | None = None) -> Path:
    base = root if root is not None else WORKSPACE_HOME
    day = session_id.split("T", 1)[0]
    # day is YYYYMMDD; expand to YYYY-MM-DD per contract layout.
    day_iso = f"{day[0:4]}-{day[4:6]}-{day[6:8]}"
    return base / day_iso / f"{session_id}.jsonl"


@dataclass(frozen=True)
class SessionMeta:
    session_id: str
    path: Path
    role: str | None
    task: str | None
    mtime: float


def start(role: str, task: str, *, root: Path | None = None) -> str:
    """Create a new session file and write the opening ``launcher.input`` line."""
    sid = _new_session_id()
    p = _session_path(sid, root=root)
    p.parent.mkdir(parents=True, exist_ok=True)
    # Pre-write secret-scan hook (Phase 8 Step 5): a pasted credential in the
    # opening task lands at rest. Telemetry is disposable → scrub silently.
    safe_task, _ = workspace_secrets.scrub(task)
    rec = {
        "ts": _now_iso(),
        "kind": "launcher.input",
        "data": {"role": role, "task": safe_task},
    }
    with p.open("w", encoding="utf-8") as fh:
        fh.write(json.dumps(rec, sort_keys=True) + "\n")
    return sid


def append(session_id: str, kind: str, data: dict | None = None, *, root: Path | None = None) -> bool:
    """Append one event to an existing session. Rejects unknown kinds."""
    if kind not in ALLOWED_KINDS:
        print(f"workspace_sessions: rejecting unknown kind {kind!r}", file=sys.stderr)
        return False
    p = _session_path(session_id, root=root)
    if not p.exists():
        print(f"workspace_sessions: no session {session_id}", file=sys.stderr)
        return False
    # Pre-write secret-scan hook (Phase 8 Step 5): scrub the event payload —
    # prompts, tool args, and outputs can carry pasted credentials. Telemetry
    # is disposable, so scrub silently rather than refuse the append.
    safe_data, _ = workspace_secrets.scrub_obj(data or {})
    rec = {"ts": _now_iso(), "kind": kind, "data": safe_data}
    with p.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(rec, sort_keys=True) + "\n")
    return True


def read(session_id: str, *, root: Path | None = None) -> list[dict]:
    p = _session_path(session_id, root=root)
    if not p.exists():
        return []
    out = []
    for line in p.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out


def list_sessions(*, limit: int = 20, root: Path | None = None) -> list[SessionMeta]:
    base = root if root is not None else WORKSPACE_HOME
    if not base.exists():
        return []
    files = [p for p in base.glob("*/*.jsonl") if p.is_file()]
    files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    out = []
    for p in files[:limit]:
        first = _peek_first_record(p)
        out.append(SessionMeta(
            session_id=p.stem,
            path=p,
            role=(first or {}).get("data", {}).get("role"),
            task=(first or {}).get("data", {}).get("task"),
            mtime=p.stat().st_mtime,
        ))
    return out


def _peek_first_record(p: Path) -> dict | None:
    try:
        with p.open("r", encoding="utf-8") as fh:
            line = fh.readline()
    except OSError:
        return None
    if not line.strip():
        return None
    try:
        return json.loads(line)
    except json.JSONDecodeError:
        return None


def _parse_kv(items: list[str]) -> dict:
    out: dict = {}
    for item in items or []:
        if "=" not in item:
            continue
        k, _, v = item.partition("=")
        out[k.strip()] = v.strip()
    return out


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="workspace_sessions")
    sub = p.add_subparsers(dest="cmd", required=True)
    s_start = sub.add_parser("start")
    s_start.add_argument("--role", required=True)
    s_start.add_argument("--task", required=True)
    s_app = sub.add_parser("append")
    s_app.add_argument("session_id")
    s_app.add_argument("--kind", required=True)
    s_app.add_argument("--data", action="append", default=[])
    s_list = sub.add_parser("list")
    s_list.add_argument("--limit", type=int, default=20)
    s_read = sub.add_parser("read")
    s_read.add_argument("session_id")
    args = p.parse_args(argv)
    if args.cmd == "start":
        print(start(args.role, args.task))
        return 0
    if args.cmd == "append":
        ok = append(args.session_id, args.kind, _parse_kv(args.data))
        return 0 if ok else 1
    if args.cmd == "list":
        for meta in list_sessions(limit=args.limit):
            print(json.dumps({"session_id": meta.session_id, "role": meta.role,
                              "task": meta.task, "mtime": meta.mtime}, sort_keys=True))
        return 0
    if args.cmd == "read":
        for rec in read(args.session_id):
            print(json.dumps(rec, sort_keys=True))
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
