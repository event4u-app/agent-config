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
    python3 scripts/chat_history.py state --first-user-msg "..."
    python3 scripts/chat_history.py adopt --first-user-msg "..."
    python3 scripts/chat_history.py reset --first-user-msg "..." --entries-json '[...]' [--freq per_phase]
    python3 scripts/chat_history.py prepend --entries-json '[...]'
    python3 scripts/chat_history.py read [--last N | --all] [--session <id>]
    python3 scripts/chat_history.py sessions [--limit N] [--include-empty] [--json]
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
DEFAULT_SETTINGS_FILE = ".agent-settings.yml"
SCHEMA_VERSION = 3
FORMER_FPS_CAP = 10
VALID_FREQS = {"per_turn", "per_phase", "per_tool"}
VALID_OVERFLOW = {"rotate", "compress"}
_WS_RE = re.compile(r"\s+")
SESSION_ID_LEN = 16
SESSION_ID_UNKNOWN = "<unknown>"
SESSION_ID_LEGACY = "<legacy>"

# Exit codes for the CLI. Distinct codes let shell callers branch on state.
EXIT_OK = 0
EXIT_BAD_ARGS = 2
EXIT_OWNERSHIP_REFUSED = 3


class OwnershipError(RuntimeError):
    """Raised when an operation is rejected because the caller's session
    does not own the chat-history file. `state` is one of
    `foreign` | `returning` | `missing`."""

    def __init__(self, state: str, *, header_fp: str = "",
                 current_fp: str = "") -> None:
        super().__init__(f"chat-history ownership refused: state={state}")
        self.state = state
        self.header_fp = header_fp
        self.current_fp = current_fp


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


def _session_tag_enabled() -> bool:
    """True iff `append()` should auto-fill the `s` field when missing.

    Default is on (v3 contract). Kill-switch via
    `AGENT_CHAT_HISTORY_SESSION_TAG=false` reverts to v2 entry shape
    so a bad rollout can be reverted without code change.
    """
    return os.environ.get(
        "AGENT_CHAT_HISTORY_SESSION_TAG", "true"
    ).strip().lower() != "false"


def _current_session_id(path: Path | None = None) -> str:
    """Return the active session id for the chat-history at `path`.

    Reads `header.fp[:16]` first; falls back to `sidecar.fp[:16]` when
    the header is missing or unreadable (header and sidecar are written
    together in `hook_append`'s `session_start` branch, so both carry
    the same fp; the sidecar acts as a redundant cache for stateless
    hook calls). Both missing → `"<unknown>"`.

    The 16-hex-char prefix of the SHA-256 fingerprint is the
    per-session marker stamped onto every body entry as `s` from
    schema v3 on.
    """
    header = read_header(path)
    fp = (header or {}).get("fp") if isinstance(header, dict) else None
    if not isinstance(fp, str) or not fp:
        side = read_sidecar(path)
        fp = (side or {}).get("fp") if isinstance(side, dict) else None
    if not isinstance(fp, str) or not fp:
        return SESSION_ID_UNKNOWN
    return fp[:SESSION_ID_LEN]


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


def append(entry: dict[str, Any], *, path: Path | None = None,
           first_user_msg: str | None = None,
           session: str | None = None) -> None:
    """Append one entry. Entry must be a dict; `ts` is auto-filled.

    When `first_user_msg` is provided, the call validates ownership
    before writing: only `state == match` proceeds. Any other state
    (`foreign`, `returning`, `missing`) raises `OwnershipError`. This
    is the second line of defense against silent writes to a foreign
    session's file. Existing callers without `first_user_msg` keep the
    legacy unguarded behavior for back-compat.

    Schema v3 (default) auto-stamps the entry with `s` (session id =
    `header.fp[:16]`) so reads can filter to the current session.
    Resolution order: caller-supplied `session=` wins; pre-filled
    `entry['s']` is preserved; otherwise `_current_session_id(path)`
    is used. Kill-switch `AGENT_CHAT_HISTORY_SESSION_TAG=false` skips
    auto-fill for downgrade-friendly rollouts.
    """
    if not isinstance(entry, dict) or not entry.get("t"):
        raise ValueError("entry must be a dict with non-empty 't' key")
    if entry["t"] == "header":
        raise ValueError("use init() to write the header, not append()")
    p = path or file_path()
    if first_user_msg is not None:
        state = ownership_state(first_user_msg, path=p)
        if state != "match":
            header = read_header(p) or {}
            raise OwnershipError(
                state,
                header_fp=str(header.get("fp", "")),
                current_fp=fingerprint(first_user_msg),
            )
    entry.setdefault("ts", _now())
    if session is not None:
        entry["s"] = session
    elif "s" not in entry and _session_tag_enabled():
        entry["s"] = _current_session_id(p)
    with p.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")


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


