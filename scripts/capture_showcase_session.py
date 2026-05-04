#!/usr/bin/env python3
"""capture_showcase_session.py — wrap and measure showcase sessions.

Phase 1.2 deliverable for `road-to-feedback-consolidation.md`.

Two subcommands:

  capture   Read a raw chat-log (file or stdin) and write a session under
            `docs/showcase/sessions/<slug>.log` with a YAML frontmatter
            block (commit_sha, host_agent, model, started, ended,
            task_class, metrics).

  metrics   Compute one or all of the four outcome metrics defined in
            `agents/contexts/outcome-baseline.md` from a captured session
            file. Output as text table or JSON.

The four metrics:
  (a) tool-call-count        — number of <tool_use ...> blocks in body
  (b) reply-chars            — mean chars of agent replies (excl. fences)
  (c) memory-hit-ratio       — hits / (hits + misses) from memory traces
  (d) verify-pass-rate       — first-try done-claims / total done-claims

Exit codes: 0 success, 1 user error (bad args, missing file), 2 metric
gate not yet wired (downstream phase pending).
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import re
import subprocess
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional

ROOT = Path(__file__).resolve().parent.parent
SESSIONS_DIR = ROOT / "docs" / "showcase" / "sessions"

# Tool-call markers across host agents (Augment, Claude Code, Cursor, …).
# Union, not branch — a session log may carry multiple shapes.
TOOL_USE_PATTERNS = [
    re.compile(r"<tool_use[\s>]"),
    re.compile(r"<function_calls>"),
    re.compile(r"<invoke\b"),
]

# Memory-retrieve trace shape, per memory-visibility-v1.md (Phase 4.1).
# Until Phase 4.1 lands, fall back to counting `memory_retrieve` invocations
# without hit/miss disambiguation (returns ratio=None).
MEMORY_HIT_RE = re.compile(r"memory_retrieve\b.*?hits=(\d+)", re.IGNORECASE)
MEMORY_MISS_RE = re.compile(
    r"memory_retrieve\b.*?(misses=(\d+)|hits=0)", re.IGNORECASE
)
MEMORY_CALL_RE = re.compile(r"\bmemory_retrieve(?:_\w+)?\b")

# Done-claim markers — agent says work is complete.
DONE_CLAIM_PATTERNS = [
    re.compile(r"\b(done|complete|ready for review|fertig|abgeschlossen)\b",
               re.IGNORECASE),
    re.compile(r"^\s*(✅|✓)", re.MULTILINE),
]

# Correction phrasings — user re-prompts with a complaint, signalling
# the verify-gate let bad work through. Optimistic: anything not on this
# list is treated as scope expansion, not failure.
CORRECTION_PHRASES = [
    "das passt nicht", "das stimmt nicht", "passt so nicht",
    "that's wrong", "this is wrong", "missing", "fehlt",
    "didn't work", "doesn't work", "geht nicht", "broken",
    "you missed", "du hast", "das ist falsch",
]


@dataclass
class SessionMetrics:
    tool_call_count: Optional[int] = None
    reply_chars_mean: Optional[float] = None
    memory_hit_ratio: Optional[float] = None
    verify_pass_rate: Optional[float] = None
    notes: List[str] = None  # populated when a metric is degraded

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        # Drop notes when empty so frontmatter stays compact.
        if not self.notes:
            d.pop("notes", None)
        return d


def _git_sha() -> str:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True, text=True, check=True, cwd=ROOT,
        )
        return out.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return "unknown"


def _now_iso() -> str:
    return _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _strip_fences(text: str) -> str:
    """Remove fenced code blocks so they don't pollute char counts."""
    return re.sub(r"```.*?```", "", text, flags=re.DOTALL)


def _split_body(content: str) -> str:
    """Strip a leading YAML frontmatter block if present."""
    if content.startswith("---\n"):
        end = content.find("\n---\n", 4)
        if end != -1:
            return content[end + 5:]
    return content


def _read_session(path: Path) -> str:
    if str(path) == "-":
        return sys.stdin.read()
    if not path.is_file():
        raise SystemExit(f"❌  session file not found: {path}")
    return path.read_text(encoding="utf-8")


