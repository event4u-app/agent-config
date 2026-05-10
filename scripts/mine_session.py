#!/usr/bin/env python3
"""Mine session transcripts for memory signals — Phase-1 single-host.

Implements the GATHER SIGNAL phase of the `memory-consolidation` skill
against Claude-Code-format JSONL transcripts. Default behaviour is
``--preview`` (stdout only). ``--commit-intake`` appends one JSONL line
per fact to ``agents/memory/intake/<primary-tag>.jsonl`` per the
agent-memory contract.

Strict gates: opt-in transcript access (``--confirm-transcript-access``
required per invocation), ≤ 5 normalised facts per cycle, redaction
applied to every yielded text. See
``.agent-src.uncompressed/commands/memory/mine-session.md`` for the
authored spec.
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

ROOT = Path(__file__).resolve().parent.parent
INTAKE_ROOT = Path("agents/memory/intake")
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


def _turn_text(turn: dict[str, Any]) -> str:
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


def mine(transcript: Path, since: dt.datetime,
         extra_patterns: list[re.Pattern[str]]) -> list[dict[str, Any]]:
    """Return up to MAX_FACTS normalised facts (preview shape)."""
    turns_in_window = [t for t in _iter_claude_code_jsonl(transcript)
                       if _within_window(_turn_ts(t), since)]
    facts: list[dict[str, Any]] = []
    session_id = _session_id(transcript)
    for turn in turns_in_window:
        text = _turn_text(turn)
        if not text:
            continue
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
                "session_id": session_id,
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


def _resolve_transcript(host: str, override: str | None) -> Path | None:
    if override:
        return Path(override)
    if host != "claude-code":
        return None
    home = Path(os.path.expanduser("~/.claude/projects"))
    if not home.exists():
        return None
    candidates = sorted(home.rglob("*.jsonl"),
                        key=lambda p: p.stat().st_mtime, reverse=True)
    return candidates[0] if candidates else None


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--since", default=None,
                    help="ISO date; default 14 days ago")
    ap.add_argument("--confirm-transcript-access", action="store_true")
    ap.add_argument("--preview", action="store_true", default=True)
    ap.add_argument("--commit-intake", action="store_true")
    ap.add_argument("--host", default="claude-code")
    ap.add_argument("--transcript", default=None,
                    help="Override transcript path (testing)")
    ap.add_argument("--intake-root", default=str(INTAKE_ROOT))
    ap.add_argument("--project", default=Path.cwd().name)
    ns = ap.parse_args(argv)

    if ns.commit_intake and not ns.preview:
        ns.preview = False
    if ns.commit_intake and ns.preview:
        ns.preview = False  # commit-intake wins

    if not ns.confirm_transcript_access:
        print("> Mining reads your session transcript files. Re-run with\n"
              "> --confirm-transcript-access to proceed. The flag is "
              "per-invocation\n> and not persisted.")
        return 0

    if ns.host != "claude-code":
        print(f"> No TranscriptAdapter for host={ns.host}. Phase 1 supports: "
              "claude-code.\n> Use /memory propose to record signals "
              "manually.")
        return 0

    transcript = _resolve_transcript(ns.host, ns.transcript)
    if transcript is None or not transcript.exists():
        print("> No transcript found for host=claude-code. "
              "Use /memory propose.")
        return 0

    since = (dt.datetime.fromisoformat(ns.since)
             .replace(tzinfo=dt.timezone.utc) if ns.since
             else dt.datetime.now(dt.timezone.utc)
             - dt.timedelta(days=DEFAULT_WINDOW_DAYS))
    facts = mine(transcript, since, extra_patterns=[])
    window = f"since {since.date().isoformat()}"

    if not ns.commit_intake:
        print(render_preview(facts, ns.project, window, ns.host), end="")
        return 0

    written = commit_intake(facts, Path(ns.intake_root))
    files_touched = len({f["type"] for f in facts})
    print(f"✅ Appended {written} intake lines across {files_touched} files.\n"
          "   Next: /memory promote to lift validated lines into curated YAML.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
