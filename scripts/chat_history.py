#!/usr/bin/env python3
"""Persistent chat-history log for crash recovery.

Maintains `.agent-chat-history` in the project root — a JSONL file whose
first line is a header (schema version, started timestamp, cadence
frequency) and whose remaining lines are append-only entries (user
messages, phases, tool calls, questions, answers, decisions, commits).

Sessions are identified per-entry via the `s` field — a deterministic
16-char prefix derived from the platform's `session_id`. Multiple
sessions coexist in one file; each entry self-identifies. No ownership
layer, no sidecar, no auto-adopt — every hook invocation simply appends
with its own session tag.

File path defaults to `.agent-chat-history` in CWD and can be overridden
via `$AGENT_CHAT_HISTORY_FILE` (used by tests).

Usage:
    python3 scripts/chat_history.py init [--freq per_phase]
    python3 scripts/chat_history.py append --type phase --json '{...}'
    python3 scripts/chat_history.py status
    python3 scripts/chat_history.py reset --entries-json '[...]' [--freq per_phase]
    python3 scripts/chat_history.py prepend --entries-json '[...]'
    python3 scripts/chat_history.py read [--last N | --all] [--session <id>]
    python3 scripts/chat_history.py sessions [--limit N] [--json]
    python3 scripts/chat_history.py prune-sessions [--max N] [--dry-run]
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
SCHEMA_VERSION = 4
DEFAULT_MAX_SESSIONS = 5
VALID_FREQS = {"per_turn", "per_phase", "per_tool"}
VALID_OVERFLOW = {"rotate", "compress"}
_WS_RE = re.compile(r"\s+")
SESSION_ID_LEN = 16
SESSION_ID_UNKNOWN = "<unknown>"
SESSION_ID_LEGACY = "<legacy>"

# Per-entry-type text-length caps. 0 = full text, no whitespace collapse,
# verbatim. N > 0 = collapse whitespace then slice to N chars and append a
# "… [+K chars]" suffix so the log self-reports truncation. Overridable via
# chat_history.text_limits.{user,agent,tool,phase} in .agent-settings.yml.
DEFAULT_TEXT_LIMITS = {"user": 0, "agent": 5000, "tool": 200, "phase": 200}

# Exit codes for the CLI. Distinct codes let shell callers branch on state.
EXIT_OK = 0
EXIT_BAD_ARGS = 2


def file_path() -> Path:
    return Path(os.environ.get("AGENT_CHAT_HISTORY_FILE") or DEFAULT_FILE)


def _now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def fingerprint(value: str) -> str:
    """SHA-256 of the normalized input (whitespace collapsed).

    In v4 the input is the platform's ``session_id`` (or any stable
    string). In v3 callers passed the first user message; the function
    is signature-stable so v3 readers continue to work.
    """
    normalized = _WS_RE.sub(" ", value or "").strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def derive_session_tag(session_id: str) -> str:
    """Map a platform's ``session_id`` to the 16-char ``s`` body tag.

    Deterministic — same input always yields the same tag, so stateless
    hook invocations within one session converge on a single ``s``
    without needing any cached state on disk.
    """
    if not session_id:
        return SESSION_ID_UNKNOWN
    return fingerprint(session_id)[:SESSION_ID_LEN]


def _preview(msg: str, n: int = 80) -> str:
    flat = _WS_RE.sub(" ", msg or "").strip()
    return flat[:n]


def _session_tag_enabled() -> bool:
    """True iff `append()` should auto-fill the `s` field when missing.

    Default is on (v3+ contract). Kill-switch via
    `AGENT_CHAT_HISTORY_SESSION_TAG=false` reverts to v2 entry shape
    so a bad rollout can be reverted without code change.
    """
    return os.environ.get(
        "AGENT_CHAT_HISTORY_SESSION_TAG", "true"
    ).strip().lower() != "false"


def _last_body_session_id(path: Path | None = None) -> str:
    """Return the ``s`` of the most recent body entry, or ``<unknown>``.

    Used as a fallback ``s`` for CLI-driven appends that have no
    platform session context. Reads the file tail-first to keep the
    cost constant on large logs.
    """
    p = path or file_path()
    if not p.is_file() or p.stat().st_size == 0:
        return SESSION_ID_UNKNOWN
    try:
        with p.open(encoding="utf-8") as fh:
            lines = fh.readlines()
    except OSError:
        return SESSION_ID_UNKNOWN
    for line in reversed(lines):
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(obj, dict) or obj.get("t") == "header":
            continue
        sid = obj.get("s")
        if isinstance(sid, str) and sid:
            return sid
    return SESSION_ID_UNKNOWN


def read_header(path: Path | None = None) -> dict[str, Any] | None:
    """Read the header.

    Forward-compatible: v3 headers (`fp`, `preview`, `former_fps`,
    `session`) parse fine; their legacy fields are returned verbatim
    so older readers keep working. The next write (init/reset)
    rewrites the file with a clean v4 header.
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
        return obj
    except (json.JSONDecodeError, OSError):
        return None