def _split_turns(body: str) -> List[Dict[str, str]]:
    """Heuristic turn split — `## User` / `## Agent` headings, falls back
    to whole-body as a single agent turn when no markers exist.
    """
    turn_re = re.compile(
        r"^##\s+(User|Agent|Assistant|Matze|Du)\b.*?$", re.MULTILINE | re.IGNORECASE
    )
    matches = list(turn_re.finditer(body))
    if not matches:
        return [{"role": "agent", "text": body}]
    turns: List[Dict[str, str]] = []
    for i, m in enumerate(matches):
        role_raw = m.group(1).lower()
        role = "user" if role_raw in {"user", "matze", "du"} else "agent"
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(body)
        turns.append({"role": role, "text": body[start:end].strip()})
    return turns


def _metric_tool_call_count(body: str) -> int:
    return sum(len(p.findall(body)) for p in TOOL_USE_PATTERNS)


def _metric_reply_chars(body: str) -> Optional[float]:
    turns = _split_turns(body)
    agent_turns = [t["text"] for t in turns if t["role"] == "agent"]
    if not agent_turns:
        return None
    lengths = [len(_strip_fences(t).strip()) for t in agent_turns]
    return round(sum(lengths) / len(lengths), 1)


def _metric_memory_hit_ratio(body: str) -> tuple[Optional[float], List[str]]:
    """Returns (ratio, notes). Ratio is None when no memory calls found."""
    notes: List[str] = []
    hits_total = sum(int(m.group(1)) for m in MEMORY_HIT_RE.finditer(body))
    miss_blocks = MEMORY_MISS_RE.findall(body)
    miss_total = 0
    for raw, count in miss_blocks:
        if count:
            miss_total += int(count)
        else:
            miss_total += 1  # `hits=0` case
    calls = len(MEMORY_CALL_RE.findall(body))
    if calls == 0:
        return None, ["no memory_retrieve calls found"]
    if hits_total + miss_total == 0:
        notes.append("memory-visibility-v1 trace not present; "
                     "counted calls only (Phase 4.1 pending)")
        return None, notes
    return round(hits_total / (hits_total + miss_total), 3), notes


def _metric_verify_pass_rate(body: str) -> tuple[Optional[float], List[str]]:
    turns = _split_turns(body)
    if len(turns) < 2:
        return None, ["session has no user/agent split — cannot measure"]
    total_claims = 0
    failed_claims = 0
    for i, turn in enumerate(turns):
        if turn["role"] != "agent":
            continue
        if not any(p.search(turn["text"]) for p in DONE_CLAIM_PATTERNS):
            continue
        total_claims += 1
        next_user = next(
            (t for t in turns[i + 1:] if t["role"] == "user"), None
        )
        if next_user is None:
            continue  # claim accepted (session ended on the claim)
        lower = next_user["text"].lower()
        if any(phrase in lower for phrase in CORRECTION_PHRASES):
            failed_claims += 1
    if total_claims == 0:
        return None, ["no done-claims found in session"]
    return round((total_claims - failed_claims) / total_claims, 3), []


def _compute_metrics(body: str) -> SessionMetrics:
    notes: List[str] = []
    mhr, mhr_notes = _metric_memory_hit_ratio(body)
    notes.extend(mhr_notes)
    vpr, vpr_notes = _metric_verify_pass_rate(body)
    notes.extend(vpr_notes)
    return SessionMetrics(
        tool_call_count=_metric_tool_call_count(body),
        reply_chars_mean=_metric_reply_chars(body),
        memory_hit_ratio=mhr,
        verify_pass_rate=vpr,
        notes=notes or None,
    )


def _render_frontmatter(meta: Dict[str, Any]) -> str:
    """Minimal YAML emitter — stdlib only, dict + scalar + list of strings.
    Nested dict supported one level deep (for `metrics`).
    """
    def fmt_scalar(v: Any) -> str:
        if v is None:
            return "null"
        if isinstance(v, bool):
            return "true" if v else "false"
        if isinstance(v, (int, float)):
            return str(v)
        return json.dumps(v, ensure_ascii=False)

    lines = ["---"]
    for k, v in meta.items():
        if isinstance(v, dict):
            lines.append(f"{k}:")
            for kk, vv in v.items():
                lines.append(f"  {kk}: {fmt_scalar(vv)}")
        elif isinstance(v, list):
            lines.append(f"{k}:")
            for item in v:
                lines.append(f"  - {fmt_scalar(item)}")
        else:
            lines.append(f"{k}: {fmt_scalar(v)}")
    lines.append("---")
    return "\n".join(lines) + "\n"