def _atomic_write_text(p: Path, text: str) -> None:
    """Write ``text`` to ``p`` atomically with a per-call unique tmp path.

    Multiple processes writing to the same target use disjoint tmp paths
    (PID + uuid), so concurrent ``session_start`` hooks no longer collide
    on a shared ``.tmp`` file. The final ``replace`` is atomic on POSIX.
    """
    tmp = p.with_suffix(
        f"{p.suffix}.{os.getpid()}.{uuid.uuid4().hex[:8]}.tmp",
    )
    try:
        tmp.write_text(text, encoding="utf-8")
        tmp.replace(p)
    except Exception:
        try:
            tmp.unlink()
        except OSError:
            pass
        raise


def adopt(first_user_msg: str, *, path: Path | None = None) -> dict[str, Any]:
    """Rewrite the header's fingerprint to the current conversation's.

    Preserves all body entries. Pushes the previous `fp` onto
    `former_fps` (dedup, capped at ``FORMER_FPS_CAP``) so this former
    owner can later be detected as 'returning' if the original chat
    comes back.

    ``former_fps`` overflow: when the rotation reaches
    ``FORMER_FPS_CAP`` the oldest fingerprint is dropped silently
    (see ``_push_former_fp``). No exception is raised.

    Test hook: ``AGENT_CHAT_HISTORY_FORCE_ADOPT_FAIL`` raises ``OSError``
    with the env var's value as the message before any disk write. Used
    by the concurrency / disk-failure subprocess tests; never set in
    production.
    """
    p = path or file_path()
    _force = os.environ.get("AGENT_CHAT_HISTORY_FORCE_ADOPT_FAIL")
    if _force:
        raise OSError(_force)
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
    _atomic_write_text(p, "".join(lines))
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
    _atomic_write_text(p, "\n".join(lines) + "\n")
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
    _atomic_write_text(
        p, header_line + "".join(new_lines) + "".join(body),
    )
    return len(new_lines)


def clear(*, path: Path | None = None) -> None:
    p = path or file_path()
    if p.exists():
        p.unlink()