def _build_header(freq: str) -> dict[str, Any]:
    return {
        "t": "header",
        "v": SCHEMA_VERSION,
        "started": _now(),
        "freq": freq,
    }


def init(freq: str = "per_phase", *,
         path: Path | None = None) -> dict[str, Any]:
    """Overwrite the file with a fresh v4 header."""
    if freq not in VALID_FREQS:
        raise ValueError(f"freq must be one of {sorted(VALID_FREQS)}")
    p = path or file_path()
    header = _build_header(freq)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w", encoding="utf-8") as fh:
        fh.write(json.dumps(header, ensure_ascii=False) + "\n")
    return header


def migrate_header(path: Path | None = None, *,
                   freq: str | None = None) -> dict[str, Any] | None:
    """Rewrite a stale header in-place, preserving body and ``started``.

    Returns the new header on migration, ``None`` when the file is
    missing/empty/unreadable or the header is already at
    :data:`SCHEMA_VERSION`. v3 headers carry parseable ``v``/``freq``/
    ``started`` fields that are forward-compatible (see
    :func:`read_header`); this helper is the only writer that flips
    ``v`` without destroying the body. Atomic — the body never
    diverges from the header version mid-write.
    """
    p = path or file_path()
    existing = read_header(p)
    if existing is None:
        return None
    try:
        current_v = int(existing.get("v", 0))
    except (TypeError, ValueError):
        current_v = 0
    if current_v >= SCHEMA_VERSION:
        return None
    chosen_freq = freq or existing.get("freq") or "per_phase"
    if chosen_freq not in VALID_FREQS:
        chosen_freq = "per_phase"
    new_header = _build_header(chosen_freq)
    # Preserve the original session start so chronology survives.
    if isinstance(existing.get("started"), str):
        new_header["started"] = existing["started"]
    raw = p.read_text(encoding="utf-8")
    # splitlines() drops the trailing newline; rebuild it on write so
    # downstream readers (which expect newline-delimited JSONL) stay
    # happy. Empty body → just the header line + newline.
    lines = raw.splitlines()
    if not lines:
        return None
    lines[0] = json.dumps(new_header, ensure_ascii=False)
    _atomic_write_text(p, "\n".join(lines) + "\n")
    return new_header


def append(entry: dict[str, Any], *, path: Path | None = None,
           session: str | None = None) -> None:
    """Append one entry. Entry must be a dict; `ts` is auto-filled.

    Schema v4 stamps every body entry with `s` (16-char session tag).
    Resolution order: caller-supplied `session=` wins; pre-filled
    `entry['s']` is preserved; otherwise the most recent body entry's
    `s` is reused (CLI fallback). Kill-switch
    `AGENT_CHAT_HISTORY_SESSION_TAG=false` skips auto-fill for
    downgrade-friendly rollouts.

    No ownership validation: each entry self-identifies via `s`, so
    multiple sessions coexist in one file without conflict.
    """
    if not isinstance(entry, dict) or not entry.get("t"):
        raise ValueError("entry must be a dict with non-empty 't' key")
    if entry["t"] == "header":
        raise ValueError("use init() to write the header, not append()")
    p = path or file_path()
    entry.setdefault("ts", _now())
    if session is not None:
        entry["s"] = session
    elif "s" not in entry and _session_tag_enabled():
        entry["s"] = _last_body_session_id(p)
    with p.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")


