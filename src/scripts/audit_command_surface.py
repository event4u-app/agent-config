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

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))
from _lib.agent_src import SRC_DOMAINS  # noqa: E402

# 6.0.0-D Step 10 moved the command surface into pack-physical
# src/domains/<pack>/<verb>/command.md; 6.0.x removed the packages/ tree
# (ADR-051). The command source root is now src/domains.
DEFAULT_ROOT = SRC_DOMAINS
# Enforced source target — read by scripts/check_gate_paths.py so a future move
# that desyncs this path fails CI instead of silently no-opping.
GATE_CORE_PATHS = (SRC_DOMAINS,)
REPORT_DIR = REPO_ROOT / "agents" / "reports"
OUT_JSON = REPORT_DIR / "command-surface.json"
OUT_MD = REPORT_DIR / "command-surface.md"
OUT_BUDGET_JSON = REPORT_DIR / "command-budget-audit.json"
OUT_BUDGET_MD = REPORT_DIR / "command-budget-audit.md"
PACKS_YML = REPO_ROOT / "src" / "config" / "discovery" / "packs.yml"
DOCS_DIR = REPO_ROOT / "docs"

# Per-size-class VISIBLE-command budgets (docs/contracts/capability-packs.md;
# enforced as a CI gate by 6.0.0-C Phase 1). `internal` commands are uncapped.
SIZE_BUDGETS = {"core": 8, "small": 2, "medium": 5, "large": 8, "platform": 10}
# ADR-090: `visibility:` is the named source of truth (visible / advanced /
# internal); the integer `tier:` is a back-compat alias. A command counts
# toward the per-pack budget when it is surfaced — visibility in {visible,
# advanced} (or, when only the alias is present, tier in {0,1}). `internal`
# (or absent → defaults to internal) is uncapped.
VISIBLE_TIERS = {0, 1}
VISIBLE_VISIBILITIES = {"visible", "advanced"}

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---", re.DOTALL)
DESCRIPTION_RE = re.compile(r'^description:\s*"?(.*?)"?\s*$', re.MULTILINE)
ALIASES_RE = re.compile(r"^aliases:\s*(.*)$", re.MULTILINE)
NAME_RE = re.compile(r"^name:\s*(.*)$", re.MULTILINE)
CLUSTER_RE = re.compile(r"^cluster:\s*(.*)$", re.MULTILINE)
TIER_RE = re.compile(r"^tier:\s*(\d+)", re.MULTILINE)
VISIBILITY_RE = re.compile(r"^visibility:\s*(visible|advanced|internal)", re.MULTILINE)
PACK_RE = re.compile(r"^pack:\s*(.*)$", re.MULTILINE)

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
    visibility: str | None = None
    cluster: str = ""
    pack: str = ""
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
    if v := VISIBILITY_RE.search(block):
        out["visibility"] = v.group(1)
    if pk := PACK_RE.search(block):
        out["pack"] = pk.group(1).strip().strip('"').strip("'")
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
            visibility=fm.get("visibility"),
            cluster=fm.get("cluster", ""),
            pack=fm.get("pack", ""),
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


# --- Budget audit (6.0.0-B Phase 2 Step 4) --------------------------------

def _command_roots() -> list[Path]:
    """Every pack's command surface under src/domains/<pack>/, for per-pack counts."""
    roots: list[Path] = []
    if SRC_DOMAINS.is_dir():
        for d in sorted(SRC_DOMAINS.iterdir()):
            if d.is_dir() and any(d.rglob("command.md")):
                roots.append(d)
    return roots or [DEFAULT_ROOT]


def collect_all() -> List[Command]:
    cmds: List[Command] = []
    seen: set[str] = set()
    for root in _command_roots():
        for c in collect(root):
            if c.relpath not in seen:
                seen.add(c.relpath)
                cmds.append(c)
    return cmds


def load_size_classes() -> dict[str, str | None]:
    """pack_id → size_class (None for reserved-unused vocab ids)."""
    import yaml  # local import; pyyaml is already a runtime dep
    raw = yaml.safe_load(PACKS_YML.read_text(encoding="utf-8")) or []
    return {e["id"]: e.get("size_class") for e in raw}


def citation_count(name: str) -> int:
    """Number of docs/ files that reference this command by its slash form.

    `name` is the full invocation (e.g. `roadmap:process-full`, `commit`).
    Counts files containing `/<name>` — the canonical citation shape — which
    is far less noisy than the bare word for short names like `commit`.
    """
    if not DOCS_DIR.is_dir():
        return 0
    needle = f"/{name}"
    hits = 0
    for md in DOCS_DIR.rglob("*.md"):
        try:
            if needle in md.read_text(encoding="utf-8"):
                hits += 1
        except OSError:
            continue
    return hits


def _is_visible(c: Command) -> bool:
    # ADR-090: prefer the named visibility field; fall back to the tier alias.
    # Absent both → internal per command-surface-tiers.md.
    if c.visibility is not None:
        return c.visibility in VISIBLE_VISIBILITIES
    return (c.tier if c.tier is not None else 2) in VISIBLE_TIERS


