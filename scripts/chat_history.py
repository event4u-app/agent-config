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
    python3 scripts/chat_history.py heartbeat --first-user-msg "..."
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
DEFAULT_SETTINGS_FILE = ".agent-settings.yml"
SCHEMA_VERSION = 2
FORMER_FPS_CAP = 10
VALID_FREQS = {"per_turn", "per_phase", "per_tool"}
VALID_OVERFLOW = {"rotate", "compress"}
_WS_RE = re.compile(r"\s+")

# Exit codes for the CLI. Distinct codes let shell callers branch on state.
EXIT_OK = 0
EXIT_BAD_ARGS = 2
EXIT_OWNERSHIP_REFUSED = 3
EXIT_MISSING = 10
EXIT_FOREIGN = 11
EXIT_RETURNING = 12


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
           first_user_msg: str | None = None) -> None:
    """Append one entry. Entry must be a dict; `ts` is auto-filled.

    When `first_user_msg` is provided, the call validates ownership
    before writing: only `state == match` proceeds. Any other state
    (`foreign`, `returning`, `missing`) raises `OwnershipError`. This
    is the second line of defense against silent writes to a foreign
    session's file. Existing callers without `first_user_msg` keep the
    legacy unguarded behavior for back-compat.
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


VALID_HEARTBEAT_MODES = ("on", "off", "hybrid")
DRIFT_STATES = ("missing", "foreign", "returning")

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
    tmp = sp.with_suffix(sp.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False)
    tmp.replace(sp)
    return payload


def _read_chat_history_heartbeat_mode(settings_path: Path) -> str:
    """Read chat_history.heartbeat from .agent-settings.yml.

    Returns one of 'on' | 'off' | 'hybrid'. Default 'hybrid' (marker
    surfaces only on drift states — missing/foreign/returning — and
    stays silent on 'ok'/'disabled'). Unknown values fall back to
    'hybrid'. Mirrors the default-deny policy of `_read_chat_history_enabled`
    for the `enabled` flag, but here the default is the safer-by-design
    hybrid mode rather than off.
    """
    if not settings_path.is_file():
        return "hybrid"
    try:
        import yaml  # type: ignore[import-untyped]
    except ImportError:
        return "hybrid"
    try:
        with settings_path.open(encoding="utf-8") as fh:
            data = yaml.safe_load(fh) or {}
    except (OSError, yaml.YAMLError):
        return "hybrid"
    section = data.get("chat_history") if isinstance(data, dict) else None
    if not isinstance(section, dict):
        return "hybrid"
    raw = section.get("heartbeat", "hybrid")
    # YAML 1.1 (PyYAML default) booleanizes bare on/off to True/False.
    # Coerce back so users can write `heartbeat: on` without quoting.
    if raw is True:
        return "on"
    if raw is False:
        return "off"
    val = str(raw).lower()
    if val in VALID_HEARTBEAT_MODES:
        return val
    return "hybrid"


def turn_check(first_user_msg: str, *, path: Path | None = None,
               settings_path: Path | None = None) -> dict[str, Any]:
    """Compute the turn-start ownership state.

    Returns a structured dict the CLI renders to stdout/stderr. Pure
    function — no I/O outside the two paths it reads.
    """
    sp = settings_path or Path(DEFAULT_SETTINGS_FILE)
    if not _read_chat_history_enabled(sp):
        return {"state": "disabled", "exit": EXIT_OK}
    p = path or file_path()
    state = ownership_state(first_user_msg, path=p)
    if state == "match":
        st = status(path=p)
        return {
            "state": "ok",
            "exit": EXIT_OK,
            "entries": st.get("entries", 0),
        }
    header = read_header(p) or {}
    out: dict[str, Any] = {
        "state": state,
        "current_fp": fingerprint(first_user_msg),
        "header_fp": str(header.get("fp", "")),
        "preview": str(header.get("preview", "")),
    }
    if state == "missing":
        out["exit"] = EXIT_MISSING
    elif state == "foreign":
        out["exit"] = EXIT_FOREIGN
        st = status(path=p)
        out["entries"] = st.get("entries", 0)
    else:  # returning
        out["exit"] = EXIT_RETURNING
        st = status(path=p)
        out["entries"] = st.get("entries", 0)
    return out


def _format_age(seconds: int) -> str:
    """Render a relative duration as a compact human-readable string."""
    if seconds < 0:
        return "just now"
    if seconds < 60:
        return f"{seconds}s ago"
    if seconds < 3600:
        return f"{seconds // 60}m ago"
    if seconds < 86400:
        return f"{seconds // 3600}h ago"
    return f"{seconds // 86400}d ago"


def _last_entry_age_seconds(path: Path) -> int | None:
    """Return age of the latest non-header entry in seconds, or None.

    Reads the file once, takes the last non-empty line, parses its `ts`
    field. Tolerant of malformed lines and missing timestamps — returns
    None instead of raising. Used by `heartbeat()` to surface stale
    appends in the in-band marker.
    """
    if not path.is_file():
        return None
    last_line: str | None = None
    try:
        with path.open(encoding="utf-8") as fh:
            for raw in fh:
                stripped = raw.strip()
                if stripped:
                    last_line = stripped
    except OSError:
        return None
    if not last_line:
        return None
    try:
        obj = json.loads(last_line)
    except json.JSONDecodeError:
        return None
    if not isinstance(obj, dict) or obj.get("t") == "header":
        return None
    ts = obj.get("ts")
    if not ts or not isinstance(ts, str):
        return None
    try:
        parsed = dt.datetime.fromisoformat(ts)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    now = dt.datetime.now(dt.timezone.utc)
    return int((now - parsed).total_seconds())


def heartbeat(first_user_msg: str, *, path: Path | None = None,
              settings_path: Path | None = None) -> dict[str, Any]:
    """Compute the in-band reply marker proving the rule was executed.

    The marker is a single-line string the agent must include verbatim
    at the end of every reply. Fields surface state, entry count,
    cadence, and age of the last entry — so a stale gap (no append
    across two replies at `per_turn`/`per_phase`) is immediately
    visible to the user without any out-of-band tooling.

    Always returns exit-equivalent 0; this is observability, not a
    gate. Ownership refusal lives in `append`, the turn-start gate
    lives in `turn_check`. `heartbeat` only reports.
    """
    sp = settings_path or Path(DEFAULT_SETTINGS_FILE)
    if not _read_chat_history_enabled(sp):
        return {"state": "disabled",
                "marker": "📒 chat-history: disabled"}
    p = path or file_path()
    state = ownership_state(first_user_msg, path=p)
    st = status(path=p)
    entries = int(st.get("entries", 0)) if st.get("exists") else 0
    header = st.get("header") or {}
    freq = str(header.get("freq", "?")) if header else "?"
    if state == "match":
        age = _last_entry_age_seconds(p)
        age_str = _format_age(age) if age is not None else "no entries"
        marker = (f"📒 chat-history: ok · {entries} entries · "
                  f"{freq} · last {age_str}")
        return {"state": "ok", "entries": entries, "freq": freq,
                "last_age_seconds": age, "marker": marker}
    if state == "missing":
        return {"state": "missing",
                "marker": "📒 chat-history: missing — run init"}
    if state == "foreign":
        return {"state": "foreign", "entries": entries,
                "marker": (f"📒 chat-history: foreign · {entries} "
                           f"entries on file — render Foreign-Prompt")}
    return {"state": "returning", "entries": entries,
            "marker": (f"📒 chat-history: returning · {entries} "
                       f"entries on file — render Returning-Prompt")}


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


def hook_append(event: str, *,
                first_user_msg: str | None = None,
                payload: dict[str, Any] | None = None,
                path: Path | None = None,
                settings_path: Path | None = None) -> dict[str, Any]:
    """Platform-hook entry point — wraps init/append/sidecar.

    Designed for `SessionStart`, `UserPromptSubmit`, `PostToolUse`,
    `Stop`, `SessionEnd` style hooks across platforms. Stateless: every
    invocation reads the sidecar for the active session's first-user-msg.
    The very first call (`event == "session_start"`) writes the sidecar
    and initializes the JSONL header if missing.

    Cadence-aware: events that don't match `chat_history.frequency`
    are silently skipped. `enabled: false` short-circuits to a noop.

    Returns a structured dict the CLI emits as JSON. Never raises for
    non-fatal control-plane states (missing sidecar, cadence skip,
    disabled) — these surface as `action` values so hooks can choose
    fail_open vs fail_closed by inspecting the result.
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
        append(entry, path=p, first_user_msg=fum)
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

    raw_event = (event_override or _extract_hook_event(payload) or "").strip()
    event = PLATFORM_EVENT_MAP[platform].get(raw_event)
    if not event:
        return {"action": "skipped_unmapped_event", "platform": platform,
                "raw_event": raw_event}

    text = _extract_hook_text(payload)
    tool = _extract_hook_tool(payload)
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


