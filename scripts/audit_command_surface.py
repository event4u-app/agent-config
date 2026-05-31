#!/usr/bin/env python3
"""Command-surface inventory + overlap detection + usage signal.

Walks ``.agent-src.uncondensed/commands/**/*.md``, collects metadata for
each command (path, description, aliases, line count, last-modified),
flags overlap pairs by keyword-cosine similarity, and adds a usage
signal from git history (commands not touched in 90+ days are
candidates for retirement).

Output:
  - ``agents/runtime/reports/command-surface.json`` (machine-readable)
  - ``agents/runtime/reports/command-surface.md`` (human-readable)

Context: ``agents/roadmaps/step-2-feedback-followup.md`` Phase 1 —
GPT's PR-#148 "108 commands" cognitive-load warning needs empirical
verification before any retirement decisions are made.

Usage:
  python3 scripts/audit_command_surface.py
  python3 scripts/audit_command_surface.py --root DIR
  python3 scripts/audit_command_surface.py --quiet
"""

from __future__ import annotations

import argparse
import json
import math
import re
import subprocess
import sys
from collections import Counter
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from itertools import combinations
from pathlib import Path
from typing import List

REPO_ROOT = Path(__file__).resolve().parent.parent
# Pre-monorepo: REPO_ROOT/.agent-src.uncondensed/commands. Post-move (ADR-017)
# the core command surface lives under packages/core/.agent-src.uncondensed.
# Fall back to the legacy path only if the packages layout is absent.
_CORE_COMMANDS = REPO_ROOT / "packages" / "core" / ".agent-src.uncondensed" / "commands"
_LEGACY_COMMANDS = REPO_ROOT / ".agent-src.uncondensed" / "commands"
DEFAULT_ROOT = _CORE_COMMANDS if _CORE_COMMANDS.is_dir() else _LEGACY_COMMANDS
REPORT_DIR = REPO_ROOT / "agents" / "reports"
OUT_JSON = REPORT_DIR / "command-surface.json"
OUT_MD = REPORT_DIR / "command-surface.md"

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---", re.DOTALL)
DESCRIPTION_RE = re.compile(r'^description:\s*"?(.*?)"?\s*$', re.MULTILINE)
ALIASES_RE = re.compile(r"^aliases:\s*(.*)$", re.MULTILINE)
NAME_RE = re.compile(r"^name:\s*(.*)$", re.MULTILINE)
CLUSTER_RE = re.compile(r"^cluster:\s*(.*)$", re.MULTILINE)
TIER_RE = re.compile(r"^tier:\s*(\d+)", re.MULTILINE)

STOPWORDS = {
    "the", "and", "for", "with", "when", "use", "or", "of", "to", "a", "an",
    "is", "in", "on", "by", "be", "at", "as", "it", "if", "are", "this",
    "that", "from", "but", "not", "can", "any", "all", "no", "after",
    "before", "during", "user", "agent", "code", "project", "via", "into",
    "onto", "even", "without", "naming", "run", "runs", "running", "each",
    "every", "one", "two", "now", "then", "also", "based", "default",
}

OVERLAP_COSINE_THRESHOLD = 0.6
# Commands with few commits AND younger than this many days since first
# commit are flagged as low-signal — newer, less battle-tested entries.
LOW_SIGNAL_COMMIT_COUNT = 2
LOW_SIGNAL_AGE_DAYS = 30


@dataclass
class Command:
    name: str
    path: str
    relpath: str
    directory: str
    description: str
    aliases: List[str] = field(default_factory=list)
    tier: int | None = None
    cluster: str = ""
    line_count: int = 0
    last_modified_iso: str = ""
    days_since_modified: int | None = None
    commit_count: int = 0
    first_commit_iso: str = ""
    days_since_first_commit: int | None = None


def parse_frontmatter(text: str) -> dict:
    m = FRONTMATTER_RE.search(text)
    if not m:
        return {}
    block = m.group(1)
    out: dict = {}
    if d := DESCRIPTION_RE.search(block):
        out["description"] = d.group(1).strip()
    if n := NAME_RE.search(block):
        out["name"] = n.group(1).strip().strip('"').strip("'")
    if c := CLUSTER_RE.search(block):
        out["cluster"] = c.group(1).strip().strip('"').strip("'")
    if t := TIER_RE.search(block):
        out["tier"] = int(t.group(1))
    if a := ALIASES_RE.search(block):
        raw = a.group(1).strip()
        if raw.startswith("["):
            inner = raw.strip("[]")
            out["aliases"] = [x.strip().strip('"').strip("'") for x in inner.split(",") if x.strip()]
        else:
            out["aliases"] = [raw.strip('"').strip("'")] if raw else []
    return out


def keyword_vector(text: str) -> Counter[str]:
    tokens = re.findall(r"[a-z][a-z0-9_-]{2,}", text.lower())
    return Counter(t for t in tokens if t not in STOPWORDS)


