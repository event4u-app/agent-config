#!/usr/bin/env python3
"""Evidence Report template automation.

Scaffolds and updates the per-task Evidence Report (gitignored session
scratchpad) so the evidence-first structure-discovery discipline never
gets skipped.

Subcommands:
  init       Create/overwrite agents/memory/knowledge/session/evidence-report.md
             with a three-bucket skeleton (Verified / Assumed / Gaps).
  add        Append one evidence line to a bucket with inline provenance.
  git-state  Detect in-progress git operations (rebase/merge/cherry-pick);
             exit 3 if any found, 0 if clean.

Contract: src/agent-src/contexts/execution/evidence-discipline.md
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


# ---------------------------------------------------------------------------
# Repo-root resolution
# ---------------------------------------------------------------------------

def _repo_root() -> Path:
    """Return repo root via git, falling back to relative-path heuristic."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, check=True,
        )
        return Path(result.stdout.strip())
    except (subprocess.CalledProcessError, FileNotFoundError):
        # Script lives at src/scripts/; repo root is two levels up.
        return Path(__file__).resolve().parent.parent.parent


def _git_head_short() -> str:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True, text=True, check=True,
        )
        return result.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return "unknown"


# ---------------------------------------------------------------------------
# Session file path
# ---------------------------------------------------------------------------

SESSION_REL = "agents/memory/knowledge/session/evidence-report.md"


def _session_path(root: Path) -> Path:
    p = root / SESSION_REL
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


# ---------------------------------------------------------------------------
# Subcommand: init
# ---------------------------------------------------------------------------

SKELETON = """\
---
task: {task}
generated_at: {generated_at}
head: {head}
---

> This file is gitignored, overwritten each task, and soft-capped to
> ~10–20 decision-relevant facts. It feeds the plan — not a forensic log.

## Verified (confirmed this session)

<!-- Add items via: evidence_report.py add --bucket verified --claim "..." --source "file:line" -->

## Assumed (from card) — hypothesis, confirm before use

<!-- Add items via: evidence_report.py add --bucket assumed --claim "..." --source "file:line" -->

## Gaps (missing evidence)

<!-- Add items via: evidence_report.py add --bucket gaps --claim "..." -->
"""


def cmd_init(args: argparse.Namespace, root: Path) -> int:
    path = _session_path(root)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    head = _git_head_short()
    content = SKELETON.format(task=args.task or "(unnamed)", generated_at=now, head=head)
    path.write_text(content, encoding="utf-8")
    print(f"Evidence Report written: {path.relative_to(root)}")
    return 0


# ---------------------------------------------------------------------------
# Subcommand: add
# ---------------------------------------------------------------------------

BUCKET_HEADINGS = {
    "verified": "## Verified (confirmed this session)",
    "assumed":  "## Assumed (from card) — hypothesis, confirm before use",
    "gaps":     "## Gaps (missing evidence)",
}


def _build_provenance(args: argparse.Namespace) -> str:
    observed_at = args.observed_at or datetime.now(timezone.utc).isoformat(timespec="seconds")
    parts: list[str] = [f"observed_at={observed_at}"]
    if args.source:
        parts.append(f"source={args.source}")
    if args.version:
        parts.append(f"version={args.version}")
    # GLOBAL-origin leads (cross-project global store) are flagged so the
    # lead-only enforcement can detect a GLOBAL positive-structure line used
    # without this-session re-confirmation (road-to-structure-grounding-v2 P4).
    if args.bucket == "assumed" and getattr(args, "origin", "local") == "global":
        parts.append("origin=GLOBAL")
    if args.bucket == "gaps":
        if args.searched:
            parts.append(f"searched={args.searched}")
        if args.not_searched:
            parts.append(f"not_searched={args.not_searched}")
    return " · ".join(parts)