def _cmd_check(args) -> int:
    print(check_ownership(args.first_user_msg))
    return 0


def _cmd_state(args) -> int:
    print(ownership_state(args.first_user_msg))
    return 0


def _format_turn_check_stdout(result: dict[str, Any]) -> str:
    """Render turn_check() result as a single key=value line for shell parsing."""
    state = result["state"]
    parts = [f"state={state}"]
    if "entries" in result:
        parts.append(f"entries={result['entries']}")
    if state in {"foreign", "returning"}:
        parts.append(f"header_fp={str(result.get('header_fp', ''))[:8]}")
        parts.append(f"current_fp={str(result.get('current_fp', ''))[:8]}")
        preview = str(result.get("preview", "")).replace('"', "'")
        if preview:
            parts.append(f'preview="{preview[:80]}"')
    return " ".join(parts)


def _turn_check_action_hint(state: str) -> str:
    """Stderr hint telling the agent which prompt to render."""
    if state == "ok":
        return ""
    if state == "disabled":
        return ""
    if state == "missing":
        return ("ACTION REQUIRED: state=missing — run "
                "`chat_history.py init --first-user-msg \"...\" "
                "--freq <frequency-from-settings>` before any other reply.")
    if state == "foreign":
        return ("ACTION REQUIRED: state=foreign — render the Foreign-Prompt "
                "from the chat-history rule (3 numbered options: Resume / "
                "New start / Ignore) before any other reply. Do not append "
                "to this file until the user picks.")
    if state == "returning":
        return ("ACTION REQUIRED: state=returning — render the "
                "Returning-Prompt from the chat-history rule (3 numbered "
                "options: Merge / Replace / Continue) before any other "
                "reply. Do not append to this file until the user picks.")
    return f"ACTION REQUIRED: unknown state={state}"


