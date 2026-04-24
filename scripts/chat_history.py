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
    python3 scripts/chat_history.py state --first-user-msg "..."
    python3 scripts/chat_history.py adopt --first-user-msg "..."
    python3 scripts/chat_history.py reset --first-user-msg "..." --entries-json '[...]' [--freq per_phase]
    python3 scripts/chat_history.py prepend --entries-json '[...]'
    python3 scripts/chat_history.py read [--last N | --all]
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
SCHEMA_VERSION = 2
FORMER_FPS_CAP = 10
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
    """Read the header. Migrates v1 headers in memory (adds `former_fps: []`).

    The on-disk file is not rewritten by this read; migration is lazy and
    happens on the next write (init/adopt/reset).
    """
    p = path or file_path()
    if not p.is_file() or p.stat().st_size == 0:
        return None
    try:
        with p.open(encoding="utf-8") as fh:
            first = fh.readline().strip()
        if not first:
            return None
        obj = json.loads(first)
        if not (isinstance(obj, dict) and obj.get("t") == "header"):
            return None
        obj.setdefault("former_fps", [])
        if not isinstance(obj["former_fps"], list):
            obj["former_fps"] = []
        return obj
    except (json.JSONDecodeError, OSError):
        return None


def _build_header(first_user_msg: str, freq: str,
                  former_fps: list[str] | None = None) -> dict[str, Any]:
    return {
        "t": "header",
        "v": SCHEMA_VERSION,
        "session": str(uuid.uuid4()),
        "started": _now(),
        "fp": fingerprint(first_user_msg),
        "preview": _preview(first_user_msg),
        "freq": freq,
        "former_fps": list(former_fps or []),
    }


def init(first_user_msg: str, freq: str = "per_phase", *,
         path: Path | None = None) -> dict[str, Any]:
    """Overwrite the file with a fresh header for a new session."""
    if freq not in VALID_FREQS:
        raise ValueError(f"freq must be one of {sorted(VALID_FREQS)}")
    p = path or file_path()
    header = _build_header(first_user_msg, freq)
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
    """Return 'match', 'mismatch', or 'missing' (legacy 3-state).

    Kept for backward compatibility. Prefer `ownership_state()` for the
    4-state view that distinguishes foreign from returning sessions.
    """
    header = read_header(path)
    if not header:
        return "missing"
    return "match" if header.get("fp") == fingerprint(first_user_msg) else "mismatch"


def ownership_state(first_user_msg: str, *,
                    path: Path | None = None) -> str:
    """Return 'match', 'returning', 'foreign', or 'missing'.

    `match`     — current fp equals header.fp (silent append)
    `returning` — current fp appears in header.former_fps (this chat once
                  owned the file; another session took it over since)
    `foreign`   — current fp is neither match nor former (new chat finds
                  an existing file from an unknown session)
    `missing`   — no file or no valid header
    """
    header = read_header(path)
    if not header:
        return "missing"
    fp = fingerprint(first_user_msg)
    if header.get("fp") == fp:
        return "match"
    former = header.get("former_fps") or []
    return "returning" if fp in former else "foreign"


def _push_former_fp(former_fps: list[str], old_fp: str,
                    new_fp: str) -> list[str]:
    """Move old_fp into former_fps with dedup + cap. Never include new_fp."""
    seen: list[str] = []
    for fp in [old_fp, *former_fps]:
        if fp and fp != new_fp and fp not in seen:
            seen.append(fp)
    return seen[:FORMER_FPS_CAP]


def adopt(first_user_msg: str, *, path: Path | None = None) -> dict[str, Any]:
    """Rewrite the header's fingerprint to the current conversation's.

    Preserves all body entries. Pushes the previous `fp` onto
    `former_fps` (dedup, capped at FORMER_FPS_CAP) so this former owner
    can later be detected as 'returning' if the original chat comes back.
    """
    p = path or file_path()
    header = read_header(p)
    if not header:
        raise FileNotFoundError(f"no header in {p}")
    old_fp = header.get("fp", "")
    new_fp = fingerprint(first_user_msg)
    header["v"] = SCHEMA_VERSION
    header["fp"] = new_fp
    header["preview"] = _preview(first_user_msg)
    header["adopted_at"] = _now()
    header["former_fps"] = _push_former_fp(
        header.get("former_fps") or [], old_fp, new_fp,
    )
    with p.open(encoding="utf-8") as fh:
        lines = fh.readlines()
    lines[0] = json.dumps(header, ensure_ascii=False) + "\n"
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text("".join(lines), encoding="utf-8")
    tmp.replace(p)
    return header