def read_entries(last: int | None = None, *,
                 path: Path | None = None,
                 session: str | None = None) -> list[dict[str, Any]]:
    """Return entries (excluding the header) as a list of dicts.

    `last=None` returns all entries; `last=N` returns the trailing N.
    `session=None` keeps legacy "return everything" behaviour; an explicit
    string filters by exact match on each entry's `s` field. The `last`
    slice is applied **after** the session filter so callers always get
    the trailing N within the selected session.
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
    if session is not None:
        entries = [e for e in entries if e.get("s") == session]
    if last is not None and last >= 0:
        entries = entries[-last:]
    return entries


def read_entries_for_current(path: Path | None = None,
                             last: int | None = None) -> list[dict[str, Any]]:
    """Return entries scoped to the current session by default.

    Resolves the session via `_current_session_id(path)`; entries whose
    `s` matches that session are returned. The kill-switch
    `AGENT_CHAT_HISTORY_SESSION_FILTER=false` short-circuits to
    `read_entries(session=None)` so the v2 "return everything" behaviour
    can be restored at runtime without redeploying.
    """
    p = path or file_path()
    kill = os.environ.get(
        "AGENT_CHAT_HISTORY_SESSION_FILTER", "true",
    ).strip().lower()
    if kill == "false":
        return read_entries(last=last, path=p, session=None)
    return read_entries(last=last, path=p, session=_current_session_id(p))


def list_sessions(path: Path | None = None) -> list[dict[str, Any]]:
    """Return one bucket per distinct session id observed in the file.

    Each bucket carries `id`, `count`, `first_ts`, `last_ts`, `preview`.
    Preview = the first `t == "user"` entry's `text` in the session,
    truncated to 80 chars; falls back to the first entry of any type
    when no user-typed entry exists.

    Buckets are also created for `header.fp[:16]` and every fp in
    `header.former_fps[]` even when the body has no entries tagged for
    them, so historical sessions whose entries were never written
    (e.g. session_start with no follow-up) still surface (Council R2-4).
    Empty buckets carry `count == 0` and no `first_ts` / `last_ts` /
    `preview`.

    `<legacy>` and `<unknown>` appear as their own buckets when present
    in the body. Order is by `last_ts` descending; empty buckets sort
    after non-empty ones.
    """
    p = path or file_path()
    buckets: dict[str, dict[str, Any]] = {}

    def _bucket(sid: str) -> dict[str, Any]:
        b = buckets.get(sid)
        if b is None:
            b = {"id": sid, "count": 0, "first_ts": None,
                 "last_ts": None, "preview": ""}
            buckets[sid] = b
        return b

    header = read_header(p)
    if isinstance(header, dict):
        fp = header.get("fp")
        if isinstance(fp, str) and fp:
            _bucket(fp[:SESSION_ID_LEN])
        for old_fp in header.get("former_fps") or []:
            if isinstance(old_fp, str) and old_fp:
                _bucket(old_fp[:SESSION_ID_LEN])

    if p.is_file():
        with p.open(encoding="utf-8") as fh:
            for i, line in enumerate(fh):
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if not isinstance(obj, dict):
                    continue
                if i == 0 and obj.get("t") == "header":
                    continue
                sid = obj.get("s")
                if not isinstance(sid, str) or not sid:
                    sid = SESSION_ID_LEGACY
                b = _bucket(sid)
                b["count"] += 1
                ts = obj.get("ts")
                if isinstance(ts, str) and ts:
                    if b["first_ts"] is None or ts < b["first_ts"]:
                        b["first_ts"] = ts
                    if b["last_ts"] is None or ts > b["last_ts"]:
                        b["last_ts"] = ts
                if not b["preview"] or b.get("_preview_from") != "user":
                    if obj.get("t") == "user":
                        text = obj.get("text") or obj.get("payload", {}).get("text", "")
                        if isinstance(text, str) and text:
                            b["preview"] = _preview(text)
                            b["_preview_from"] = "user"
                    elif not b["preview"]:
                        text = obj.get("text") or ""
                        if isinstance(text, str) and text:
                            b["preview"] = _preview(text)
                            b["_preview_from"] = "any"

    out: list[dict[str, Any]] = []
    for b in buckets.values():
        b.pop("_preview_from", None)
        out.append(b)
    out.sort(key=lambda x: (
        0 if x["count"] > 0 else 1,
        -(0 if x["last_ts"] is None else 1),
        x["last_ts"] or "",
    ), reverse=True)
    # Re-sort: non-empty first by last_ts desc, then empty buckets last.
    non_empty = [b for b in out if b["count"] > 0]
    empty = [b for b in out if b["count"] == 0]
    non_empty.sort(key=lambda x: x["last_ts"] or "", reverse=True)
    empty.sort(key=lambda x: x["id"])
    return non_empty + empty


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


def _read_chat_history_enabled(settings_path: Path) -> bool:
    """Read chat_history.enabled from .agent-settings.yml.

    Returns False when the file is missing, malformed, lacks the
    `chat_history` section, or sets enabled to false. Default-deny so
    `turn-check` is safe to run from projects that have not opted in.
    PyYAML is imported lazily — the rest of this module works without it.
    """
    if not settings_path.is_file():
        return False
    try:
        import yaml  # type: ignore[import-untyped]
    except ImportError:
        return True  # fail open: settings file present but no parser
    try:
        with settings_path.open(encoding="utf-8") as fh:
            data = yaml.safe_load(fh) or {}
    except (OSError, yaml.YAMLError):
        return False
    section = data.get("chat_history") if isinstance(data, dict) else None
    if not isinstance(section, dict):
        return False
    return bool(section.get("enabled", False))


# Hook events that the platform-hook wrapper accepts. Mapped to entry
# types in HOOK_EVENT_ENTRY_TYPE; cadence filtering in
# CADENCE_EVENTS decides whether the event actually lands in the log
# given chat_history.frequency.
VALID_HOOK_EVENTS = (
    "session_start", "session_end", "user_prompt", "agent_response",
    "tool_use", "phase", "stop",
)
HOOK_EVENT_ENTRY_TYPE = {
    "user_prompt": "user",
    "agent_response": "agent",
    "tool_use": "tool",
    "phase": "phase",
    "stop": "agent",
    "session_end": "phase",
}
# Which events actually trigger an append for each frequency. session_*
# events are control plane (sidecar / init), not log entries, so they
# are absent from these sets.
CADENCE_EVENTS = {
    "per_turn": frozenset({"stop", "agent_response"}),
    "per_phase": frozenset({"phase", "stop", "user_prompt"}),
    "per_tool": frozenset({"tool_use"}),
}

# Per-platform mapping from the platform's native hook event name to our
# internal VALID_HOOK_EVENTS. Used by hook_dispatch() to translate
# stdin JSON payloads coming from Claude Code, Augment Code, Cursor,
# Cline, Windsurf, and Gemini CLI into a unified entry-point. Sourced
# from agents/contexts/chat-history-platform-hooks.md.
PLATFORM_EVENT_MAP: dict[str, dict[str, str]] = {
    "claude": {
        "SessionStart": "session_start",
        "UserPromptSubmit": "user_prompt",
        "PostToolUse": "tool_use",
        "Stop": "stop",
        "SessionEnd": "session_end",
        "PreCompact": "phase",
    },
    "augment": {
        "SessionStart": "session_start",
        "Stop": "stop",
        "PostToolUse": "tool_use",
        "SessionEnd": "session_end",
    },
    "cursor": {
        "sessionStart": "session_start",
        "sessionEnd": "session_end",
        "afterAgentResponse": "agent_response",
        "stop": "stop",
        "postToolUse": "tool_use",
        "beforeSubmitPrompt": "user_prompt",
    },
    "cline": {
        "TaskStart": "session_start",
        "TaskComplete": "session_end",
        "UserPromptSubmit": "user_prompt",
        "PostToolUse": "tool_use",
    },
    "windsurf": {
        "pre_user_prompt": "user_prompt",
        "post_cascade_response": "agent_response",
        "post_cascade_response_with_transcript": "agent_response",
        "post_setup_worktree": "phase",
    },
    "gemini": {
        "SessionStart": "session_start",
        "AfterAgent": "agent_response",
        "AfterTool": "tool_use",
        "SessionEnd": "session_end",
    },
    # Generic / pass-through — the caller already speaks our internal
    # event vocabulary. Useful for shell snippets that want to invoke
    # the dispatcher with a known event regardless of platform.
    "generic": {ev: ev for ev in VALID_HOOK_EVENTS},
}
VALID_PLATFORMS = tuple(PLATFORM_EVENT_MAP.keys())


def _read_chat_history_frequency(settings_path: Path) -> str:
    """Read chat_history.frequency from .agent-settings.yml. Default per_phase."""
    if not settings_path.is_file():
        return "per_phase"
    try:
        import yaml  # type: ignore[import-untyped]
    except ImportError:
        return "per_phase"
    try:
        with settings_path.open(encoding="utf-8") as fh:
            data = yaml.safe_load(fh) or {}
    except (OSError, yaml.YAMLError):
        return "per_phase"
    section = data.get("chat_history") if isinstance(data, dict) else None
    if not isinstance(section, dict):
        return "per_phase"
    val = str(section.get("frequency", "per_phase")).lower()
    return val if val in VALID_FREQS else "per_phase"


def sidecar_path(path: Path | None = None) -> Path:
    """Return the path to the session sidecar (.agent-chat-history.session).

    Sidecar carries the first-user-msg for the active session so hook
    invocations after `session_start` don't need the agent to pass it
    on every call. Lives next to the JSONL file.
    """
    base = path or file_path()
    return base.with_name(base.name + ".session")


def read_sidecar(path: Path | None = None) -> dict[str, Any] | None:
    """Read and parse the sidecar; returns None on missing or malformed."""
    sp = sidecar_path(path)
    if not sp.is_file():
        return None
    try:
        with sp.open(encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else None
    except (OSError, json.JSONDecodeError):
        return None


def write_sidecar(first_user_msg: str, *,
                  path: Path | None = None) -> dict[str, Any]:
    """Write the session sidecar atomically. Overwrites on session_start."""
    sp = sidecar_path(path)
    sp.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "first_user_msg": first_user_msg,
        "fp": fingerprint(first_user_msg),
        "started_at": _now(),
    }
    _atomic_write_text(sp, json.dumps(payload, ensure_ascii=False))
    return payload


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
        _atomic_write_text(p, header_line + "".join(kept))
        return {"action": "rotate", "kept": len(kept), "dropped": dropped}
    marker = {
        "t": "needs_compress",
        "ts": _now(),
        "reason": f"file exceeded {max_kb} KB, compress-mode requested",
    }
    append(marker, path=p)
    return {"action": "compress_marked", "kept": len(entries), "dropped": 0}


def hook_append(event: str, *,
                first_user_msg: str | None = None,
                payload: dict[str, Any] | None = None,
                path: Path | None = None,
                settings_path: Path | None = None,
                auto_adopt_on_session_start: bool = True) -> dict[str, Any]:
    """Platform-hook entry point — wraps init/append/sidecar.

    Designed for `SessionStart`, `UserPromptSubmit`, `PostToolUse`,
    `Stop`, `SessionEnd` style hooks across platforms. Stateless: every
    invocation reads the sidecar for the active session's first-user-msg.
    The very first call (`event == "session_start"`) writes the sidecar
    and initializes the JSONL header if missing.

    Cadence-aware: events that don't match `chat_history.frequency`
    are silently skipped. `enabled: false` short-circuits to a noop.

    ``auto_adopt_on_session_start`` (default ``True``): when the
    session_start hook fires against an existing history whose header
    fingerprint does not match this session, the hook silently rewrites
    the header (auto-adopts) instead of leaving the file in a foreign
    state that would refuse subsequent appends. The runtime kill-switch
    ``AGENT_CHAT_HISTORY_AUTO_ADOPT=false`` overrides the parameter and
    forces ``ownership_refused`` (pre-merge behavior). On disk errors
    inside ``adopt`` the action is reported as ``adopt_failed`` and the
    file is left untouched (silent-failure contract preserved).

    Returns a structured dict the CLI emits as JSON. Never raises for
    non-fatal control-plane states (missing sidecar, cadence skip,
    disabled, foreign ownership, adopt_failed) — these surface as
    `action` values so hooks can choose fail_open vs fail_closed by
    inspecting the result.
    """
    if event not in VALID_HOOK_EVENTS:
        raise ValueError(f"event must be one of {sorted(VALID_HOOK_EVENTS)}")
    sp = settings_path or Path(DEFAULT_SETTINGS_FILE)
    if not _read_chat_history_enabled(sp):
        return {"action": "disabled", "event": event}
    p = path or file_path()
    payload = payload or {}

    if event == "session_start":
        if not first_user_msg:
            return {"action": "skipped_no_first_user_msg", "event": event}
        write_sidecar(first_user_msg, path=p)
        if not p.is_file() or read_header(p) is None:
            freq = _read_chat_history_frequency(sp)
            init(first_user_msg, freq=freq, path=p)
            return {"action": "initialized", "event": event,
                    "fp": fingerprint(first_user_msg)}
        # Header exists — auto-adopt foreign sessions so the rest of the
        # hook lifecycle can append. Kill-switch via env var lets us
        # disable the adopt at runtime without redeploying.
        state = ownership_state(first_user_msg, path=p)
        if state == "foreign" and auto_adopt_on_session_start:
            kill = os.environ.get(
                "AGENT_CHAT_HISTORY_AUTO_ADOPT", "true",
            ).strip().lower()
            if kill == "false":
                return {"action": "ownership_refused", "event": event,
                        "state": state,
                        "fp": fingerprint(first_user_msg)}
            try:
                adopt(first_user_msg, path=p)
            except Exception as exc:  # noqa: BLE001
                sys.stderr.write(
                    f"chat-history adopt_failed: {exc}\n",
                )
                return {"action": "adopt_failed", "event": event,
                        "reason": str(exc)}
            return {"action": "adopted", "event": event,
                    "fp": fingerprint(first_user_msg)}
        return {"action": "sidecar_written", "event": event,
                "fp": fingerprint(first_user_msg)}

    side = read_sidecar(p)
    fum = first_user_msg or (side or {}).get("first_user_msg")
    if not fum:
        return {"action": "skipped_no_sidecar", "event": event,
                "hint": "session_start hook never ran or sidecar was deleted"}

    if event == "session_end":
        # Control plane only — touch sidecar's last-seen but do not append.
        return {"action": "session_end_noop", "event": event}

    freq = _read_chat_history_frequency(sp)
    if event not in CADENCE_EVENTS.get(freq, frozenset()):
        return {"action": "skipped_cadence", "event": event, "frequency": freq}

    entry_type = HOOK_EVENT_ENTRY_TYPE.get(event, "agent")
    entry: dict[str, Any] = {"t": entry_type}
    text = str(payload.get("text", "")).strip()
    if text:
        entry["text"] = _preview(text, 200)
    if event == "tool_use":
        tool = payload.get("tool")
        if tool:
            entry["tool"] = str(tool)
    for k in ("source", "phase", "decision"):
        if payload.get(k):
            entry[k] = str(payload[k])
    try:
        append(entry, path=p, first_user_msg=fum,
               session=_current_session_id(p))
    except OwnershipError as exc:
        return {"action": "ownership_refused", "event": event,
                "state": exc.state,
                "header_fp": exc.header_fp[:8],
                "current_fp": exc.current_fp[:8]}
    return {"action": "appended", "event": event, "type": entry_type}


def _extract_hook_text(payload: dict[str, Any]) -> str:
    """Pull a textual snippet out of a platform's hook payload.

    Tries common field names across Claude Code, Augment Code, Cursor,
    Cline, Windsurf, and Gemini CLI. Returns the first non-empty string
    found, stripped; empty string when nothing usable is present.
    """
    for key in ("prompt", "user_prompt", "first_user_msg", "firstUserMsg",
                "userMessage", "user_message", "text", "response", "message",
                "content"):
        v = payload.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    # Tool response wrappers (Claude PostToolUse, etc.) — best-effort.
    tr = payload.get("tool_response") or payload.get("toolResponse")
    if isinstance(tr, dict):
        for key in ("output", "stdout", "result", "text"):
            v = tr.get(key)
            if isinstance(v, str) and v.strip():
                return v.strip()
    return ""


def _extract_hook_tool(payload: dict[str, Any]) -> str:
    """Pull the tool name out of a platform's hook payload."""
    for key in ("tool_name", "toolName", "tool"):
        v = payload.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return ""


