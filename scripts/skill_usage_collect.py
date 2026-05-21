#!/usr/bin/env python3
"""Collect skill-activation signal from Claude Code session jsonl.

Implements step-2-skill-inventory-rationalization.md Phase 1 Step 2.
Reads `~/.claude/projects/<project-slug>/*.jsonl` for the current repo,
parses each turn for two signals:

  - exposure: the skill slug appeared in an `attachment.type=skill_listing`
    payload (catalog presented to the agent that turn).
  - mention:  the assistant-text response in the same or following turn
    referenced the slug in backticks with one of the anchor verbs
    (using, via, per, route, dispatch, invoke, call) OR cited a SKILL.md
    path under `.augment/skills/<slug>/`, `.claude/skills/<slug>/`, or
    `.agent-src/skills/<slug>/`.

Emits one JSONL record per (session, turn, slug, kind) to
`agents/runtime/metrics/skill-usage.jsonl` (append-only, deduped on the
(session_id, turn_idx, slug, kind) tuple).

Privacy: `prompt_excerpt_hash` = SHA-256 of the first 200 chars of the
user prompt that opened the turn. No raw user or assistant bodies are
persisted. See `agents/evidence/audits/2026-05-14-north-star/skill-usage-sources.md`.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Iterable, Iterator

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "agents" / "metrics" / "skill-usage.jsonl"

LISTING_LINE_RE = re.compile(r"^-\s+([a-z0-9][a-z0-9_-]+):\s", re.MULTILINE)
ANCHOR_VERBS = ("using", "via", "per", "route", "routing", "dispatch", "dispatched", "invoke", "call")
PATH_RE = re.compile(r"\.(?:augment|claude|agent-src)/skills/([a-z0-9][a-z0-9_-]+)/SKILL\.md")


def project_slug(repo: Path) -> str:
    return str(repo).replace("/", "-")


def session_files(slug: str) -> list[Path]:
    base = Path.home() / ".claude" / "projects" / slug
    if not base.is_dir():
        return []
    return sorted(base.glob("*.jsonl"))


def iter_turns(jsonl: Path) -> Iterator[dict]:
    with jsonl.open("r", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def extract_listing(entry: dict) -> set[str]:
    att = entry.get("attachment") or {}
    if att.get("type") != "skill_listing":
        return set()
    content = att.get("content", "") or ""
    return set(LISTING_LINE_RE.findall(content))


def extract_text(entry: dict) -> str:
    if entry.get("type") != "assistant":
        return ""
    msg = entry.get("message") or {}
    content = msg.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(p.get("text", "") for p in content if isinstance(p, dict) and p.get("type") == "text")
    return ""


def find_mentions(text: str, known_slugs: Iterable[str]) -> set[str]:
    hits: set[str] = set()
    if not text:
        return hits
    hits.update(PATH_RE.findall(text))
    for slug in known_slugs:
        token = f"`{slug}`"
        if token not in text:
            continue
        lower = text.lower()
        for verb in ANCHOR_VERBS:
            if f"{verb} {token}".lower() in lower or f"{verb} the {token}".lower() in lower:
                hits.add(slug)
                break
    return hits


def hash_prompt(text: str) -> str:
    if not text:
        return ""
    return hashlib.sha256(text[:200].encode("utf-8", errors="replace")).hexdigest()[:16]


def collect_session(jsonl: Path, all_known: set[str]) -> list[dict]:
    session_id = jsonl.stem
    records: list[dict] = []
    last_prompt_hash = ""
    listed: set[str] = set()
    turn_idx = -1
    for entry in iter_turns(jsonl):
        etype = entry.get("type")
        if etype == "user":
            turn_idx += 1
            msg = entry.get("message") or {}
            body = msg.get("content") if isinstance(msg.get("content"), str) else ""
            last_prompt_hash = hash_prompt(body or "")
            continue
        if etype == "attachment":
            listed |= extract_listing(entry)
            continue
        if etype == "assistant":
            text = extract_text(entry)
            mentions = find_mentions(text, listed | all_known)
            ts = entry.get("timestamp") or ""
            for slug in sorted(listed):
                records.append({"session_id": session_id, "turn_idx": turn_idx, "slug": slug,
                                "kind": "exposure", "ts": ts, "prompt_excerpt_hash": last_prompt_hash})
            for slug in sorted(mentions):
                records.append({"session_id": session_id, "turn_idx": turn_idx, "slug": slug,
                                "kind": "mention", "ts": ts, "prompt_excerpt_hash": last_prompt_hash})
            listed = set()
    return records


def load_known_slugs(repo: Path) -> set[str]:
    slugs: set[str] = set()
    for root in (repo / ".augment" / "skills", repo / ".claude" / "skills", repo / ".agent-src" / "skills"):
        if not root.is_dir():
            continue
        for skill_md in root.glob("*/SKILL.md"):
            slugs.add(skill_md.parent.name)
    return slugs


def dedup_key(rec: dict) -> tuple:
    return (rec["session_id"], rec["turn_idx"], rec["slug"], rec["kind"])


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--project-slug", help="Override the ~/.claude/projects slug (defaults to current repo)")
    ap.add_argument("--out", type=Path, default=OUT, help="Output jsonl (default: agents/runtime/metrics/skill-usage.jsonl)")
    ap.add_argument("--quiet", action="store_true", help="Suppress non-error output")
    args = ap.parse_args()

    slug = args.project_slug or project_slug(REPO)
    files = session_files(slug)
    if not files:
        if not args.quiet:
            print(f"no session files for slug {slug}", file=sys.stderr)
        return 0
    known = load_known_slugs(REPO)
    seen: set[tuple] = set()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    if args.out.exists():
        for line in args.out.read_text(encoding="utf-8", errors="replace").splitlines():
            try:
                seen.add(dedup_key(json.loads(line)))
            except (json.JSONDecodeError, KeyError):
                continue
    appended = 0
    with args.out.open("a", encoding="utf-8") as fh:
        for jsonl in files:
            for rec in collect_session(jsonl, known):
                k = dedup_key(rec)
                if k in seen:
                    continue
                seen.add(k)
                fh.write(json.dumps(rec, separators=(",", ":")) + "\n")
                appended += 1
    if not args.quiet:
        print(f"✅  Wrote {appended} new record(s) to {args.out.relative_to(REPO)} ({len(seen)} total)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
