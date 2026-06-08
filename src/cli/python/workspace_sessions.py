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
import workspace_crypto  # noqa: E402

WORKSPACE_HOME = Path.home() / ".event4u" / "agent-config" / "workspace" / "sessions"


def _line_out(text: str) -> str:
    """One session record as a storable line — per-record encrypted (ADR-064)
    when the flag is on, plaintext JSON otherwise. Sessions are append-JSONL,
    so they use per-record encryption, not whole-file ``.enc``."""
    return workspace_crypto.encrypt_line(text) if workspace_crypto.is_enabled() else text

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
    started_at: str | None = None


def start(role: str, task: str, *, host: str | None = None, root: Path | None = None) -> str:
    """Create a new session file and write the opening ``launcher.input`` line.

    When ``host`` is given the launcher.input data carries ``host_tier`` +
    ``host_id`` (the shape the Node GUI server writes); omitted → the bare
    ``{role, task}`` shape.
    """
    sid = _new_session_id()
    p = _session_path(sid, root=root)
    p.parent.mkdir(parents=True, exist_ok=True)
    # Pre-write secret-scan hook (Phase 8 Step 5): a pasted credential in the
    # opening task lands at rest. Telemetry is disposable → scrub silently.
    safe_task, _ = workspace_secrets.scrub(task)
    data = {"role": role, "task": safe_task}
    if host is not None:
        data["host_tier"] = "tier-1"
        data["host_id"] = host
    rec = {"ts": _now_iso(), "kind": "launcher.input", "data": data}
    with p.open("w", encoding="utf-8") as fh:
        fh.write(_line_out(json.dumps(rec, sort_keys=True)) + "\n")
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
        fh.write(_line_out(json.dumps(rec, sort_keys=True)) + "\n")
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
            # decrypt_line passes a plaintext JSON line through; skip a torn /
            # undecryptable line (sessions are an append-only event log —
            # best-effort, like analytics, per ADR-064 §N3).
            out.append(json.loads(workspace_crypto.decrypt_line(line)))
        except Exception:  # noqa: BLE001
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
            started_at=(first or {}).get("ts"),
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
        # Decrypt just the first line for the meta (role/task) — cheap, no
        # whole-file read (ADR-064 §S3).
        return json.loads(workspace_crypto.decrypt_line(line))
    except Exception:  # noqa: BLE001
        return None


# --- encryption-at-rest ops (ADR-064: per-record, across the day-dir tree) ---

def _rewrite_session(p: Path, transform) -> int:
    out = [transform(ln) for ln in p.read_text(encoding="utf-8").splitlines() if ln.strip()]
    tmp = p.with_suffix(".jsonl.tmp")
    tmp.write_text("\n".join(out) + ("\n" if out else ""), encoding="utf-8")
    os.replace(tmp, p)
    return len(out)


def migrate(*, root: Path | None = None) -> dict:
    """Plaintext → per-record encrypted across every session. Requires the
    flag on. Content-idempotent (re-nonces already-encrypted lines)."""
    if not workspace_crypto.is_enabled():
        raise RuntimeError("workspace.encrypt_at_rest is off — enable it before migrate")
    base = root if root is not None else WORKSPACE_HOME
    n = 0
    if base.exists():
        for p in sorted(base.glob("*/*.jsonl")):
            had_plaintext = any(
                ln.strip() and ln.lstrip()[0] in "{["
                for ln in p.read_text(encoding="utf-8").splitlines()
            )
            _rewrite_session(p, lambda ln: workspace_crypto.encrypt_line(
                workspace_crypto.decrypt_line(ln)))
            if had_plaintext:
                n += 1
    return {"migrated": n}


def decrypt_all(*, root: Path | None = None) -> dict:
    """Kill-switch: every session record back to plaintext (works flag-off)."""
    base = root if root is not None else WORKSPACE_HOME
    n = 0
    if base.exists():
        for p in sorted(base.glob("*/*.jsonl")):
            had_encrypted = any(
                ln.strip() and ln.lstrip()[0] not in "{["
                for ln in p.read_text(encoding="utf-8").splitlines()
            )
            _rewrite_session(p, workspace_crypto.decrypt_line)
            if had_encrypted:
                n += 1
    return {"decrypted": n}