def _cmd_turn_check(args) -> int:
    settings_path = Path(args.settings) if args.settings else None
    result = turn_check(args.first_user_msg, settings_path=settings_path)
    print(_format_turn_check_stdout(result))
    hint = _turn_check_action_hint(result["state"])
    if hint:
        print(hint, file=sys.stderr)
    return int(result["exit"])


def _cmd_heartbeat(args) -> int:
    settings_path = Path(args.settings) if args.settings else None
    result = heartbeat(args.first_user_msg, settings_path=settings_path)
    if args.json:
        # JSON consumers want the full record regardless of mode.
        print(json.dumps(result, ensure_ascii=False))
        return EXIT_OK
    mode = _read_chat_history_heartbeat_mode(
        settings_path or Path(DEFAULT_SETTINGS_FILE)
    )
    state = str(result.get("state", ""))
    # off → never print. hybrid → only on drift states.
    # on → always (current behavior).
    if mode == "off":
        return EXIT_OK
    if mode == "hybrid" and state not in DRIFT_STATES:
        return EXIT_OK
    print(result["marker"])
    return EXIT_OK


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
    p_app.add_argument(
        "--first-user-msg",
        default=None,
        help=("validate ownership before writing — refuses with exit "
              f"{EXIT_OWNERSHIP_REFUSED} on foreign/returning/missing"),
    )
    p_app.set_defaults(func=_cmd_append)
    sub.add_parser("status").set_defaults(func=_cmd_status)
    p_chk = sub.add_parser("check")
    p_chk.add_argument("--first-user-msg", required=True)
    p_chk.set_defaults(func=_cmd_check)
    p_state = sub.add_parser("state")
    p_state.add_argument("--first-user-msg", required=True)
    p_state.set_defaults(func=_cmd_state)
    p_tc = sub.add_parser(
        "turn-check",
        help=("turn-start ownership gate; exit 0=ok/disabled, "
              f"{EXIT_MISSING}=missing, {EXIT_FOREIGN}=foreign, "
              f"{EXIT_RETURNING}=returning"),
    )
    p_tc.add_argument("--first-user-msg", required=True)
    p_tc.add_argument(
        "--settings",
        default=None,
        help=f"path to agent settings (default: {DEFAULT_SETTINGS_FILE})",
    )
    p_tc.set_defaults(func=_cmd_turn_check)
    p_hb = sub.add_parser(
        "heartbeat",
        help=("emit the in-band reply marker; always exit 0. "
              "Agent must include the stdout line verbatim in every reply."),
    )
    p_hb.add_argument("--first-user-msg", required=True)
    p_hb.add_argument(
        "--settings",
        default=None,
        help=f"path to agent settings (default: {DEFAULT_SETTINGS_FILE})",
    )
    p_hb.add_argument(
        "--json",
        action="store_true",
        help="emit the full result dict instead of just the marker",
    )
    p_hb.set_defaults(func=_cmd_heartbeat)
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
