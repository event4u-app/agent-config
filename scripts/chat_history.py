#!/usr/bin/env python3
"""Persistent chat-history log for crash recovery.

Maintains `.agent-chat-history` in the project root — a JSONL file whose
first line is a header (session id, fingerprint, frequency mode) and
whose remaining lines are append-only entries (user messages, phases,
tool calls, questions, answers, decisions, commits).

Ownership is established via SHA-256 of the first user message in the
conversation, stored in the header. Agents read this on every turn to
detect whether the file belongs to the current conversation.

File path defaults to `.agent-chat-history` in CWD and can be overridden
via `$AGENT_CHAT_HISTORY_FILE` (used by tests).

Usage:
    python3 scripts/chat_history.py init --first-user-msg "..." [--freq per_phase]
    python3 scripts/chat_history.py append --type phase --json '{...}'
    python3 scripts/chat_history.py status
    python3 scripts/chat_history.py check --first-user-msg "..."
    python3 scripts/chat_history.py adopt --first-user-msg "..."
    python3 scripts/chat_history.py clear
    python3 scripts/chat_history.py rotate --max-kb 256 --mode rotate
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import sys
import uuid
from pathlib import Path
from typing import Any

DEFAULT_FILE = ".agent-chat-history"
SCHEMA_VERSION = 1
VALID_FREQS = {"per_turn", "per_phase", "per_tool"}
VALID_OVERFLOW = {"rotate", "compress"}
_WS_RE = re.compile(r"\s+")


def file_path() -> Path:
    return Path(os.environ.get("AGENT_CHAT_HISTORY_FILE") or DEFAULT_FILE)


def _now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def fingerprint(first_user_msg: str) -> str:
    """SHA-256 of the normalized first user message (whitespace collapsed)."""
    normalized = _WS_RE.sub(" ", first_user_msg or "").strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _preview(msg: str, n: int = 80) -> str:
    flat = _WS_RE.sub(" ", msg or "").strip()
    return flat[:n]


def read_header(path: Path | None = None) -> dict[str, Any] | None:
    p = path or file_path()
    if not p.is_file() or p.stat().st_size == 0:
        return None
    try:
        with p.open(encoding="utf-8") as fh:
            first = fh.readline().strip()
        if not first:
            return None
        obj = json.loads(first)
        return obj if isinstance(obj, dict) and obj.get("t") == "header" else None
    except (json.JSONDecodeError, OSError):
        return None


def init(first_user_msg: str, freq: str = "per_phase", *,
         path: Path | None = None) -> dict[str, Any]:
    """Overwrite the file with a fresh header for a new session."""
    if freq not in VALID_FREQS:
        raise ValueError(f"freq must be one of {sorted(VALID_FREQS)}")
    p = path or file_path()
    header = {
        "t": "header",
        "v": SCHEMA_VERSION,
        "session": str(uuid.uuid4()),
        "started": _now(),
        "fp": fingerprint(first_user_msg),
        "preview": _preview(first_user_msg),
        "freq": freq,
    }
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w", encoding="utf-8") as fh:
        fh.write(json.dumps(header, ensure_ascii=False) + "\n")
    return header


def append(entry: dict[str, Any], *, path: Path | None = None) -> None:
    """Append one entry. Entry must be a dict; `ts` is auto-filled."""
    if not isinstance(entry, dict) or not entry.get("t"):
        raise ValueError("entry must be a dict with non-empty 't' key")
    if entry["t"] == "header":
        raise ValueError("use init() to write the header, not append()")
    entry.setdefault("ts", _now())
    p = path or file_path()
    with p.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")


def check_ownership(first_user_msg: str, *,
                    path: Path | None = None) -> str:
    """Return 'match', 'mismatch', or 'missing'."""
    header = read_header(path)
    if not header:
        return "missing"
    return "match" if header.get("fp") == fingerprint(first_user_msg) else "mismatch"


def adopt(first_user_msg: str, *, path: Path | None = None) -> dict[str, Any]:
    """Rewrite the header's fingerprint to the current conversation's.

    Used by `/chat-history-resume`: preserves all entries, re-points the
    fingerprint so subsequent turns of the current conversation match.
    """
    p = path or file_path()
    header = read_header(p)
    if not header:
        raise FileNotFoundError(f"no header in {p}")
    header["fp"] = fingerprint(first_user_msg)
    header["preview"] = _preview(first_user_msg)
    header["adopted_at"] = _now()
    with p.open(encoding="utf-8") as fh:
        lines = fh.readlines()
    lines[0] = json.dumps(header, ensure_ascii=False) + "\n"
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text("".join(lines), encoding="utf-8")
    tmp.replace(p)
    return header


def clear(*, path: Path | None = None) -> None:
    p = path or file_path()
    if p.exists():
        p.unlink()


def status(*, path: Path | None = None) -> dict[str, Any]:
    p = path or file_path()
    if not p.is_file():
        return {"exists": False, "path": str(p)}
    header = read_header(p)
    size = p.stat().st_size
    with p.open(encoding="utf-8") as fh:
        entry_count = sum(1 for _ in fh) - (1 if header else 0)
    return {
        "exists": True,
        "path": str(p),
        "size_bytes": size,
        "size_kb": round(size / 1024, 1),
        "entries": max(entry_count, 0),
        "header": header,
    }


def overflow_handle(max_kb: int, mode: str = "rotate", *,
                    path: Path | None = None) -> dict[str, Any]:
    """Enforce max_kb. Returns {'action', 'kept', 'dropped'}.

    Rotate: drop oldest entries (keep header) until file ≤ max_kb.
    Compress: mark oldest 50% as stale and leave a `needs_compress`
              marker entry for the agent to rewrite on next turn.
    """
    if mode not in VALID_OVERFLOW:
        raise ValueError(f"mode must be one of {sorted(VALID_OVERFLOW)}")
    p = path or file_path()
    if not p.is_file() or p.stat().st_size <= max_kb * 1024:
        return {"action": "noop", "kept": None, "dropped": 0}
    with p.open(encoding="utf-8") as fh:
        lines = fh.readlines()
    if not lines:
        return {"action": "noop", "kept": 0, "dropped": 0}
    header_line = lines[0]
    entries = lines[1:]
    if mode == "rotate":
        budget = max_kb * 1024 - len(header_line.encode("utf-8"))
        kept: list[str] = []
        total = 0
        for line in reversed(entries):
            size = len(line.encode("utf-8"))
            if total + size > budget:
                break
            kept.append(line)
            total += size
        kept.reverse()
        dropped = len(entries) - len(kept)
        tmp = p.with_suffix(p.suffix + ".tmp")
        tmp.write_text(header_line + "".join(kept), encoding="utf-8")
        tmp.replace(p)
        return {"action": "rotate", "kept": len(kept), "dropped": dropped}
    marker = {
        "t": "needs_compress",
        "ts": _now(),
        "reason": f"file exceeded {max_kb} KB, compress-mode requested",
    }
    append(marker, path=p)
    return {"action": "compress_marked", "kept": len(entries), "dropped": 0}


def _cmd_init(args) -> int:
    h = init(args.first_user_msg, freq=args.freq)
    print(json.dumps(h, ensure_ascii=False))
    return 0


def _cmd_append(args) -> int:
    entry = json.loads(args.json) if args.json else {}
    entry.setdefault("t", args.type)
    if not entry.get("t"):
        print("error: --type or a 't' key in --json is required", file=sys.stderr)
        return 2
    append(entry)
    return 0


def _cmd_status(_args) -> int:
    print(json.dumps(status(), ensure_ascii=False, indent=2))
    return 0


def _cmd_check(args) -> int:
    print(check_ownership(args.first_user_msg))
    return 0


def _cmd_adopt(args) -> int:
    h = adopt(args.first_user_msg)
    print(json.dumps(h, ensure_ascii=False))
    return 0


def _cmd_clear(_args) -> int:
    clear()
    return 0


def _cmd_rotate(args) -> int:
    result = overflow_handle(args.max_kb, mode=args.mode)
    print(json.dumps(result, ensure_ascii=False))
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p_init = sub.add_parser("init")
    p_init.add_argument("--first-user-msg", required=True)
    p_init.add_argument("--freq", default="per_phase", choices=sorted(VALID_FREQS))
    p_init.set_defaults(func=_cmd_init)
    p_app = sub.add_parser("append")
    p_app.add_argument("--type", help="entry type (t field)")
    p_app.add_argument("--json", help="JSON object with entry fields")
    p_app.set_defaults(func=_cmd_append)
    sub.add_parser("status").set_defaults(func=_cmd_status)
    p_chk = sub.add_parser("check")
    p_chk.add_argument("--first-user-msg", required=True)
    p_chk.set_defaults(func=_cmd_check)
    p_ado = sub.add_parser("adopt")
    p_ado.add_argument("--first-user-msg", required=True)
    p_ado.set_defaults(func=_cmd_adopt)
    sub.add_parser("clear").set_defaults(func=_cmd_clear)
    p_rot = sub.add_parser("rotate")
    p_rot.add_argument("--max-kb", type=int, default=256)
    p_rot.add_argument("--mode", default="rotate", choices=sorted(VALID_OVERFLOW))
    p_rot.set_defaults(func=_cmd_rotate)
    args = ap.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