def cmd_add(args: argparse.Namespace, root: Path) -> int:
    path = _session_path(root)
    if not path.exists():
        print("No evidence-report.md found; run `init` first.", file=sys.stderr)
        return 1

    heading = BUCKET_HEADINGS[args.bucket]
    provenance = _build_provenance(args)
    new_line = f"- {args.claim}  `[{provenance}]`\n"

    text = path.read_text(encoding="utf-8")
    if heading not in text:
        print(f"Heading '{heading}' not found in report.", file=sys.stderr)
        return 1

    # Insert after the heading (and any immediately following comment block).
    lines = text.splitlines(keepends=True)
    insert_at: int | None = None
    in_target = False
    for i, line in enumerate(lines):
        if line.strip() == heading:
            in_target = True
            continue
        if in_target:
            # Skip blank lines and HTML comment blocks right after heading.
            stripped = line.strip()
            if stripped == "" or stripped.startswith("<!--") or stripped.endswith("-->"):
                continue
            # Insert before the first non-empty, non-comment line,
            # or at the next heading boundary.
            insert_at = i
            break
        if in_target and line.startswith("## "):
            insert_at = i
            break

    if insert_at is None:
        # Bucket is at end of file; just append.
        lines.append(new_line)
    else:
        lines.insert(insert_at, new_line)

    path.write_text("".join(lines), encoding="utf-8")
    print(f"Added to [{args.bucket}]: {args.claim[:60]}{'…' if len(args.claim) > 60 else ''}")
    return 0


# ---------------------------------------------------------------------------
# Subcommand: git-state
# ---------------------------------------------------------------------------

# Live git-op markers only. NOTE: `.git/REBASE_HEAD` is deliberately excluded —
# it lingers as a stale ref after a *completed* rebase and would cause a false
# fail-fast on every run. The authoritative "rebase in progress" markers are the
# `rebase-merge` / `rebase-apply` directories (removed on completion).
GIT_OP_MARKERS = [
    "MERGE_HEAD",
    "CHERRY_PICK_HEAD",
]
GIT_OP_DIRS = [
    "rebase-merge",
    "rebase-apply",
]


def _git_dir(root: Path) -> Path | None:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--git-dir"],
            capture_output=True, text=True, check=True, cwd=root,
        )
        gd = result.stdout.strip()
        p = Path(gd) if Path(gd).is_absolute() else root / gd
        return p.resolve()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def cmd_git_state(args: argparse.Namespace, root: Path) -> int:  # noqa: ARG001
    git_dir = _git_dir(root)
    if git_dir is None:
        print("Not a git repository or git not found.", file=sys.stderr)
        return 3

    active: list[str] = []
    for marker in GIT_OP_MARKERS:
        if (git_dir / marker).exists():
            active.append(marker.replace("_HEAD", "").lower())
    for d in GIT_OP_DIRS:
        if (git_dir / d).is_dir():
            active.append(d)

    if active:
        print(f"git-op-in-progress: {', '.join(active)}")
        return 3

    print("clean")
    return 0


# ---------------------------------------------------------------------------
# Argument parser
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="evidence_report.py",
        description=__doc__.splitlines()[0],
    )
    parser.add_argument(
        "--root", type=Path, default=None,
        help="Repo root (default: auto-detected via git or script location).",
    )
    sub = parser.add_subparsers(dest="command", metavar="subcommand")
    sub.required = True

    # init
    p_init = sub.add_parser("init", help="Create/overwrite the evidence-report skeleton.")
    p_init.add_argument("--task", default="", help="Task description for the header.")

    # add
    p_add = sub.add_parser("add", help="Append one evidence line to a bucket.")
    p_add.add_argument(
        "--bucket", required=True, choices=["verified", "assumed", "gaps"],
        help="Evidence bucket to append to.",
    )
    p_add.add_argument("--claim", required=True, help="The evidence claim text.")
    p_add.add_argument(
        "--source", default="",
        help="Provenance: file:line, URL, migration, SDL, or probe. Required for verified/assumed.",
    )
    p_add.add_argument("--observed-at", default="", dest="observed_at",
                       help="ISO8601 timestamp (default: now UTC).")
    p_add.add_argument("--version", default="", help="Source version if applicable.")
    p_add.add_argument(
        "--origin", default="local", choices=["local", "global"],
        help="Card origin for the assumed bucket. 'global' tags the line "
             "'origin=GLOBAL' (a GLOBAL, unverified lead — positive structure "
             "must be re-confirmed against the live source this session).",
    )
    p_add.add_argument("--searched", default="", help="Gaps: comma-list of searched locations.")
    p_add.add_argument("--not-searched", default="", dest="not_searched",
                       help="Gaps: comma-list of un-searched locations.")

    # git-state
    sub.add_parser("git-state", help="Detect in-progress git operations; exit 3 if any.")

    return parser


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    root = args.root if args.root else _repo_root()

    if args.command == "init":
        return cmd_init(args, root)
    if args.command == "add":
        return cmd_add(args, root)
    if args.command == "git-state":
        return cmd_git_state(args, root)

    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