def _normalize_entries(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Validate + fill `ts` on each entry. Reject headers and empty `t`."""
    out: list[dict[str, Any]] = []
    for raw in entries or []:
        if not isinstance(raw, dict) or not raw.get("t"):
            raise ValueError("each entry must be a dict with non-empty 't' key")
        if raw["t"] == "header":
            raise ValueError("entries must not contain headers")
        e = dict(raw)
        e.setdefault("ts", _now())
        out.append(e)
    return out


def reset_with_entries(first_user_msg: str,
                       entries: list[dict[str, Any]],
                       freq: str = "per_phase", *,
                       former_fps: list[str] | None = None,
                       path: Path | None = None) -> dict[str, Any]:
    """Discard current file contents and rewrite with a fresh header + entries.

    Used for the 'Replace' flow: the in-memory history supersedes whatever
    is on disk. If `former_fps` is None and a header exists, the old fp is
    preserved via `_push_former_fp` so the returning/foreign state logic
    still works on later switches.
    """
    if freq not in VALID_FREQS:
        raise ValueError(f"freq must be one of {sorted(VALID_FREQS)}")
    p = path or file_path()
    new_fp = fingerprint(first_user_msg)
    if former_fps is None:
        existing = read_header(p)
        if existing:
            former_fps = _push_former_fp(
                existing.get("former_fps") or [],
                existing.get("fp", ""),
                new_fp,
            )
        else:
            former_fps = []
    header = _build_header(first_user_msg, freq, former_fps=former_fps)
    body = _normalize_entries(entries)
    p.parent.mkdir(parents=True, exist_ok=True)
    lines = [json.dumps(header, ensure_ascii=False)]
    lines += [json.dumps(e, ensure_ascii=False) for e in body]
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text("\n".join(lines) + "\n", encoding="utf-8")
    tmp.replace(p)
    return header


def prepend_entries(entries: list[dict[str, Any]], *,
                    path: Path | None = None) -> int:
    """Insert entries right after the header, before existing body entries.

    Used for the 'Merge' flow: the in-memory history (older) is placed
    before the file's existing body (newer from the adopting session).
    Returns the number of entries prepended. Header untouched.
    """
    p = path or file_path()
    if not p.is_file():
        raise FileNotFoundError(f"no file at {p}")
    with p.open(encoding="utf-8") as fh:
        existing = fh.readlines()
    if not existing:
        raise ValueError(f"empty file at {p}")
    header_line = existing[0]
    body = existing[1:]
    new_lines = [json.dumps(e, ensure_ascii=False) + "\n"
                 for e in _normalize_entries(entries)]
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text(header_line + "".join(new_lines) + "".join(body),
                   encoding="utf-8")
    tmp.replace(p)
    return len(new_lines)


def clear(*, path: Path | None = None) -> None:
    p = path or file_path()
    if p.exists():
        p.unlink()


def read_entries(last: int | None = None, *,
                 path: Path | None = None) -> list[dict[str, Any]]:
    """Return entries (excluding the header) as a list of dicts.

    `last=None` returns all entries; `last=N` returns the trailing N.
    Malformed lines are skipped silently.
    """
    p = path or file_path()
    if not p.is_file():
        return []
    entries: list[dict[str, Any]] = []
    with p.open(encoding="utf-8") as fh:
        for i, line in enumerate(fh):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if i == 0 and isinstance(obj, dict) and obj.get("t") == "header":
                continue
            if isinstance(obj, dict):
                entries.append(obj)
    if last is not None and last >= 0:
        entries = entries[-last:]
    return entries


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


def _cmd_state(args) -> int:
    print(ownership_state(args.first_user_msg))
    return 0


def _cmd_adopt(args) -> int:
    h = adopt(args.first_user_msg)
    print(json.dumps(h, ensure_ascii=False))
    return 0


def _load_entries_arg(args) -> list[dict[str, Any]]:
    if getattr(args, "entries_stdin", False):
        raw = sys.stdin.read()
    else:
        raw = args.entries_json or "[]"
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"invalid JSON for entries: {exc}") from exc
    if not isinstance(data, list):
        raise ValueError("entries must be a JSON array")
    return data


def _cmd_reset(args) -> int:
    entries = _load_entries_arg(args)
    h = reset_with_entries(args.first_user_msg, entries, freq=args.freq)
    print(json.dumps(h, ensure_ascii=False))
    return 0


def _cmd_prepend(args) -> int:
    entries = _load_entries_arg(args)
    n = prepend_entries(entries)
    print(json.dumps({"prepended": n}, ensure_ascii=False))
    return 0


def _cmd_clear(_args) -> int:
    clear()
    return 0


def _cmd_read(args) -> int:
    last = None if args.all else args.last
    entries = read_entries(last=last)
    print(json.dumps(entries, ensure_ascii=False, indent=2))
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
    p_state = sub.add_parser("state")
    p_state.add_argument("--first-user-msg", required=True)
    p_state.set_defaults(func=_cmd_state)
    p_ado = sub.add_parser("adopt")
    p_ado.add_argument("--first-user-msg", required=True)
    p_ado.set_defaults(func=_cmd_adopt)
    p_reset = sub.add_parser("reset")
    p_reset.add_argument("--first-user-msg", required=True)
    p_reset.add_argument("--freq", default="per_phase",
                         choices=sorted(VALID_FREQS))
    g_r = p_reset.add_mutually_exclusive_group(required=True)
    g_r.add_argument("--entries-json",
                     help="JSON array of entry dicts")
    g_r.add_argument("--entries-stdin", action="store_true",
                     help="read JSON array from stdin")
    p_reset.set_defaults(func=_cmd_reset)
    p_prep = sub.add_parser("prepend")
    g_p = p_prep.add_mutually_exclusive_group(required=True)
    g_p.add_argument("--entries-json",
                     help="JSON array of entry dicts")
    g_p.add_argument("--entries-stdin", action="store_true",
                     help="read JSON array from stdin")
    p_prep.set_defaults(func=_cmd_prepend)
    sub.add_parser("clear").set_defaults(func=_cmd_clear)
    p_read = sub.add_parser("read")
    grp = p_read.add_mutually_exclusive_group()
    grp.add_argument("--last", type=int, default=5,
                     help="return the trailing N entries (default: 5)")
    grp.add_argument("--all", action="store_true",
                     help="return all entries")
    p_read.set_defaults(func=_cmd_read)
    p_rot = sub.add_parser("rotate")
    p_rot.add_argument("--max-kb", type=int, default=256)
    p_rot.add_argument("--mode", default="rotate", choices=sorted(VALID_OVERFLOW))
    p_rot.set_defaults(func=_cmd_rotate)
    args = ap.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