def _extract_hook_event(payload: dict[str, Any]) -> str:
    """Pull the platform's native hook event name out of the payload."""
    for key in ("hook_event_name", "event", "eventName", "event_name"):
        v = payload.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return ""


def _extract_session_id(payload: dict[str, Any]) -> str:
    """Pull a stable session identifier out of a platform's hook payload.

    Used by hook_dispatch as a fallback first-user-msg source on
    platforms whose SessionStart payload does not include the user
    prompt (notably Augment Code).
    """
    for key in ("session_id", "sessionId", "task_id", "taskId",
                "conversation_id", "conversationId"):
        v = payload.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return ""


def hook_dispatch(platform: str, raw_json: str, *,
                  event_override: str | None = None,
                  path: Path | None = None,
                  settings_path: Path | None = None) -> dict[str, Any]:
    """Read a platform's stdin JSON, translate to our hook vocabulary, dispatch.

    Used by `chat_history.py hook-dispatch --platform <name>` so consumer
    projects can wire their `.claude/settings.json` / `.augment/settings.json`
    / `.cursor/hooks.json` etc. to a single command. The mapping comes from
    PLATFORM_EVENT_MAP; unmapped events are silently skipped (returned as
    `skipped_unmapped_event` so the caller can decide fail-open vs
    fail-closed).

    Bootstrap: when the platform fires the very first non-`session_start`
    event (e.g. `UserPromptSubmit`) and no sidecar exists yet, the
    dispatcher synthesizes a `session_start` first using the prompt as the
    `first_user_msg`. This handles platforms whose `SessionStart` payload
    does not carry the prompt itself.
    """
    if platform not in PLATFORM_EVENT_MAP:
        raise ValueError(
            f"unknown platform: {platform!r}; "
            f"expected one of {sorted(VALID_PLATFORMS)}"
        )
    raw = (raw_json or "").strip()
    if not raw:
        payload: dict[str, Any] = {}
    else:
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError(f"invalid JSON on stdin: {exc}") from exc
        if not isinstance(payload, dict):
            raise ValueError("stdin JSON must decode to an object")

    # Unwrap dispatcher envelope (Phase 7.3, hook-architecture-v1.md). When
    # the dispatcher invoked us, stdin carries {schema_version, platform,
    # event, payload, …}; pull the platform-native data out of `payload`
    # and let the envelope's `event` override the per-platform mapping.
    envelope_event = ""
    if all(k in payload for k in ("schema_version", "platform", "event", "payload")):
        envelope_event = (payload.get("native_event") or payload.get("event") or "").strip()
        inner = payload.get("payload")
        payload = inner if isinstance(inner, dict) else {}

    raw_event = (event_override or envelope_event or _extract_hook_event(payload) or "").strip()
    event = PLATFORM_EVENT_MAP[platform].get(raw_event)
    if not event:
        return {"action": "skipped_unmapped_event", "platform": platform,
                "raw_event": raw_event}

    text = _extract_hook_text(payload)
    tool = _extract_hook_tool(payload)
    # Some platforms (Augment Code) fire SessionStart without the user
    # prompt and offer no UserPromptSubmit equivalent. Synthesize a
    # stable pseudo-prompt from session_id so the sidecar gets written
    # and Stop / PostToolUse hooks can append per-turn entries.
    if event == "session_start" and not text:
        sid = _extract_session_id(payload)
        if sid:
            text = f"<session:{platform}:{sid}>"
    # The user's first message is what we hash for ownership. We can only
    # extract it from prompt-bearing events; for stop / tool_use / *_end
    # the sidecar must already exist.
    fum = text if event in {"session_start", "user_prompt"} else None

    hook_payload: dict[str, Any] = {"source": f"hook:{platform}:{raw_event}"}
    if text and event != "session_start":
        hook_payload["text"] = text
    if tool:
        hook_payload["tool"] = tool

    p = path or file_path()

    if event == "session_start":
        return hook_append("session_start", first_user_msg=fum,
                           path=path, settings_path=settings_path)

    # Bootstrap: the first non-session_start event from a platform whose
    # SessionStart did not carry the prompt (e.g. Claude Code) needs an
    # implicit init so ownership and the sidecar exist before append.
    side = read_sidecar(p)
    if side is None and fum:
        hook_append("session_start", first_user_msg=fum,
                    path=path, settings_path=settings_path)

    return hook_append(event, first_user_msg=fum, payload=hook_payload,
                       path=path, settings_path=settings_path)