def _atomic_write_text(p: Path, text: str) -> None:
    """Write ``text`` to ``p`` atomically with a per-call unique tmp path.

    Multiple processes writing to the same target use disjoint tmp paths
    (PID + uuid), so concurrent writes no longer collide on a shared
    ``.tmp`` file. The final ``replace`` is atomic on POSIX.
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


def reset_with_entries(entries: list[dict[str, Any]],
                       freq: str = "per_phase", *,
                       path: Path | None = None) -> dict[str, Any]:
    """Discard current file contents and rewrite with a fresh header + entries.

    Used for the 'Replace' flow: the in-memory history supersedes
    whatever is on disk. v4 carries no per-session header state, so
    the rewrite is a clean slate; pre-existing entries' ``s`` tags
    survive only if the caller passes them through ``entries``.
    """
    if freq not in VALID_FREQS:
        raise ValueError(f"freq must be one of {sorted(VALID_FREQS)}")
    p = path or file_path()
    header = _build_header(freq)
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
    """Return entries scoped to the most recent session in the file.

    The "current" session in v4 is the ``s`` of the most recent body
    entry; entries with that ``s`` are returned. Kill-switch
    ``AGENT_CHAT_HISTORY_SESSION_FILTER=false`` short-circuits to
    ``read_entries(session=None)`` for the v2 "return everything"
    behaviour.
    """
    p = path or file_path()
    kill = os.environ.get(
        "AGENT_CHAT_HISTORY_SESSION_FILTER", "true",
    ).strip().lower()
    if kill == "false":
        return read_entries(last=last, path=p, session=None)
    return read_entries(last=last, path=p, session=_last_body_session_id(p))


def list_sessions(path: Path | None = None) -> list[dict[str, Any]]:
    """Return one bucket per distinct session id observed in the body.

    Each bucket carries ``id``, ``count``, ``first_ts``, ``last_ts``,
    ``preview``. Preview = the first ``t == "user"`` entry's ``text``
    in the session, truncated to 80 chars; falls back to the first
    entry of any type when no user-typed entry exists.

    v4 has no per-session header state, so buckets are derived from
    body ``s`` values only. ``<legacy>`` and ``<unknown>`` appear as
    their own buckets when present in the body. Order is by
    ``last_ts`` descending.
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
    out.sort(key=lambda x: x["last_ts"] or "", reverse=True)
    return out


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
    "per_turn": frozenset({"stop", "agent_response", "user_prompt"}),
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
    # Cowork is the Claude desktop app's local-agent-mode runtime —
    # built on top of the Claude Code CLI, so it speaks the same hook
    # vocabulary (PascalCase, identical event payload shape including
    # `transcript_path` for Stop). Listed as a separate platform so the
    # `agent` field on body entries can distinguish Cowork sessions
    # from plain Claude Code CLI / IDE sessions when both run against
    # the same project.
    #
    # Upstream caveat: anthropics/claude-code#40495 reports that
    # Cowork sessions silently ignore all three Claude Code settings
    # sources (user, project, env), and #27398 reports plugin-scope
    # `hooks/hooks.json` is excluded because Cowork spawns the CLI
    # with `--setting-sources user`. Until those are resolved, the
    # mapping below is dispatcher-ready but the lifecycle events do
    # not actually fire from Cowork. See
    # `agents/contexts/chat-history-platform-hooks.md` § Cowork.
    "cowork": {
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


def _read_chat_history_max_sessions(settings_path: Path) -> int:
    """Read chat_history.max_sessions from .agent-settings.yml.

    Default ``DEFAULT_MAX_SESSIONS`` (5). Values < 1 are clamped to 1.
    Used by ``prune_sessions`` to decide how many distinct ``s`` tags
    survive in the body.
    """
    if not settings_path.is_file():
        return DEFAULT_MAX_SESSIONS
    try:
        import yaml  # type: ignore[import-untyped]
    except ImportError:
        return DEFAULT_MAX_SESSIONS
    try:
        with settings_path.open(encoding="utf-8") as fh:
            data = yaml.safe_load(fh) or {}
    except (OSError, yaml.YAMLError):
        return DEFAULT_MAX_SESSIONS
    section = data.get("chat_history") if isinstance(data, dict) else None
    if not isinstance(section, dict):
        return DEFAULT_MAX_SESSIONS
    try:
        n = int(section.get("max_sessions", DEFAULT_MAX_SESSIONS))
    except (TypeError, ValueError):
        return DEFAULT_MAX_SESSIONS
    return max(1, n)


def _read_text_limits(settings_path: Path) -> dict[str, int]:
    """Read chat_history.text_limits from .agent-settings.yml.

    Returns a dict keyed by entry type (``user``, ``agent``, ``tool``,
    ``phase``) with int caps. Missing keys fall back to
    ``DEFAULT_TEXT_LIMITS``. ``0`` means "no slice, full text". Negative
    values are clamped to 0. Non-int values are silently dropped.
    """
    out = dict(DEFAULT_TEXT_LIMITS)
    if not settings_path.is_file():
        return out
    try:
        import yaml  # type: ignore[import-untyped]
    except ImportError:
        return out
    try:
        with settings_path.open(encoding="utf-8") as fh:
            data = yaml.safe_load(fh) or {}
    except (OSError, yaml.YAMLError):
        return out
    section = data.get("chat_history") if isinstance(data, dict) else None
    if not isinstance(section, dict):
        return out
    overrides = section.get("text_limits")
    if not isinstance(overrides, dict):
        return out
    for kind, val in overrides.items():
        if not isinstance(kind, str):
            continue
        try:
            n = int(val)
        except (TypeError, ValueError):
            continue
        out[kind] = max(0, n)
    return out


def _apply_text_limit(text: str, kind: str,
                      limits: dict[str, int]) -> str:
    """Slice ``text`` to the configured cap for ``kind``.

    ``limits[kind] == 0`` returns the text verbatim (whitespace
    preserved). ``> 0`` collapses whitespace, slices to N chars, and
    appends ``" … [+K chars]"`` when truncation actually happened so
    the log self-reports the cut. Empty / missing kind falls back to
    ``DEFAULT_TEXT_LIMITS``.
    """
    if not text:
        return ""
    n = limits.get(kind, DEFAULT_TEXT_LIMITS.get(kind, 0))
    if n <= 0:
        return text
    flat = _WS_RE.sub(" ", text).strip()
    if len(flat) <= n:
        return flat
    return f"{flat[:n]} … [+{len(flat) - n} chars]"


def prune_sessions(max_sessions: int = DEFAULT_MAX_SESSIONS, *,
                   path: Path | None = None) -> dict[str, Any]:
    """Keep only the ``max_sessions`` most-recent sessions in the body.

    Recency is the body line index of a session's last entry — the body
    is append-only, so position is canonical (and stable when multiple
    sessions share a wall-clock second). The trailing ``max_sessions``
    win, the rest of their entries are dropped. Header untouched.
    ``<unknown>`` and ``<legacy>`` count as ordinary sessions for the
    purpose of this cap.

    Returns ``{action, kept_sessions, dropped_sessions, dropped_entries}``.
    Noop when the file is missing, has no body, or carries fewer than
    ``max_sessions`` distinct sessions.
    """
    if max_sessions < 1:
        max_sessions = 1
    p = path or file_path()
    if not p.is_file():
        return {"action": "noop", "kept_sessions": 0,
                "dropped_sessions": 0, "dropped_entries": 0}
    with p.open(encoding="utf-8") as fh:
        lines = fh.readlines()
    if len(lines) <= 1:
        return {"action": "noop", "kept_sessions": 0,
                "dropped_sessions": 0, "dropped_entries": 0}
    header_line = lines[0]
    body = lines[1:]
    # Rank sessions by body position — last appearance wins. Body is
    # append-only, so position is canonical recency; ts is only a
    # secondary signal (tied on second-level resolution in practice).
    last_pos: dict[str, int] = {}
    parsed: list[tuple[str, str]] = []  # (sid, raw_line)
    for idx, line in enumerate(body):
        stripped = line.strip()
        if not stripped:
            continue
        try:
            obj = json.loads(stripped)
        except json.JSONDecodeError:
            parsed.append((SESSION_ID_LEGACY, line))
            last_pos[SESSION_ID_LEGACY] = idx
            continue
        if not isinstance(obj, dict):
            continue
        sid = obj.get("s") if isinstance(obj.get("s"), str) else SESSION_ID_LEGACY
        parsed.append((sid, line))
        last_pos[sid] = idx
    if len(last_pos) <= max_sessions:
        return {"action": "noop", "kept_sessions": len(last_pos),
                "dropped_sessions": 0, "dropped_entries": 0}
    ranked = sorted(last_pos.items(), key=lambda kv: kv[1], reverse=True)
    keep_set = {sid for sid, _ in ranked[:max_sessions]}
    drop_set = {sid for sid, _ in ranked[max_sessions:]}
    kept_lines = [line for sid, line in parsed if sid in keep_set]
    dropped_entries = len(parsed) - len(kept_lines)
    _atomic_write_text(p, header_line + "".join(kept_lines))
    return {"action": "pruned", "kept_sessions": len(keep_set),
            "dropped_sessions": len(drop_set),
            "dropped_entries": dropped_entries}


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
                session_id: str | None = None,
                payload: dict[str, Any] | None = None,
                path: Path | None = None,
                settings_path: Path | None = None) -> dict[str, Any]:
    """Platform-hook entry point — stateless append per session tag.

    Designed for ``SessionStart``, ``UserPromptSubmit``, ``PostToolUse``,
    ``Stop``, ``SessionEnd`` style hooks. Each call derives an ``s`` tag
    from ``session_id`` via :func:`derive_session_tag`; entries from
    different sessions coexist in one file because every body line
    self-identifies. No sidecar, no ownership, no auto-adopt.

    The first non-disabled call to this function on a missing/empty
    file initialises the v4 header. ``session_start`` is otherwise a
    control-plane noop — useful only as an explicit hint that a new
    session is about to begin (and to trigger pruning of old
    sessions). All other events go through cadence filtering and
    append a body entry whose ``text`` is sliced per
    :func:`_apply_text_limit`.

    Pruning: when the incoming ``s`` is new (differs from the most
    recent body entry's ``s``), :func:`prune_sessions` runs with
    ``chat_history.max_sessions`` so the file never accumulates more
    than the configured number of distinct sessions. The prune is a
    noop when the cap is not reached.

    Cadence-aware: events that don't match ``chat_history.frequency``
    are silently skipped. ``enabled: false`` short-circuits to a noop.

    Returns a structured dict the CLI emits as JSON. Never raises for
    non-fatal control-plane states (cadence skip, disabled,
    unknown-session) — these surface as ``action`` values so hooks
    can choose fail_open vs fail_closed by inspecting the result.
    """
    if event not in VALID_HOOK_EVENTS:
        raise ValueError(f"event must be one of {sorted(VALID_HOOK_EVENTS)}")
    sp = settings_path or Path(DEFAULT_SETTINGS_FILE)
    if not _read_chat_history_enabled(sp):
        return {"action": "disabled", "event": event}
    p = path or file_path()
    payload = payload or {}
    s_tag = derive_session_tag(session_id) if session_id else SESSION_ID_UNKNOWN

    # Lazily initialise the v4 header on first use so callers don't
    # have to invoke `init` separately. Reset is still an explicit
    # operation via reset_with_entries / clear. When the file already
    # has a parseable but stale header (v3 in the wild), rewrite the
    # header in-place — body is preserved, version flips to v4. Without
    # this branch, v3 headers parse as non-None and the lazy-init path
    # never fires, leaving the file in a mixed v3-header / v4-body
    # state forever.
    if not p.is_file() or read_header(p) is None:
        freq = _read_chat_history_frequency(sp)
        init(freq=freq, path=p)
    else:
        migrate_header(p, freq=_read_chat_history_frequency(sp))

    # Detect session change BEFORE appending so the new entry's `s`
    # doesn't shadow the previous one. Actual prune fires AFTER the
    # append so the cap is enforced against the post-append body
    # (otherwise the effective cap would be max_sessions + 1).
    is_new_session = (
        s_tag != SESSION_ID_UNKNOWN
        and _last_body_session_id(p) != s_tag
    )

    def _maybe_prune() -> None:
        if not is_new_session:
            return
        max_n = _read_chat_history_max_sessions(sp)
        try:
            prune_sessions(max_n, path=p)
        except OSError as exc:
            sys.stderr.write(f"chat-history prune_failed: {exc}\n")

    if event == "session_start":
        _maybe_prune()
        return {"action": "session_start_noop", "event": event, "s": s_tag}
    if event == "session_end":
        _maybe_prune()
        return {"action": "session_end_noop", "event": event, "s": s_tag}

    freq = _read_chat_history_frequency(sp)
    if event not in CADENCE_EVENTS.get(freq, frozenset()):
        return {"action": "skipped_cadence", "event": event,
                "frequency": freq}

    entry_type = HOOK_EVENT_ENTRY_TYPE.get(event, "agent")
    limits = _read_text_limits(sp)
    entry: dict[str, Any] = {"t": entry_type}
    text = str(payload.get("text", ""))
    if text:
        sliced = _apply_text_limit(text, entry_type, limits)
        if sliced:
            entry["text"] = sliced
    if event == "tool_use":
        tool = payload.get("tool")
        if tool:
            entry["tool"] = str(tool)
    for k in ("agent", "source", "phase", "decision"):
        if payload.get(k):
            entry[k] = str(payload[k])
    append(entry, path=p, session=s_tag)
    _maybe_prune()
    return {"action": "appended", "event": event,
            "type": entry_type, "s": s_tag}


