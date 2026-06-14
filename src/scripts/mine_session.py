#!/usr/bin/env python3
"""Mine a session for memory signals — the engine behind `/memory mine`.

Implements the GATHER SIGNAL phase of the `memory-consolidation` skill.
The canonical, **cross-host** source is the chat-history JSONL log
(``agents/runtime/.agent-chat-history``, written by platform hooks for
every host); the per-host Claude-Code transcript
(``~/.claude/projects/*.jsonl``) is a fallback when the log is absent.

``--mode``: ``signals`` (default) extracts normalised facts → intake
preview / ``--commit-intake``; ``proposals`` frames the facts as
candidate rule/skill learnings (the `/memory mine` command then runs
``learning-to-rule-or-skill`` on them); ``both`` renders both.

Strict gates: opt-in transcript access (``--confirm-transcript-access``
required per invocation), ≤ 5 normalised facts per cycle, redaction
applied to every yielded text. See
``src/domains/meta/memory/mine-session/command.md`` for the authored spec.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parent.parent.parent
INTAKE_ROOT = Path("agents/memory/intake")
CHAT_HISTORY_LOG = Path("agents/runtime/.agent-chat-history")
DEFAULT_WINDOW_DAYS = 14
MAX_FACTS = 5

SIGNAL_FAMILIES: dict[str, re.Pattern[str]] = {
    # Correction first — explicit redirects beat ambient preference matches.
    "gotcha": re.compile(
        r"(?i)\b(actually|wrong|stop doing|don't do|that's not what|nicht so)\b"),
    # Decision next — narrowest family.
    "invariant": re.compile(
        r"(?i)\b(let's go with|decided|we'll use|entschieden)\b"),
    # Preference last — widest, must not eat correction/decision turns.
    "convention": re.compile(
        r"(?i)\b(prefer|always|never|standard|i want|ich will)\b"),
}
PATTERN_MIN_REPEATS = 3
PATTERN_WINDOW_HOURS = 24

NAME_REDACT = re.compile(r"\b(Matze|Mathias)\b")
PRONOUN_STRIP = re.compile(r"(?i)\b(I|me|my|mein|ich)\b\s*")
PATH_TOKEN = re.compile(r"\b[a-zA-Z][\w/.-]*/[\w./-]+\b")
SYMBOL_TOKEN = re.compile(r"\b[A-Z][a-zA-Z0-9]+(?:::|\.)[a-zA-Z_][\w]*\b")


def _redact(text: str, extra_patterns: list[re.Pattern[str]]) -> str:
    out = NAME_REDACT.sub("<user>", text)
    for p in extra_patterns:
        out = p.sub("<redacted>", out)
    return out.strip()


def _normalise(text: str, extra_patterns: list[re.Pattern[str]]) -> str | None:
    """Strip pronouns and chrome; require a project-scoped key token."""
    cleaned = _redact(text, extra_patterns)
    cleaned = PRONOUN_STRIP.sub("", cleaned).strip()
    if not (PATH_TOKEN.search(cleaned) or SYMBOL_TOKEN.search(cleaned)):
        return None  # user-scoped, drop
    return re.sub(r"\s+", " ", cleaned)[:240]


def _key_of(text: str) -> str:
    m = PATH_TOKEN.search(text) or SYMBOL_TOKEN.search(text)
    return m.group(0) if m else "unknown"


def _iter_claude_code_jsonl(path: Path) -> Iterable[dict[str, Any]]:
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def _iter_chat_history(path: Path) -> Iterable[dict[str, Any]]:
    """Yield body entries from the cross-host chat-history JSONL log.

    Skips the ``{"t": "header"}`` line. Each body entry carries a flat
    ``text`` field, a ``ts`` timestamp, a ``t`` role (user/agent/tool/
    phase), and a session tag ``s`` — see ``scripts/chat_history.py``.
    """
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(obj, dict) and obj.get("t") != "header":
                yield obj


def _turn_text(turn: dict[str, Any]) -> str:
    # Chat-history log entries carry a flat `text` string.
    flat = turn.get("text")
    if isinstance(flat, str):
        return flat
    # Claude-Code transcript shape: message.content (str or block list).
    msg = turn.get("message") or {}
    content = msg.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return " ".join(c.get("text", "") for c in content
                        if isinstance(c, dict) and c.get("type") == "text")
    return ""


def _turn_ts(turn: dict[str, Any]) -> str:
    return turn.get("timestamp") or turn.get("ts") or ""


def _within_window(ts_str: str, since: dt.datetime) -> bool:
    if not ts_str:
        return True
    try:
        ts = dt.datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
    except ValueError:
        return True
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=dt.timezone.utc)
    return ts >= since


def _detect_pattern(turns: list[dict[str, Any]]) -> list[tuple[str, str, str]]:
    """Return [(key, observation, ts)] for paths/symbols seen ≥ 3× / 24h."""
    seen: dict[str, list[tuple[dt.datetime, str]]] = {}
    for t in turns:
        text = _turn_text(t)
        ts_str = _turn_ts(t)
        try:
            ts = dt.datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        except ValueError:
            continue
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=dt.timezone.utc)
        for m in PATH_TOKEN.findall(text) + SYMBOL_TOKEN.findall(text):
            seen.setdefault(m, []).append((ts, ts_str))
    out: list[tuple[str, str, str]] = []
    window = dt.timedelta(hours=PATTERN_WINDOW_HOURS)
    for key, hits in seen.items():
        hits.sort()
        for i in range(len(hits) - PATTERN_MIN_REPEATS + 1):
            if hits[i + PATTERN_MIN_REPEATS - 1][0] - hits[i][0] <= window:
                out.append((key, f"recurring reference to {key}",
                            hits[i + PATTERN_MIN_REPEATS - 1][1]))
                break
    return out


def _session_id(transcript: Path) -> str:
    h = hashlib.sha256(str(transcript.resolve()).encode()).hexdigest()
    return h[:16]


def mine(entries: Iterable[dict[str, Any]], since: dt.datetime,
         extra_patterns: list[re.Pattern[str]],
         session_id: str) -> list[dict[str, Any]]:
    """Return up to MAX_FACTS normalised facts (preview shape).

    ``entries`` is any iterable of turn-shaped dicts (chat-history log
    body entries or Claude-Code transcript turns). ``session_id`` is the
    fallback tag when an entry carries no ``s`` field.
    """
    turns_in_window = [t for t in entries
                       if _within_window(_turn_ts(t), since)]
    facts: list[dict[str, Any]] = []
    for turn in turns_in_window:
        text = _turn_text(turn)
        if not text:
            continue
        sid = turn.get("s") or session_id
        for tag, family in SIGNAL_FAMILIES.items():
            if not family.search(text):
                continue
            obs = _normalise(text, extra_patterns)
            if obs is None:
                continue
            facts.append({
                "ts": _turn_ts(turn) or dt.datetime.now(
                    dt.timezone.utc).isoformat(timespec="seconds"),
                "type": tag,
                "key": _key_of(text),
                "observation": obs,
                "source": "agent",
                "session_id": sid,
                "tags": [tag],
            })
            break
    for key, obs, ts in _detect_pattern(turns_in_window):
        facts.append({
            "ts": ts, "type": "pattern", "key": key,
            "observation": obs, "source": "agent",
            "session_id": session_id, "tags": ["pattern"],
        })
    return facts[:MAX_FACTS]


def render_preview(facts: list[dict[str, Any]],
                   project: str, window: str, host: str) -> str:
    if not facts:
        return (f"## Mining preview — {project} · {window} · host={host}\n\n"
                "_No signals matched. Tighten patterns or widen --since._\n")
    lines = [f"## Mining preview — {project} · {window} · host={host}", "",
             "| # | Tag | Key | Observation | Source turn |",
             "|---|---|---|---|---|"]
    for i, f in enumerate(facts, 1):
        lines.append(f"| {i} | {f['type']} | {f['key']} | "
                     f"{f['observation']} | {f['ts']} |")
    schemas = sorted({f["type"] for f in facts})
    lines.append("")
    lines.append(f"Schemas touched: {', '.join(schemas)}")
    return "\n".join(lines) + "\n"


def commit_intake(facts: list[dict[str, Any]], intake_root: Path) -> int:
    intake_root.mkdir(parents=True, exist_ok=True)
    written = 0
    for f in facts:
        dest = intake_root / f"{f['type']}.jsonl"
        with dest.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(f, ensure_ascii=False) + "\n")
        written += 1
    return written


def render_proposal_seeds(facts: list[dict[str, Any]],
                          project: str, window: str) -> str:
    """Frame mined facts as candidate rule/skill learnings.

    The `/memory mine` command feeds these into `learning-to-rule-or-skill`;
    this engine only surfaces the seeds — it does not author proposals.
    """
    if not facts:
        return (f"## Proposal seeds — {project} · {window}\n\n"
                "_No signals matched — nothing to propose._\n")
    lines = [f"## Proposal seeds — {project} · {window}", "",
             "Run `learning-to-rule-or-skill` on each durable seed below:",
             ""]
    for i, f in enumerate(facts, 1):
        lines.append(f"{i}. **{f['type']}** · `{f['key']}` — {f['observation']}")
    return "\n".join(lines) + "\n"


def _resolve_source(source: str, host: str,
                    override: str | None) -> tuple[Path | None, str]:
    """Return (path, kind). kind ∈ {chat-history, claude-code}.

    Default ``source=auto`` prefers the cross-host chat-history log, then
    falls back to the per-host Claude-Code transcript.
    """
    if override:
        return Path(override), ("claude-code" if host == "claude-code"
                                else "chat-history")
    if source in ("auto", "chat-history") and CHAT_HISTORY_LOG.exists():
        return CHAT_HISTORY_LOG, "chat-history"
    if source == "chat-history":
        return None, "chat-history"
    # claude-code fallback
    if host != "claude-code":
        return None, host
    home = Path(os.path.expanduser("~/.claude/projects"))
    if not home.exists():
        return None, "claude-code"
    candidates = sorted(home.rglob("*.jsonl"),
                        key=lambda p: p.stat().st_mtime, reverse=True)
    return (candidates[0] if candidates else None), "claude-code"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--since", default=None,
                    help="ISO date; default 14 days ago")
    ap.add_argument("--confirm-transcript-access", action="store_true")
    ap.add_argument("--preview", action="store_true", default=True)
    ap.add_argument("--commit-intake", action="store_true")
    ap.add_argument("--mode", choices=["signals", "proposals", "both"],
                    default="signals",
                    help="signals → intake facts (default); proposals → "
                         "proposal seeds for learning-to-rule-or-skill; both")
    ap.add_argument("--source", choices=["auto", "chat-history", "claude-code"],
                    default="auto",
                    help="auto (default) prefers the cross-host chat-history "
                         "log, then the Claude-Code transcript")
    ap.add_argument("--host", default="claude-code")
    ap.add_argument("--transcript", default=None,
                    help="Override source path (testing)")
    ap.add_argument("--intake-root", default=str(INTAKE_ROOT))
    ap.add_argument("--project", default=Path.cwd().name)
    ns = ap.parse_args(argv)

    if ns.commit_intake:
        ns.preview = False  # commit-intake wins

    if not ns.confirm_transcript_access:
        print("> Mining reads your session log / transcript. Re-run with\n"
              "> --confirm-transcript-access to proceed. The flag is "
              "per-invocation\n> and not persisted.")
        return 0

    path, kind = _resolve_source(ns.source, ns.host, ns.transcript)
    if path is None or not path.exists():
        print("> No session source found (no chat-history log, no "
              "Claude-Code transcript). Use /memory propose to record "
              "signals manually.")
        return 0

    entries = (_iter_chat_history(path) if kind == "chat-history"
               else _iter_claude_code_jsonl(path))
    since = (dt.datetime.fromisoformat(ns.since)
             .replace(tzinfo=dt.timezone.utc) if ns.since
             else dt.datetime.now(dt.timezone.utc)
             - dt.timedelta(days=DEFAULT_WINDOW_DAYS))
    facts = mine(entries, since, extra_patterns=[],
                 session_id=_session_id(path))
    window = f"since {since.date().isoformat()}"

    if ns.commit_intake:
        written = commit_intake(facts, Path(ns.intake_root))
        files_touched = len({f["type"] for f in facts})
        print(f"✅ Appended {written} intake lines across {files_touched} "
              "files.\n   Next: /memory promote to lift validated lines "
              "into curated YAML.")
        return 0

    # Preview mode — render per --mode.
    out: list[str] = []
    if ns.mode in ("signals", "both"):
        out.append(render_preview(facts, ns.project, window, kind))
    if ns.mode in ("proposals", "both"):
        out.append(render_proposal_seeds(facts, ns.project, window))
    print("\n".join(out), end="")
    return 0


if __name__ == "__main__":
    sys.exit(main())