def rekey(*, root: Path | None = None) -> dict:
    """Rotate the master key and re-encrypt every encrypted session record."""
    base = root if root is not None else WORKSPACE_HOME
    pending: list[tuple[Path, list[tuple[bool, str]]]] = []
    if base.exists():
        for p in sorted(base.glob("*/*.jsonl")):
            rows: list[tuple[bool, str]] = []
            for ln in p.read_text(encoding="utf-8").splitlines():
                if not ln.strip():
                    continue
                was_enc = ln.lstrip()[0] not in "{["
                rows.append((was_enc, workspace_crypto.decrypt_line(ln)))
            pending.append((p, rows))
    new_key = workspace_crypto.rotate_key()
    n = 0
    for p, rows in pending:
        if not any(was_enc for was_enc, _ in rows):
            continue
        out = [workspace_crypto.encrypt_line(c, key=new_key) if was_enc else c
               for was_enc, c in rows]
        tmp = p.with_suffix(".jsonl.tmp")
        tmp.write_text("\n".join(out) + ("\n" if out else ""), encoding="utf-8")
        os.replace(tmp, p)
        n += 1
    return {"rekeyed": n}


def _validate_cli_root(raw: str) -> Path:
    """Reject a --root that is not a ``…/workspace/sessions`` dir.

    The Node GUI server passes ``<writeRoot>/workspace/sessions``; this guards
    against a refactor accidentally passing the workspace root (which would
    list/rewrite the whole tree) or a traversal path (ADR-064 §S2)."""
    p = Path(raw).resolve()
    if p.name != "sessions" or p.parent.name != "workspace":
        raise SystemExit(
            f"workspace_sessions: --root must be a .../workspace/sessions dir, got {raw!r}")
    return p


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
    s_start.add_argument("--host")
    s_start.add_argument("--root")
    s_app = sub.add_parser("append")
    s_app.add_argument("session_id")
    s_app.add_argument("--kind", required=True)
    s_app.add_argument("--data", action="append", default=[])
    s_app.add_argument("--data-json", dest="data_json",
                       help="full event data as a JSON object (preserves nested "
                            "structure the flat --data k=v cannot; used by the Node bridge)")
    s_app.add_argument("--root")
    s_list = sub.add_parser("list")
    s_list.add_argument("--limit", type=int, default=20)
    s_list.add_argument("--root", help="sessions dir (Node passes <writeRoot>/workspace/sessions)")
    s_list.add_argument("--json", action="store_true", help="emit a single JSON array")
    s_read = sub.add_parser("read")
    s_read.add_argument("session_id")
    s_read.add_argument("--root")
    s_read.add_argument("--json", action="store_true", help="emit a single JSON array of records")
    for name in ("migrate", "decrypt-all", "rekey"):
        sp = sub.add_parser(name)
        sp.add_argument("--root")
    args = p.parse_args(argv)
    if args.cmd == "start":
        root = _validate_cli_root(args.root) if args.root else None
        print(start(args.role, args.task, host=args.host, root=root))
        return 0
    if args.cmd == "append":
        root = _validate_cli_root(args.root) if args.root else None
        data = json.loads(args.data_json) if args.data_json else _parse_kv(args.data)
        ok = append(args.session_id, args.kind, data, root=root)
        return 0 if ok else 1
    if args.cmd == "list":
        root = _validate_cli_root(args.root) if args.root else None
        rows = [{"session_id": m.session_id, "role": m.role, "task": m.task,
                 "mtime": m.mtime, "started_at": m.started_at}
                for m in list_sessions(limit=args.limit, root=root)]
        if args.json:
            print(json.dumps(rows, sort_keys=True))
        else:
            for row in rows:
                print(json.dumps(row, sort_keys=True))
        return 0
    if args.cmd == "read":
        root = _validate_cli_root(args.root) if args.root else None
        records = read(args.session_id, root=root)
        if args.json:
            print(json.dumps(records, sort_keys=True))
        else:
            for rec in records:
                print(json.dumps(rec, sort_keys=True))
        return 0
    if args.cmd == "migrate":
        print(json.dumps(migrate(root=_validate_cli_root(args.root) if args.root else None), sort_keys=True))
        return 0
    if args.cmd == "decrypt-all":
        print(json.dumps(decrypt_all(root=_validate_cli_root(args.root) if args.root else None), sort_keys=True))
        return 0
    if args.cmd == "rekey":
        print(json.dumps(rekey(root=_validate_cli_root(args.root) if args.root else None), sort_keys=True))
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