def build_budget_audit(commands: List[Command], size_classes: dict[str, str | None]) -> dict:
    by_pack: dict[str, list[Command]] = {}
    for c in commands:
        by_pack.setdefault(c.pack or "(unassigned)", []).append(c)

    packs_out: list[dict] = []
    for pack in sorted(by_pack):
        members = by_pack[pack]
        visible = [c for c in members if _is_visible(c)]
        internal = [c for c in members if not _is_visible(c)]
        sc = size_classes.get(pack)
        budget = SIZE_BUDGETS.get(sc) if sc else None
        over = budget is not None and len(visible) > budget
        entry = {
            "pack": pack,
            "size_class": sc,
            "budget": budget,
            "visible_count": len(visible),
            "internal_count": len(internal),
            "over_budget": over,
            "over_by": (len(visible) - budget) if over else 0,
        }
        if over:
            # Decision signals per visible command (drives Phase 2 Step 5).
            entry["visible_commands"] = sorted(
                (
                    {
                        "name": c.name,
                        "tier": c.tier,
                        "cluster": c.cluster,
                        "citations_docs": citation_count(c.name),
                        "commit_count": c.commit_count,
                        "days_since_modified": c.days_since_modified,
                    }
                    for c in visible
                ),
                key=lambda d: (d["citations_docs"], d["commit_count"]),
            )
        packs_out.append(entry)
    return {
        "budgets": SIZE_BUDGETS,
        "visible_tiers": sorted(VISIBLE_TIERS),
        "total_commands": len(commands),
        "packs": packs_out,
    }


def render_budget_md(audit: dict) -> str:
    L: list[str] = []
    L.append("# Command budget audit (6.0.0-B Phase 2 Step 4)\n")
    L.append(
        "> Per-pack VISIBLE-command counts vs. the `size_class` budget "
        "(capability-packs.md). `visible` = tier ∈ {0,1}; tier 2 / absent = "
        "internal (uncapped). Citations = docs/ files referencing `/<name>`.\n"
        ">\n"
        "> **Signal note:** docs-citations is the load-bearing signal (rank "
        "candidates low→high). The git commit/idle columns are low-variance on "
        "this active repo and only weakly discriminating — do not hide a "
        "high-citation command on an idle-days reading alone.\n"
    )
    L.append("\n## Summary\n")
    L.append("| Pack | size_class | budget | visible | internal | over? |")
    L.append("|---|---|--:|--:|--:|:--|")
    for p in audit["packs"]:
        flag = f"⚠️ +{p['over_by']}" if p["over_budget"] else "ok"
        L.append(
            f"| `{p['pack']}` | {p['size_class'] or '—'} | "
            f"{p['budget'] if p['budget'] is not None else '—'} | "
            f"{p['visible_count']} | {p['internal_count']} | {flag} |"
        )
    over_packs = [p for p in audit["packs"] if p["over_budget"]]
    L.append("\n## Over-budget packs — decision signals (Phase 2 Step 5)\n")
    if not over_packs:
        L.append("None — every pack is within its visible-command budget.\n")
    for p in over_packs:
        L.append(
            f"\n### `{p['pack']}` — {p['visible_count']} visible / "
            f"budget {p['budget']} ({p['size_class']}), over by {p['over_by']}\n"
        )
        L.append("Decide per command: keep-visible · set `internal` · relocate-to-pack-X.\n")
        L.append("| Command | tier | cluster | docs citations | commits | days idle |")
        L.append("|---|--:|---|--:|--:|--:|")
        for c in p["visible_commands"]:
            L.append(
                f"| `{c['name']}` | {c['tier']} | {c['cluster'] or '—'} | "
                f"{c['citations_docs']} | {c['commit_count']} | "
                f"{c['days_since_modified'] if c['days_since_modified'] is not None else '—'} |"
            )
    return "\n".join(L) + "\n"


# --- Forward-looking budget gate (6.0.0-C Phase 1 Steps 1+3) --------------
# The budget audit above is report-only. This gate is the CI hard stop: it
# fails ONLY when a *newly visible* command (added since baseline, or promoted
# tier 2 → 0/1) lands in a pack that is now over its size_class budget.
# Pre-existing over-budget packs are grandfathered as long as they do not grow
# their visible surface — see docs/contracts/capability-packs.md § exemption.

_CMD_PATH_RE = re.compile(r"src/domains/.+/command\.md$")


def _git_lines(args: list[str]) -> list[str]:
    try:
        r = subprocess.run(["git", *args], capture_output=True, text=True,
                           cwd=REPO_ROOT, timeout=15)
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        print(f"error: git {' '.join(args)} failed: {exc}", file=sys.stderr)
        sys.exit(3)
    if r.returncode != 0:
        print(f"error: git {' '.join(args)} exit {r.returncode}: {r.stderr}",
              file=sys.stderr)
        sys.exit(3)
    return [ln for ln in r.stdout.splitlines() if ln.strip()]


def _tier_at_ref(ref: str, relpath: str) -> int | None:
    """Tier of a command file at a git ref. None when absent or no tier field."""
    r = subprocess.run(["git", "show", f"{ref}:{relpath}"],
                       capture_output=True, text=True, cwd=REPO_ROOT, timeout=15)
    if r.returncode != 0:
        return None  # file did not exist at baseline
    m = TIER_RE.search(r.stdout)
    return int(m.group(1)) if m else None