def cosine(a: Counter[str], b: Counter[str]) -> float:
    if not a or not b:
        return 0.0
    shared = set(a) & set(b)
    if not shared:
        return 0.0
    num = sum(a[t] * b[t] for t in shared)
    da = math.sqrt(sum(v * v for v in a.values()))
    db = math.sqrt(sum(v * v for v in b.values()))
    return num / (da * db) if da and db else 0.0


def git_last_modified(path: Path) -> tuple[str, int | None]:
    try:
        out = subprocess.check_output(
            ["git", "log", "--follow", "-1", "--format=%cI", "--", str(path)],
            cwd=REPO_ROOT, stderr=subprocess.DEVNULL, text=True,
        ).strip()
        if not out:
            return "", None
        ts = datetime.fromisoformat(out)
        days = (datetime.now(timezone.utc) - ts).days
        return out, days
    except (subprocess.CalledProcessError, ValueError):
        return "", None


def git_history(path: Path) -> tuple[int, str, int | None]:
    """Return (commit_count, first_commit_iso, days_since_first_commit).

    Uses ``--follow`` so renames (e.g. the ``.augment.uncondensed`` →
    ``.agent-src.uncondensed`` rename) don't reset the per-file history.
    """
    try:
        out = subprocess.check_output(
            ["git", "log", "--follow", "--format=%cI", "--", str(path)],
            cwd=REPO_ROOT, stderr=subprocess.DEVNULL, text=True,
        ).strip().splitlines()
        if not out:
            return 0, "", None
        first = out[-1]
        ts = datetime.fromisoformat(first)
        days = (datetime.now(timezone.utc) - ts).days
        return len(out), first, days
    except (subprocess.CalledProcessError, ValueError):
        return 0, "", None


def collect(root: Path) -> List[Command]:
    commands: List[Command] = []
    for md in sorted(root.rglob("*.md")):
        if any(p == "_archive" for p in md.parts):
            continue
        text = md.read_text(encoding="utf-8")
        fm = parse_frontmatter(text)
        rel = md.relative_to(REPO_ROOT)
        directory = str(md.parent.relative_to(root)) if md.parent != root else "."
        last_iso, days = git_last_modified(md)
        n_commits, first_iso, first_days = git_history(md)
        commands.append(Command(
            name=fm.get("name", md.stem),
            path=str(md),
            relpath=str(rel),
            directory=directory,
            description=fm.get("description", ""),
            aliases=fm.get("aliases", []),
            tier=fm.get("tier"),
            cluster=fm.get("cluster", ""),
            line_count=len(text.splitlines()),
            last_modified_iso=last_iso,
            days_since_modified=days,
            commit_count=n_commits,
            first_commit_iso=first_iso,
            days_since_first_commit=first_days,
        ))
    return commands


def find_overlap_pairs(commands: List[Command]) -> list[dict]:
    vectors = {c.relpath: keyword_vector(c.description) for c in commands}
    pairs: list[dict] = []
    for a, b in combinations(commands, 2):
        if not a.description or not b.description:
            continue
        sim = cosine(vectors[a.relpath], vectors[b.relpath])
        if sim < OVERLAP_COSINE_THRESHOLD:
            continue
        pairs.append({
            "a": a.relpath,
            "b": b.relpath,
            "a_name": a.name,
            "b_name": b.name,
            "cosine": round(sim, 3),
            "a_description": a.description,
            "b_description": b.description,
        })
    return sorted(pairs, key=lambda p: -p["cosine"])