def cmd_capture(args: argparse.Namespace) -> int:
    raw = _read_session(Path(args.input))
    body = _split_body(raw)
    metrics = _compute_metrics(body)
    started = args.started or _now_iso()
    ended = args.ended or _now_iso()
    meta: Dict[str, Any] = {
        "slug": args.slug,
        "task_class": args.task_class,
        "host_agent": args.host,
        "model": args.model,
        "commit_sha": _git_sha(),
        "started": started,
        "ended": ended,
        "metrics": metrics.to_dict(),
    }
    frontmatter = _render_frontmatter(meta)
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = SESSIONS_DIR / f"{args.slug}.log"
    if out_path.exists() and not args.force:
        print(f"❌  refusing to overwrite {out_path} — pass --force",
              file=sys.stderr)
        return 1
    out_path.write_text(frontmatter + body, encoding="utf-8")
    try:
        display = out_path.relative_to(ROOT)
    except ValueError:
        display = out_path
    print(f"✅  wrote {display}")
    if args.format == "json":
        print(json.dumps(metrics.to_dict(), indent=2))
    return 0


def cmd_metrics(args: argparse.Namespace) -> int:
    raw = _read_session(Path(args.session))
    body = _split_body(raw)
    metrics = _compute_metrics(body)
    selected = args.metric
    available = {
        "tool-call-count": metrics.tool_call_count,
        "reply-chars": metrics.reply_chars_mean,
        "memory-hit-ratio": metrics.memory_hit_ratio,
        "verify-pass-rate": metrics.verify_pass_rate,
    }
    if selected != "all" and selected not in available:
        print(f"❌  unknown metric: {selected}", file=sys.stderr)
        return 1
    if args.format == "json":
        if selected == "all":
            print(json.dumps(metrics.to_dict(), indent=2))
        else:
            print(json.dumps({selected: available[selected]}, indent=2))
        return 0
    items = available.items() if selected == "all" else [(selected, available[selected])]
    for name, value in items:
        rendered = "n/a" if value is None else str(value)
        print(f"  {name:<22} {rendered}")
    if metrics.notes:
        print()
        for note in metrics.notes:
            print(f"  ℹ️   {note}")
    return 0


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="capture_showcase_session.py",
        description="Capture and measure /implement-ticket and /work showcase sessions.",
    )
    sub = p.add_subparsers(dest="command", required=True)

    cap = sub.add_parser("capture", help="Write a session log with frontmatter.")
    cap.add_argument("--input", required=True,
                     help="Path to raw chat log, or '-' for stdin.")
    cap.add_argument("--slug", required=True,
                     help="Filename slug (becomes <slug>.log).")
    cap.add_argument("--task-class", default="implement-ticket",
                     choices=["implement-ticket", "work", "review-changes", "qa"])
    cap.add_argument("--host", default="unknown",
                     help="Host agent identifier (augment, claude-code, …).")
    cap.add_argument("--model", default="unknown")
    cap.add_argument("--started", default=None,
                     help="ISO-8601 start timestamp (defaults to now).")
    cap.add_argument("--ended", default=None,
                     help="ISO-8601 end timestamp (defaults to now).")
    cap.add_argument("--force", action="store_true",
                     help="Overwrite an existing session file.")
    cap.add_argument("--format", choices=["text", "json"], default="text")
    cap.set_defaults(func=cmd_capture)

    met = sub.add_parser("metrics", help="Compute one or all metrics.")
    met.add_argument("--session", required=True,
                     help="Path to a captured session log.")
    met.add_argument("--metric", default="all",
                     choices=["all", "tool-call-count", "reply-chars",
                              "memory-hit-ratio", "verify-pass-rate"])
    met.add_argument("--format", choices=["text", "json"], default="text")
    met.set_defaults(func=cmd_metrics)
    return p


def main(argv: Optional[List[str]] = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
