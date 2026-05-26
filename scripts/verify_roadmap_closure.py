#!/usr/bin/env python3
"""verify_roadmap_closure — scan archived roadmaps for phantom-shipping.

For each `agents/roadmaps/archive/*.md` file:

1. Locate the closure-decision block (heuristic: `## Closure decision`,
   `## Sunset`, `maintainer override`).
2. Extract file-path-shaped tokens from the block (backtick paths +
   markdown link targets). Sibling-roadmap references are filtered out.
3. Verify each token: exists on disk? If not, was it ever in git history?
4. Classify the roadmap (verified / partial / phantom / no-claims /
   not-closure-marked) and emit a per-roadmap + aggregate report.

Run: `python3 scripts/verify_roadmap_closure.py [--json out.json]`
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

REPO = Path(__file__).resolve().parent.parent
ARCHIVE = REPO / "agents" / "roadmaps" / "archive"

CLOSURE_HEADERS = re.compile(
    r"^##\s+(closure decision|sunset|cancellation|maintainer override)",
    re.IGNORECASE | re.MULTILINE,
)
NEXT_H2 = re.compile(r"^##\s+", re.MULTILINE)

BACKTICK_TOKEN = re.compile(r"`([^`\n]+?)`")
MD_LINK = re.compile(r"\]\(([^)\s]+?)\)")
TASK_TARGET = re.compile(r"^task\s+([a-z][\w:-]*)$")
SLASH_CMD = re.compile(r"^/([a-z][\w-]*(?::[a-z][\w-]*)?)$")
HEADING_PAT = re.compile(r"^##+\s+(.+)$")

PATH_HINT = re.compile(
    r"^(scripts/|docs/|agents/|templates/|"
    r"\.agent-src\.uncondensed/|\.agent-src/|\.augment/|\.claude/|\.cursor/|"
    r"taskfiles/|Taskfile)"
)
PATH_SHAPED = re.compile(r"^[\w.-]+/.+|\.[a-z]{1,5}$")
CONCEPT_NAME = re.compile(r"^[a-z][\w-]{2,}$")
PUNCT_ONLY = re.compile(r"^[^A-Za-z0-9]+$")
SKIP_PREFIX = ("http://", "https://", "mailto:", "#")
SKIP_SUFFIX_FRAGMENT = re.compile(r"#.*$")


SHIPPED_MARKERS = re.compile(
    r"\b(shipped|landed|live|live in|delivered|completed|complete|exists?|in tree|"
    r"in place|wired|active|adopted|published|are live|partially shipped)\b",
    re.IGNORECASE,
)
DROPPED_MARKERS = re.compile(
    r"\b(sunset|sunsetted|dropped|drop\b|cancell?ed|deferred|retracted|phantom|"
    r"never materiali[sz]ed|not shipped|does not exist|doesn't exist|missing|"
    r"out of scope|deprioriti[sz]ed|out\-of\-scope|won't ship|will not ship)\b",
    re.IGNORECASE,
)
BULLET_SPLIT = re.compile(r"^[ \t]*[-*]\s+", re.MULTILINE)


def bullet_sentiment(bullet_text: str) -> str:
    has_dropped = bool(DROPPED_MARKERS.search(bullet_text))
    has_shipped = bool(SHIPPED_MARKERS.search(bullet_text))
    if has_dropped and not has_shipped:
        return "dropped"
    if has_shipped and not has_dropped:
        return "shipped"
    if has_shipped and has_dropped:
        return "mixed"
    return "neutral"


@dataclass
class Claim:
    token: str
    kind: str  # path | task | md-link | slash-cmd | heading | concept
    sentiment: str = "neutral"  # shipped | dropped | mixed | neutral
    exists: bool = False
    ever_in_git: bool = False


@dataclass
class Verdict:
    roadmap: str
    has_closure: bool
    block: str = ""
    claims: list[Claim] = field(default_factory=list)
    classification: str = "no-claims"
    phantom_rate: float = 0.0


def find_block(text: str) -> str:
    m = CLOSURE_HEADERS.search(text)
    if not m:
        return ""
    start = m.start()
    end_match = NEXT_H2.search(text, m.end())
    end = end_match.start() if end_match else len(text)
    return text[start:end]


def is_self_roadmap_ref(token: str, roadmap_name: str) -> bool:
    base = token.rsplit("/", 1)[-1]
    return base.endswith(".md") and (
        base.startswith("step-") or base.startswith("road-to-") or base == roadmap_name
    )


def classify_token(tok: str) -> tuple[str, str] | None:
    tok = SKIP_SUFFIX_FRAGMENT.sub("", tok).strip()
    if not tok or PUNCT_ONLY.match(tok) or any(tok.startswith(p) for p in SKIP_PREFIX):
        return None
    m = TASK_TARGET.match(tok)
    if m:
        return ("task", m.group(1))
    m = SLASH_CMD.match(tok)
    if m:
        return ("slash-cmd", m.group(1))
    m = HEADING_PAT.match(tok)
    if m:
        return ("heading", m.group(1).strip())
    if PATH_HINT.match(tok) or "/" in tok or tok.endswith((".md", ".py", ".sh", ".yml", ".json")):
        return ("path", tok)
    if CONCEPT_NAME.match(tok):
        return ("concept", tok)
    return None


def split_bullets(block: str) -> list[str]:
    parts = BULLET_SPLIT.split(block)
    return [p.strip() for p in parts[1:] if p.strip()]


def _ingest(seen: dict, kind: str, value: str, sentiment: str) -> None:
    key = (kind, value)
    if key in seen:
        existing = seen[key]
        if existing.sentiment == "neutral" and sentiment != "neutral":
            existing.sentiment = sentiment
        elif existing.sentiment != sentiment and sentiment != "neutral":
            existing.sentiment = "mixed"
        return
    seen[key] = Claim(value, kind, sentiment)


def extract_claims(block: str, roadmap_name: str) -> list[Claim]:
    seen: dict[tuple[str, str], Claim] = {}
    bullets = split_bullets(block) or [block]
    for bullet in bullets:
        sent = bullet_sentiment(bullet)
        for m in BACKTICK_TOKEN.finditer(bullet):
            cls = classify_token(m.group(1))
            if not cls:
                continue
            kind, value = cls
            if kind == "path" and is_self_roadmap_ref(value, roadmap_name):
                continue
            _ingest(seen, kind, value, sent)
        for m in MD_LINK.finditer(bullet):
            cls = classify_token(m.group(1))
            if not cls:
                continue
            kind, value = cls
            if kind == "path" and is_self_roadmap_ref(value, roadmap_name):
                continue
            _ingest(seen, "md-link", value, sent)
    return list(seen.values())


def verify_path(token: str) -> bool:
    return (REPO / token).exists()


def verify_task(target: str) -> bool:
    for tf in [REPO / "Taskfile.yml", *((REPO / "taskfiles").glob("*.yml") if (REPO / "taskfiles").exists() else [])]:
        if not tf.exists():
            continue
        if re.search(rf"^\s+{re.escape(target)}:\s*$", tf.read_text(), re.MULTILINE):
            return True
    return False


def verify_slash_cmd(name: str) -> bool:
    base = name.split(":")[0]
    candidates = [
        REPO / ".agent-src.uncondensed" / "commands" / f"{base}.md",
        REPO / ".agent-src.uncondensed" / "commands" / base,
        REPO / ".agent-src.uncondensed" / "skills" / base,
        REPO / ".claude" / "skills" / base,
    ]
    return any(c.exists() for c in candidates)


def verify_heading(heading: str) -> bool:
    # Look for the heading text in skills/rules/contexts as evidence of pattern adoption
    pattern = re.compile(rf"^##+\s+{re.escape(heading)}\b", re.MULTILINE)
    for root in (REPO / ".agent-src.uncondensed", REPO / "agents", REPO / "docs"):
        if not root.exists():
            continue
        for f in root.rglob("*.md"):
            try:
                if pattern.search(f.read_text(errors="ignore")):
                    return True
            except Exception:
                continue
    return False


def verify_concept(name: str) -> bool:
    # grep across source-of-truth tree for any literal mention as evidence
    try:
        r = subprocess.run(
            ["git", "grep", "-l", "-w", name, "--",
             ".agent-src.uncondensed/", "docs/", "scripts/", "agents/settings/contexts/"],
            cwd=REPO, capture_output=True, text=True, timeout=15,
        )
        return bool(r.stdout.strip())
    except Exception:
        return False


def git_history(token: str) -> bool:
    try:
        r = subprocess.run(
            ["git", "log", "--all", "--oneline", "-n", "1", "--", token],
            cwd=REPO, capture_output=True, text=True, timeout=10,
        )
        return bool(r.stdout.strip())
    except Exception:
        return False


def classify(claims: list[Claim]) -> tuple[str, float]:
    # Phantom rate is computed only over claims the closure block *asserts as
    # shipped*. Claims explicitly marked as dropped/sunset are excluded —
    # missing them is consistent with the rationale, not a phantom.
    shipped = [c for c in claims if c.sentiment in ("shipped", "mixed")]
    if not shipped:
        if not claims:
            return "no-claims", 0.0
        return "no-shipped-claims", 0.0
    missing = [c for c in shipped if not c.exists]
    rate = len(missing) / len(shipped)
    if rate == 0:
        return "verified", 0.0
    if rate >= 0.5:
        return "phantom", rate
    return "partial-phantom", rate


def audit(roadmap: Path) -> Verdict:
    text = roadmap.read_text()
    block = find_block(text)
    if not block:
        return Verdict(roadmap.name, has_closure=False)
    claims = extract_claims(block, roadmap.name)
    for c in claims:
        if c.kind == "task":
            c.exists = verify_task(c.token)
        elif c.kind == "slash-cmd":
            c.exists = verify_slash_cmd(c.token)
        elif c.kind == "heading":
            c.exists = verify_heading(c.token)
        elif c.kind == "concept":
            c.exists = verify_concept(c.token)
        else:
            c.exists = verify_path(c.token)
        if not c.exists and c.kind in ("path", "md-link"):
            c.ever_in_git = git_history(c.token)
    cls, rate = classify(claims)
    return Verdict(roadmap.name, True, block.strip()[:200], claims, cls, rate)


def main(argv: Iterable[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", type=Path)
    ap.add_argument("--only", help="filter by roadmap name substring")
    args = ap.parse_args(list(argv))

    verdicts = []
    for md in sorted(ARCHIVE.glob("*.md")):
        if args.only and args.only not in md.name:
            continue
        verdicts.append(audit(md))

    closure_set = [v for v in verdicts if v.has_closure]
    by_cls: dict[str, list[Verdict]] = {}
    for v in closure_set:
        by_cls.setdefault(v.classification, []).append(v)

    print(f"# Archive Closure-Verification Report\n")
    print(f"- archive total: {len(verdicts)}")
    print(f"- with closure block: {len(closure_set)}")
    for cls in ("phantom", "partial-phantom", "verified", "no-shipped-claims", "no-claims"):
        print(f"- {cls}: {len(by_cls.get(cls, []))}")
    print()

    for cls in ("phantom", "partial-phantom"):
        rows = by_cls.get(cls, [])
        if not rows:
            continue
        print(f"## {cls.upper()} ({len(rows)})\n")
        for v in sorted(rows, key=lambda x: -x.phantom_rate):
            print(f"### {v.roadmap} · phantom-rate {v.phantom_rate:.0%} (shipped-claim basis)")
            for c in v.claims:
                mark = "✅" if c.exists else "❌"
                git = " (git: ever-existed)" if (not c.exists and c.ever_in_git) else ""
                sentinel = {"shipped": "[SHIP]", "dropped": "[DROP]", "mixed": "[MIX]", "neutral": "[--]"}.get(c.sentiment, "[?]")
                print(f"  {mark} {sentinel} [{c.kind}] `{c.token}`{git}")
            print()

    if args.json:
        args.json.write_text(json.dumps([v.__dict__ for v in verdicts], default=lambda o: o.__dict__, indent=2))
        print(f"\n→ JSON written to {args.json}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