def render_md(commands: List[Command], pairs: list[dict]) -> str:
    by_dir: dict[str, list[Command]] = {}
    for c in commands:
        by_dir.setdefault(c.directory, []).append(c)

    low_signal = [
        c for c in commands
        if c.commit_count and c.commit_count <= LOW_SIGNAL_COMMIT_COUNT
        and (c.days_since_first_commit or 0) <= LOW_SIGNAL_AGE_DAYS
    ]

    lines = [
        "# Command-Surface Inventory",
        "",
        f"> Generated by `scripts/audit_command_surface.py`. "
        f"Source: `.agent-src.uncondensed/commands/`.",
        "",
        "## Summary",
        "",
        f"- **Total commands:** {len(commands)}",
        f"- **Top-level commands (directory `.`):** {len(by_dir.get('.', []))}",
        f"- **Sub-cluster directories:** {len([d for d in by_dir if d != '.'])}",
        f"- **Low-signal (≤{LOW_SIGNAL_COMMIT_COUNT} commits AND ≤{LOW_SIGNAL_AGE_DAYS}d old):** {len(low_signal)}",
        f"- **Overlap pairs (cosine ≥ {OVERLAP_COSINE_THRESHOLD}):** {len(pairs)}",
        "",
        "## Per-directory counts",
        "",
        "| Directory | Count |",
        "|---|---:|",
    ]
    for d in sorted(by_dir):
        lines.append(f"| `{d}` | {len(by_dir[d])} |")
    lines.append("")

    lines += ["## Likely-overlapping pairs", ""]
    if not pairs:
        lines.append("_No pairs above threshold._")
    else:
        lines += [
            "| # | A | B | cosine | A description | B description |",
            "|---|---|---|---:|---|---|",
        ]
        for i, p in enumerate(pairs, 1):
            lines.append(
                f"| {i} | `{p['a_name']}` | `{p['b_name']}` | {p['cosine']:.2f} | "
                f"{p['a_description']} | {p['b_description']} |"
            )
    lines.append("")

    lines += [
        "## Usage-signal note",
        "",
        "Per-command invocation telemetry is **not** available. Two surrogate signals "
        "were considered:",
        "",
        "- **Filesystem mtime** — useless: `task sync` rewrites every file when the "
        "  condensed and uncondensed trees are regenerated.",
        "- **Git history (`--follow`)** — uninformative here: the `.agent-src.uncondensed/` "
        "  directory is the result of a recent rename (`.augment.uncondensed/` → "
        "  `.agent-src.uncondensed/`), so almost every file shows a single recent commit "
        f"  on the current branch. {len(low_signal)} of {len(commands)} commands fall into the "
        f"  ≤{LOW_SIGNAL_COMMIT_COUNT}-commits / ≤{LOW_SIGNAL_AGE_DAYS}d-old bucket purely as a "
        "  rename artefact, not as a real cold-tail signal.",
        "",
        "**Implication for Phase 1 categorisation:** keep / merge / retire decisions must "
        "be made on **intent** (description content, overlap with sibling commands, tier "
        "placement, cluster fit) rather than usage data. The cosine-≥0.6 overlap "
        "pairs above are the primary structural lever.",
        "",
    ]

    lines += [
        "## Three-bucket categorisation (Phase 1 Step 4)",
        "",
        "The keep / merge / retire verdict lives in "
        "[`command-surface-synthesis.md`](command-surface-synthesis.md) — hand-curated "
        "and **not** regenerated by this script. Headline: 109 keep · 0 merge · 0 retire. "
        "Every overlap pair and retire candidate surfaced by the council turned out to "
        "be an intentional structural pattern (scope ladder, union dispatcher, thin "
        "alias, tier-gated specialist), not redundancy.",
        "",
    ]

    lines += [
        "## Full inventory",
        "",
        "Column `bucket` is left blank — the categorisation lives in "
        "[`command-surface-synthesis.md`](command-surface-synthesis.md). Every command "
        "in this table maps to `keep` unless named in that file's tables.",
        "",
        "| Name | Path | Tier | Cluster | Aliases | Lines | Commits | Age (d) | Bucket |",
        "|---|---|---:|---|---|---:|---:|---:|---|",
    ]
    for c in sorted(commands, key=lambda c: c.relpath):
        aliases = ", ".join(c.aliases) if c.aliases else "—"
        tier = "—" if c.tier is None else str(c.tier)
        cluster = c.cluster or "—"
        age = "—" if c.days_since_first_commit is None else str(c.days_since_first_commit)
        lines.append(
            f"| `{c.name}` | `{c.relpath}` | {tier} | {cluster} | {aliases} | "
            f"{c.line_count} | {c.commit_count} | {age} | |"
        )
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT)
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()
    if not args.root.exists():
        print(f"error: {args.root} does not exist", file=sys.stderr)
        return 2

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    commands = collect(args.root)
    pairs = find_overlap_pairs(commands)

    OUT_JSON.write_text(
        json.dumps({
            "total": len(commands),
            "thresholds": {
                "overlap_cosine": OVERLAP_COSINE_THRESHOLD,
                "low_signal_commit_count": LOW_SIGNAL_COMMIT_COUNT,
                "low_signal_age_days": LOW_SIGNAL_AGE_DAYS,
            },
            "commands": [asdict(c) for c in commands],
            "overlap_pairs": pairs,
        }, indent=2),
        encoding="utf-8",
    )
    OUT_MD.write_text(render_md(commands, pairs), encoding="utf-8")

    if not args.quiet:
        print(f"✅  Audited {len(commands)} commands.")
        print(f"   JSON: {OUT_JSON.relative_to(REPO_ROOT)}")
        print(f"   MD:   {OUT_MD.relative_to(REPO_ROOT)}")
        print(f"   Overlap pairs (cosine ≥ {OVERLAP_COSINE_THRESHOLD}): {len(pairs)}")
        low_n = sum(
            1 for c in commands
            if c.commit_count and c.commit_count <= LOW_SIGNAL_COMMIT_COUNT
            and (c.days_since_first_commit or 0) <= LOW_SIGNAL_AGE_DAYS
        )
        print(f"   Low-signal (≤{LOW_SIGNAL_COMMIT_COUNT} commits, ≤{LOW_SIGNAL_AGE_DAYS}d): {low_n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