def _extract_augment_conversation(
    payload: dict[str, Any],
) -> tuple[str, str]:
    """Return ``(user_prompt, agent_response)`` from an Augment payload.

    Augment Code with ``includeConversationData: true`` nests the
    turn under ``conversation`` (``userPrompt`` + ``agentTextResponse``).
    Returns empty strings when the block is absent or malformed.
    """
    conv = payload.get("conversation")
    if not isinstance(conv, dict):
        return ("", "")
    user = conv.get("userPrompt")
    agent = conv.get("agentTextResponse")
    user_s = user.strip() if isinstance(user, str) else ""
    agent_s = agent.strip() if isinstance(agent, str) else ""
    return (user_s, agent_s)


def _extract_claude_transcript_response(transcript_path: str) -> str:
    """Read Claude Code's JSONL transcript and return the last assistant text.

    Claude Code's ``Stop`` hook payload only carries ``session_id`` and
    ``transcript_path``; the actual response lives inside the JSONL file
    as a sequence of ``{"type": "assistant", "message": {"content": …}}``
    entries. Best-effort: silently returns ``""`` on missing file, decode
    error, or unexpected shape so the caller falls back to other paths.
    """
    if not transcript_path:
        return ""
    p = Path(transcript_path)
    if not p.is_file():
        return ""
    last_text = ""
    try:
        with p.open(encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if not isinstance(obj, dict):
                    continue
                if obj.get("type") != "assistant":
                    continue
                msg = obj.get("message")
                if not isinstance(msg, dict):
                    continue
                content = msg.get("content")
                if isinstance(content, str):
                    last_text = content
                elif isinstance(content, list):
                    parts: list[str] = []
                    for blk in content:
                        if (isinstance(blk, dict)
                                and blk.get("type") == "text"):
                            t = blk.get("text", "")
                            if isinstance(t, str):
                                parts.append(t)
                    if parts:
                        last_text = "\n".join(parts)
    except OSError:
        return ""
    return last_text.strip()


def _extract_cursor_text(
    payload: dict[str, Any], event: str | None,
) -> str:
    """Cursor hook payload extractor (docs-verified, 2026-05).

    Cursor's ``afterAgentResponse`` and ``stop`` hooks ship a
    ``transcript_path`` pointing at a Claude-format JSONL file (Cursor
    reuses Claude Code's transcript schema). For ``beforeSubmitPrompt``
    the prompt is in the top-level ``prompt`` key. The fallback walker
    handles both, but we route here so the transcript is preferred over
    any stale top-level field.

    Sources: <https://cursor.com/docs/hooks>,
    <https://cursor.com/docs/reference/third-party-hooks>.
    """
    if event in ("stop", "agent_response"):
        tp = payload.get("transcript_path") or payload.get("transcriptPath")
        if isinstance(tp, str):
            txt = _extract_claude_transcript_response(tp)
            if txt:
                return txt
    return ""


def _extract_cline_text(
    payload: dict[str, Any], event: str | None,
) -> str:
    """Cline hook payload extractor (docs-verified, 2026-05).

    Cline ships PascalCase event names (``UserPromptSubmit``,
    ``TaskComplete``) but body keys are camelCase. ``UserPromptSubmit``
    carries the prompt as ``prompt``; ``TaskComplete`` is mapped to
    ``session_end`` (no body text emitted by default). The top-level
    fallback already covers ``prompt``, but we route here so future
    schema extensions land in one place.

    Sources: <https://docs.cline.bot/customization/hooks>,
    <https://docs.cline.bot/features/hooks>.
    """
    if event == "user_prompt":
        v = payload.get("prompt") or payload.get("userPrompt")
        if isinstance(v, str) and v.strip():
            return v.strip()
    return ""


def _extract_gemini_text(
    payload: dict[str, Any], event: str | None,
) -> str:
    """Gemini CLI hook payload extractor (docs-verified, 2026-05).

    Gemini CLI's ``AfterAgent`` payload carries the agent text directly
    as ``prompt_response`` (snake_case, matching the rest of Gemini's
    hook keys). When absent, the dispatcher may still receive a
    ``transcript_path`` — Gemini transcripts use the same JSONL shape
    as Claude, so the Claude walker applies. The top-level fallback
    does not include ``prompt_response``, which is why this branch is
    necessary.

    Sources: <https://www.geminicli.com/docs/hooks/>,
    <https://www.geminicli.com/docs/hooks/reference/>.
    """
    if event in ("agent_response", "stop"):
        v = payload.get("prompt_response") or payload.get("promptResponse")
        if isinstance(v, str) and v.strip():
            return v.strip()
        tp = payload.get("transcript_path") or payload.get("transcriptPath")
        if isinstance(tp, str):
            txt = _extract_claude_transcript_response(tp)
            if txt:
                return txt
    return ""


def _extract_windsurf_text(
    payload: dict[str, Any], event: str | None,
) -> str:
    """Windsurf hook payload extractor (docs-verified, 2026-05).

    Windsurf has two agent-response variants. ``post_cascade_response``
    (synchronous) nests the response under ``tool_info.response`` as a
    markdown string; ``post_cascade_response_with_transcript`` carries
    a ``transcript_path`` to a JSONL file (Claude-format). The
    ``pre_user_prompt`` event keeps the prompt under the top-level
    ``prompt`` (covered by the fallback).

    Sources: <https://docs.windsurf.com/windsurf/cascade/hooks>.
    """
    if event in ("agent_response", "stop"):
        info = payload.get("tool_info") or payload.get("toolInfo")
        if isinstance(info, dict):
            v = info.get("response") or info.get("text")
            if isinstance(v, str) and v.strip():
                return v.strip()
        tp = payload.get("transcript_path") or payload.get("transcriptPath")
        if isinstance(tp, str):
            txt = _extract_claude_transcript_response(tp)
            if txt:
                return txt
    return ""


def _extract_hook_text(
    payload: dict[str, Any],
    *,
    platform: str | None = None,
    event: str | None = None,
) -> str:
    """Pull a textual snippet out of a platform's hook payload.

    Platform-aware when ``platform`` is supplied: prefers nested keys
    that the platform documents (Augment ``conversation.*``, Claude Code
    ``transcript_path`` JSONL, Cursor/Gemini/Windsurf docs-verified
    branches). Falls back to common top-level keys so legacy callers
    and simple platforms keep working.
    """
    # Augment Code (with includeConversationData: true) — Stop payloads
    # arrive nested under "conversation".
    if platform == "augment":
        user, agent = _extract_augment_conversation(payload)
        if event == "user_prompt" and user:
            return user
        if event in ("stop", "agent_response") and agent:
            return agent
        if agent:
            return agent
        if user:
            return user
    # Claude Code — Stop payload only has transcript_path; parse JSONL
    # to recover the last assistant message. Cowork (the Claude desktop
    # app's local-agent-mode runtime) shares the same payload shape, so
    # the same extractor applies.
    if platform in ("claude", "cowork") and event in ("stop", "agent_response"):
        tp = payload.get("transcript_path") or payload.get("transcriptPath")
        if isinstance(tp, str):
            txt = _extract_claude_transcript_response(tp)
            if txt:
                return txt
    if platform == "cursor":
        txt = _extract_cursor_text(payload, event)
        if txt:
            return txt
    if platform == "cline":
        txt = _extract_cline_text(payload, event)
        if txt:
            return txt
    if platform == "gemini":
        txt = _extract_gemini_text(payload, event)
        if txt:
            return txt
    if platform == "windsurf":
        txt = _extract_windsurf_text(payload, event)
        if txt:
            return txt
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

    Used by ``chat_history.py hook-dispatch --platform <name>`` so
    consumer projects can wire their per-platform hook config to a
    single command. The mapping comes from ``PLATFORM_EVENT_MAP``;
    unmapped events are silently skipped (returned as
    ``skipped_unmapped_event``).

    Schema v4: every dispatch extracts the platform's stable
    ``session_id`` from the payload and forwards it to
    :func:`hook_append`, where :func:`derive_session_tag` produces the
    16-char ``s`` tag carried on every body entry. No sidecar, no
    ownership, no auto-adopt — multi-session coexistence is implicit
    via the ``s`` field.
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

    text = _extract_hook_text(payload, platform=platform, event=event)
    tool = _extract_hook_tool(payload)
    session_id = _extract_session_id(payload)

    # Augment dual-emit: with includeConversationData: true the Stop
    # payload carries both the user prompt and the agent response in one
    # call (Augment has no UserPromptSubmit equivalent). Synthesize a
    # user_prompt append before the stop append so both sides land in
    # history under the active cadence.
    augment_user_prompt = ""
    if platform == "augment" and event == "stop":
        u, _a = _extract_augment_conversation(payload)
        augment_user_prompt = u

    hook_payload: dict[str, Any] = {
        "source": f"hook:{platform}:{raw_event}",
        "agent": platform,
    }
    if text and event != "session_start":
        hook_payload["text"] = text
    if tool:
        hook_payload["tool"] = tool

    if augment_user_prompt:
        hook_append(
            "user_prompt",
            session_id=session_id,
            payload={
                "text": augment_user_prompt,
                "source": f"hook:{platform}:{raw_event}:user",
                "agent": platform,
            },
            path=path, settings_path=settings_path,
        )

    return hook_append(event, session_id=session_id, payload=hook_payload,
                       path=path, settings_path=settings_path)


def _cmd_init(args) -> int:
    h = init(freq=args.freq)
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
            session_id=args.session_id,
            payload=payload,
            settings_path=settings_path,
        )
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return EXIT_BAD_ARGS
    print(json.dumps(result, ensure_ascii=False))
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
    return EXIT_OK