def _cmd_init(args) -> int:
    h = init(args.first_user_msg, freq=args.freq)
    print(json.dumps(h, ensure_ascii=False))
    return 0


def _cmd_hook_append(args) -> int:
    payload: dict[str, Any] = {}
    if args.payload:
        try:
            payload = json.loads(args.payload)
        except json.JSONDecodeError as exc:
            print(f"error: --payload must be valid JSON: {exc}",
                  file=sys.stderr)
            return EXIT_BAD_ARGS
        if not isinstance(payload, dict):
            print("error: --payload must decode to a JSON object",
                  file=sys.stderr)
            return EXIT_BAD_ARGS
    settings_path = Path(args.settings) if args.settings else None
    try:
        result = hook_append(
            args.event,
            first_user_msg=args.first_user_msg,
            payload=payload,
            settings_path=settings_path,
        )
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return EXIT_BAD_ARGS
    print(json.dumps(result, ensure_ascii=False))
    if result.get("action") == "ownership_refused":
        return EXIT_OWNERSHIP_REFUSED
    return EXIT_OK


def _cmd_hook_dispatch(args) -> int:
    raw = sys.stdin.read() if not sys.stdin.isatty() else ""
    settings_path = Path(args.settings) if args.settings else None
    try:
        result = hook_dispatch(
            args.platform,
            raw,
            event_override=args.event,
            settings_path=settings_path,
        )
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return EXIT_BAD_ARGS
    print(json.dumps(result, ensure_ascii=False))
    if result.get("action") == "ownership_refused":
        return EXIT_OWNERSHIP_REFUSED
    return EXIT_OK


