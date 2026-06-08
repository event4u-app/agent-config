#!/usr/bin/env python3
"""Tier-3 host hand-off inbox — ADR-023 Tier 3 / ADR-065.

For hosts the workspace cannot drive (Augment, Cursor, Cline, Windsurf, …),
the workspace writes the rendered prompt into
``~/.event4u/agent-config/workspace/inbox/<id>.md`` and surfaces a one-line
copy-to-clipboard banner; the user opens the host themselves.

v0 is deliberately minimal (AI-council 2026-06-08): **plaintext** (NOT
encrypted — the inbox holds a prompt the user reads to copy-paste, and the
same content already lives in the encrypted sessions store, so encrypting it
defends against no incremental threat), **ephemeral** (a `prune` drops files
older than the retention window), and **content-minimal** (header + rendered
prompt body; skill-body pre-rendering and host-tier auto-detection are
deferred to their own ADRs).

CLI::

    workspace_inbox.py write --role <r> --task <t> --body-file <p>
                             [--session <id>] [--root <p>]
    workspace_inbox.py read <id> [--root <p>]
    workspace_inbox.py list [--limit 20] [--json] [--root <p>]
    workspace_inbox.py forget <id> [--root <p>]
    workspace_inbox.py prune [--max-age-hours 24] [--root <p>]
"""

from __future__ import annotations

import argparse
import json
import os
import secrets
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

# Sibling import: robust under direct execution and the importlib test loader.
sys.path.insert(0, str(Path(__file__).resolve().parent))
import workspace_secrets  # noqa: E402

WORKSPACE_HOME = Path.home() / ".event4u" / "agent-config" / "workspace" / "inbox"
RETENTION_HOURS = 24


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _new_id() -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return f"{stamp}-{secrets.token_hex(4)}"


def _atomic_write(p: Path, text: str) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(p.parent), suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(text)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, p)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def _frontmatter(meta: dict) -> str:
    lines = ["---"]
    for k in ("id", "role", "task", "session", "created_at"):
        v = meta.get(k)
        if v not in (None, ""):
            lines.append(f"{k}: {v}")
    lines.append("---")
    return "\n".join(lines) + "\n\n"


def write(role: str, task: str, body: str, *, session: str | None = None,
          root: Path | None = None) -> dict:
    """Write one Tier-3 hand-off file. Returns ``{id, path, banner}``."""
    base = root if root is not None else WORKSPACE_HOME
    inbox_id = _new_id()
    # Disposable hand-off → scrub a pasted credential silently (same posture as
    # the session/analytics telemetry stores), rather than refuse the write.
    safe_body, _ = workspace_secrets.scrub(body)
    safe_task, _ = workspace_secrets.scrub(task)
    meta = {"id": inbox_id, "role": role, "task": safe_task,
            "session": session, "created_at": _now_iso()}
    p = base / f"{inbox_id}.md"
    _atomic_write(p, _frontmatter(meta) + safe_body)
    return {
        "id": inbox_id,
        "path": str(p),
        "banner": f"Tier-3 hand-off ready: copy {p} into your host, then open it.",
    }


def read(inbox_id: str, *, root: Path | None = None) -> str | None:
    base = root if root is not None else WORKSPACE_HOME
    p = base / f"{inbox_id}.md"
    if not p.exists():
        return None
    return p.read_text(encoding="utf-8")


def forget(inbox_id: str, *, root: Path | None = None) -> bool:
    base = root if root is not None else WORKSPACE_HOME
    p = base / f"{inbox_id}.md"
    if not p.exists():
        return False
    p.unlink()
    return True


def list_inbox(*, limit: int = 20, root: Path | None = None) -> list[dict]:
    base = root if root is not None else WORKSPACE_HOME
    if not base.exists():
        return []
    files = sorted((p for p in base.glob("*.md") if p.is_file()),
                   key=lambda p: p.stat().st_mtime, reverse=True)
    out = []
    for p in files[:limit]:
        meta = _read_frontmatter(p)
        out.append({"id": p.stem, "role": meta.get("role"), "task": meta.get("task"),
                    "session": meta.get("session"), "created_at": meta.get("created_at"),
                    "path": str(p)})
    return out


def _read_frontmatter(p: Path) -> dict:
    raw = p.read_text(encoding="utf-8")
    if not raw.startswith("---"):
        return {}
    end = raw.find("\n---", 4)
    if end == -1:
        return {}
    out: dict = {}
    for line in raw[3:end].splitlines():
        if not line.strip() or ":" not in line:
            continue
        k, _, v = line.partition(":")
        out[k.strip()] = v.strip()
    return out


def prune(*, max_age_hours: int = RETENTION_HOURS, root: Path | None = None) -> int:
    """Drop hand-off files older than the retention window (ephemerality)."""
    base = root if root is not None else WORKSPACE_HOME
    if not base.exists():
        return 0
    cutoff = datetime.now(timezone.utc).timestamp() - max_age_hours * 3600
    dropped = 0
    for p in base.glob("*.md"):
        if p.stat().st_mtime < cutoff:
            p.unlink()
            dropped += 1
    return dropped


def _validate_cli_root(raw: str) -> Path:
    """Reject a --root that is not a ``…/workspace/inbox`` dir (traversal /
    refactor footgun guard, mirrors the sessions store)."""
    p = Path(raw).resolve()
    if p.name != "inbox" or p.parent.name != "workspace":
        raise SystemExit(
            f"workspace_inbox: --root must be a .../workspace/inbox dir, got {raw!r}")
    return p


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="workspace_inbox")
    sub = p.add_subparsers(dest="cmd", required=True)
    s_w = sub.add_parser("write")
    s_w.add_argument("--role", required=True)
    s_w.add_argument("--task", required=True)
    s_w.add_argument("--body-file", required=True)
    s_w.add_argument("--session")
    s_w.add_argument("--root")
    s_r = sub.add_parser("read")
    s_r.add_argument("inbox_id")
    s_r.add_argument("--root")
    s_l = sub.add_parser("list")
    s_l.add_argument("--limit", type=int, default=20)
    s_l.add_argument("--json", action="store_true")
    s_l.add_argument("--root")
    s_f = sub.add_parser("forget")
    s_f.add_argument("inbox_id")
    s_f.add_argument("--root")
    s_p = sub.add_parser("prune")
    s_p.add_argument("--max-age-hours", type=int, default=RETENTION_HOURS)
    s_p.add_argument("--root")
    args = p.parse_args(argv)
    root = _validate_cli_root(args.root) if getattr(args, "root", None) else None
    if args.cmd == "write":
        body = Path(args.body_file).read_text(encoding="utf-8")
        print(json.dumps(write(args.role, args.task, body, session=args.session,
                               root=root), sort_keys=True))
        return 0
    if args.cmd == "read":
        text = read(args.inbox_id, root=root)
        if text is None:
            print(f"workspace_inbox: no such hand-off {args.inbox_id}", file=sys.stderr)
            return 1
        sys.stdout.write(text)
        return 0
    if args.cmd == "list":
        rows = list_inbox(limit=args.limit, root=root)
        if args.json:
            print(json.dumps(rows, sort_keys=True))
        else:
            for row in rows:
                print(json.dumps(row, sort_keys=True))
        return 0
    if args.cmd == "forget":
        return 0 if forget(args.inbox_id, root=root) else 1
    if args.cmd == "prune":
        print(json.dumps({"pruned": prune(max_age_hours=args.max_age_hours, root=root)},
                         sort_keys=True))
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