def _is_visible_tier(tier: int | None) -> bool:
    return (tier if tier is not None else 2) in VISIBLE_TIERS


def grown_packs(baseline: str, commands: List[Command]) -> dict[str, list[str]]:
    """Packs that gained a visible command since baseline → list of command names.

    A command counts as a *new visible surface* when it is either added since
    baseline (and is visible now) or promoted from internal/absent to visible.
    """
    by_relpath = {c.relpath: c for c in commands}
    # Added (committed) + modified (committed) command files since baseline.
    added = set(_git_lines(["diff", "--name-only", "--diff-filter=A",
                            f"{baseline}...HEAD"]))
    modified = set(_git_lines(["diff", "--name-only", "--diff-filter=M",
                              f"{baseline}...HEAD"]))
    # Untracked / staged-new working-tree additions (uncommitted new commands).
    for line in _git_lines(["status", "--porcelain", "-uall"]):
        status, _, path = line[:2], line[2:3], line[3:].strip().split(" -> ")[-1]
        if status.strip() in ("A", "??", "AM", "M", "MM"):
            (added if status.strip() in ("A", "??", "AM") else modified).add(path)

    grew: dict[str, list[str]] = {}
    for relpath in added | modified:
        if not _CMD_PATH_RE.search(relpath):
            continue
        cmd = by_relpath.get(relpath)
        if cmd is None or not cmd.pack:
            continue
        if not _is_visible(cmd):
            continue  # internal now — never counts toward a visible budget
        if relpath in modified and relpath not in added:
            # Modified file: only a *promotion* into visibility grows the surface.
            # Baseline is historical (pre-ADR-090) so it carries only the tier
            # alias — the tier proxy is the correct read for the old revision.
            if _is_visible_tier(_tier_at_ref(baseline, relpath)):
                continue  # was already visible — not a new surface
        grew.setdefault(cmd.pack, []).append(cmd.name)
    return grew


def check_new_budget(baseline: str, quiet: bool) -> int:
    commands = collect_all()
    audit = build_budget_audit(commands, load_size_classes())
    by_pack = {p["pack"]: p for p in audit["packs"]}
    grew = grown_packs(baseline, commands)

    violations: list[dict] = []
    for pack, new_names in sorted(grew.items()):
        entry = by_pack.get(pack)
        if entry and entry["over_budget"]:
            violations.append({"pack": pack, "new_commands": sorted(new_names),
                               "entry": entry})

    if violations:
        print("❌  Per-pack command budget exceeded by newly visible command(s):")
        for v in violations:
            e = v["entry"]
            print(f"  • pack `{v['pack']}` ({e['size_class']}): "
                  f"{e['visible_count']} visible / budget {e['budget']} "
                  f"(+{e['over_by']}) — new: {', '.join(v['new_commands'])}")
        print("\nResolve by one of: set the command to `tier: 2` (internal, "
              "uncapped) · merge into a sibling cluster · relocate to a pack "
              "with budget headroom · file a budget-exemption ADR "
              "(docs/contracts/capability-packs.md § Budget exemption process).")
        return 1
    if not quiet:
        n = sum(len(v) for v in grew.values())
        print(f"✅  Budget gate: {n} newly visible command(s) across "
              f"{len(grew)} pack(s); no pack over its size_class budget "
              f"(baseline: {baseline}).")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT)
    parser.add_argument("--budget", action="store_true",
                        help="Write the per-pack command-budget audit (6.0.0-B Phase 2 Step 4).")
    parser.add_argument("--check-new", action="store_true",
                        help="CI gate (6.0.0-C Phase 1): fail when a newly visible "
                             "command pushes its pack over the size_class budget. "
                             "Existing commands are grandfathered.")
    parser.add_argument("--baseline", default="main",
                        help="git ref to diff against for --check-new (default: main).")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()
    if not args.root.exists():
        print(f"error: {args.root} does not exist", file=sys.stderr)
        return 2

    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    if args.check_new:
        return check_new_budget(args.baseline, args.quiet)

    if args.budget:
        commands = collect_all()
        audit = build_budget_audit(commands, load_size_classes())
        OUT_BUDGET_JSON.write_text(json.dumps(audit, indent=2), encoding="utf-8")
        OUT_BUDGET_MD.write_text(render_budget_md(audit), encoding="utf-8")
        over = [p for p in audit["packs"] if p["over_budget"]]
        if not args.quiet:
            print(f"✅  Budget audit: {audit['total_commands']} commands, "
                  f"{len(over)} pack(s) over budget.")
            for p in over:
                print(f"   ⚠️  {p['pack']}: {p['visible_count']} visible / "
                      f"budget {p['budget']} (+{p['over_by']})")
            print(f"   JSON: {OUT_BUDGET_JSON.relative_to(REPO_ROOT)}")
            print(f"   MD:   {OUT_BUDGET_MD.relative_to(REPO_ROOT)}")
        return 0

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