def _cmd_append(args) -> int:
    entry = json.loads(args.json) if args.json else {}
    entry.setdefault("t", args.type)
    if not entry.get("t"):
        print("error: --type or a 't' key in --json is required",
              file=sys.stderr)
        return EXIT_BAD_ARGS
    try:
        append(entry, first_user_msg=args.first_user_msg)
    except OwnershipError as exc:
        print(
            f"error: append refused — state={exc.state}; "
            f"header_fp={exc.header_fp[:8]} current_fp={exc.current_fp[:8]}. "
            f"Run `chat_history.py turn-check --first-user-msg \"...\"` "
            f"and resolve ownership before retrying.",
            file=sys.stderr,
        )
        return EXIT_OWNERSHIP_REFUSED
    return EXIT_OK


def _cmd_status(_args) -> int:
    print(json.dumps(status(), ensure_ascii=False, indent=2))
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
    if args.all:
        entries = read_entries(last=last, session=None)
    elif args.session is not None:
        entries = read_entries(last=last, session=args.session)
    else:
        entries = read_entries_for_current(last=last)
    print(json.dumps(entries, ensure_ascii=False, indent=2))
    return 0


def _cmd_sessions(args) -> int:
    sessions = list_sessions()
    if not args.include_empty:
        sessions = [s for s in sessions if s["count"] > 0]
    sessions = sessions[: args.limit]
    if args.json:
        print(json.dumps(sessions, ensure_ascii=False, indent=2))
        return 0
    if not sessions:
        print("(no sessions)")
        return 0
    rows = [("ID", "COUNT", "LAST_TS", "PREVIEW")]
    for s in sessions:
        rows.append((
            s["id"],
            str(s["count"]),
            s["last_ts"] or "-",
            s["preview"] or "-",
        ))
    widths = [max(len(r[i]) for r in rows) for i in range(4)]
    for i, r in enumerate(rows):
        line = "  ".join(r[j].ljust(widths[j]) for j in range(4))
        print(line)
        if i == 0:
            print("  ".join("-" * widths[j] for j in range(4)))
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
    p_app.add_argument(
        "--first-user-msg",
        default=None,
        help=("validate ownership before writing — refuses with exit "
              f"{EXIT_OWNERSHIP_REFUSED} on foreign/returning/missing"),
    )
    p_app.set_defaults(func=_cmd_append)
    sub.add_parser("status").set_defaults(func=_cmd_status)
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
                     help="return all entries (across all sessions)")
    p_read.add_argument(
        "--session", default=None,
        help=("filter to entries with this session id (e.g. fp[:16], "
              "'<legacy>', '<unknown>'); defaults to the current session"),
    )
    p_read.set_defaults(func=_cmd_read)
    p_sess = sub.add_parser("sessions")
    p_sess.add_argument("--limit", type=int, default=20,
                        help="max non-empty sessions to print (default: 20)")
    p_sess.add_argument("--include-empty", action="store_true",
                        help="include former_fps[] sessions with no body entries")
    p_sess.add_argument("--json", action="store_true",
                        help="emit JSON instead of a human-readable table")
    p_sess.set_defaults(func=_cmd_sessions)
    p_rot = sub.add_parser("rotate")
    p_rot.add_argument("--max-kb", type=int, default=256)
    p_rot.add_argument("--mode", default="rotate", choices=sorted(VALID_OVERFLOW))
    p_rot.set_defaults(func=_cmd_rotate)
    p_hook = sub.add_parser(
        "hook-append",
        help=("platform-hook entry point — wraps init/append/sidecar; "
              "stateless after the first session_start call"),
    )
    p_hook.add_argument(
        "--event",
        required=True,
        choices=sorted(VALID_HOOK_EVENTS),
        help="hook event name (session_start required first)",
    )
    p_hook.add_argument(
        "--first-user-msg",
        default=None,
        help=("required on session_start; subsequent events read it from "
              "the sidecar"),
    )
    p_hook.add_argument(
        "--payload",
        default=None,
        help=("JSON object with event-specific fields "
              "(text/tool/source/phase/decision)"),
    )
    p_hook.add_argument(
        "--settings",
        default=None,
        help=f"path to agent settings (default: {DEFAULT_SETTINGS_FILE})",
    )
    p_hook.set_defaults(func=_cmd_hook_append)
    p_disp = sub.add_parser(
        "hook-dispatch",
        help=("platform-hook entry point — reads platform JSON from stdin, "
              "translates the native event name to our vocabulary, and "
              "invokes hook-append"),
    )
    p_disp.add_argument(
        "--platform",
        required=True,
        choices=sorted(VALID_PLATFORMS),
        help="source platform whose hook is firing",
    )
    p_disp.add_argument(
        "--event",
        default=None,
        help=("override the platform-native event name (default: read "
              "from stdin payload key hook_event_name / event)"),
    )
    p_disp.add_argument(
        "--settings",
        default=None,
        help=f"path to agent settings (default: {DEFAULT_SETTINGS_FILE})",
    )
    p_disp.set_defaults(func=_cmd_hook_dispatch)
    args = ap.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