def _cmd_append(args) -> int:
    entry = json.loads(args.json) if args.json else {}
    entry.setdefault("t", args.type)
    if not entry.get("t"):
        print("error: --type or a 't' key in --json is required",
              file=sys.stderr)
        return EXIT_BAD_ARGS
    session = derive_session_tag(args.session_id) if args.session_id else None
    append(entry, session=session)
    return EXIT_OK


def _cmd_status(_args) -> int:
    print(json.dumps(status(), ensure_ascii=False, indent=2))
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
    h = reset_with_entries(entries, freq=args.freq)
    print(json.dumps(h, ensure_ascii=False))
    return 0


def _cmd_prune_sessions(args) -> int:
    settings_path = Path(args.settings) if args.settings else None
    if args.max_sessions is not None:
        max_n = max(1, int(args.max_sessions))
    else:
        sp = settings_path or Path(DEFAULT_SETTINGS_FILE)
        max_n = _read_chat_history_max_sessions(sp)
    result = prune_sessions(max_n)
    print(json.dumps(result, ensure_ascii=False))
    return EXIT_OK


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
    p_init.add_argument("--freq", default="per_phase", choices=sorted(VALID_FREQS))
    p_init.set_defaults(func=_cmd_init)
    p_app = sub.add_parser("append")
    p_app.add_argument("--type", help="entry type (t field)")
    p_app.add_argument("--json", help="JSON object with entry fields")
    p_app.add_argument(
        "--session-id",
        default=None,
        help=("platform session id; hashed to derive the body 's' tag. "
              "Omit to write entries with s=<unknown>."),
    )
    p_app.set_defaults(func=_cmd_append)
    sub.add_parser("status").set_defaults(func=_cmd_status)
    p_reset = sub.add_parser("reset")
    p_reset.add_argument("--freq", default="per_phase",
                         choices=sorted(VALID_FREQS))
    g_r = p_reset.add_mutually_exclusive_group(required=True)
    g_r.add_argument("--entries-json",
                     help="JSON array of entry dicts")
    g_r.add_argument("--entries-stdin", action="store_true",
                     help="read JSON array from stdin")
    p_reset.set_defaults(func=_cmd_reset)
    p_prune = sub.add_parser(
        "prune-sessions",
        help=("keep only the N most-recent sessions in the body; "
              "N defaults to chat_history.max_sessions"),
    )
    p_prune.add_argument(
        "--max-sessions",
        type=int,
        default=None,
        help=f"max distinct sessions to keep (default: settings or {DEFAULT_MAX_SESSIONS})",
    )
    p_prune.add_argument(
        "--settings",
        default=None,
        help=f"path to agent settings (default: {DEFAULT_SETTINGS_FILE})",
    )
    p_prune.set_defaults(func=_cmd_prune_sessions)
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
        help=("filter to entries with this session tag "
              "(16-char sha256(session_id), '<legacy>', or '<unknown>'); "
              "defaults to the most recent session"),
    )
    p_read.set_defaults(func=_cmd_read)
    p_sess = sub.add_parser("sessions")
    p_sess.add_argument("--limit", type=int, default=20,
                        help="max non-empty sessions to print (default: 20)")
    p_sess.add_argument("--include-empty", action="store_true",
                        help="include sessions with zero body entries")
    p_sess.add_argument("--json", action="store_true",
                        help="emit JSON instead of a human-readable table")
    p_sess.set_defaults(func=_cmd_sessions)
    p_rot = sub.add_parser("rotate")
    p_rot.add_argument("--max-kb", type=int, default=256)
    p_rot.add_argument("--mode", default="rotate", choices=sorted(VALID_OVERFLOW))
    p_rot.set_defaults(func=_cmd_rotate)
    p_hook = sub.add_parser(
        "hook-append",
        help=("platform-hook entry point — stateless append per session; "
              "derives the body 's' tag from --session-id"),
    )
    p_hook.add_argument(
        "--event",
        required=True,
        choices=sorted(VALID_HOOK_EVENTS),
        help="hook event name",
    )
    p_hook.add_argument(
        "--session-id",
        default=None,
        help=("platform session id; hashed to derive the body 's' tag. "
              "Omit to write entries with s=<unknown>."),
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
