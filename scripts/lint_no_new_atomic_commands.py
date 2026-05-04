#!/usr/bin/env python3
"""
Atomic-command linter for the command-collapse policy.

Reads the locked verb clusters from `docs/contracts/command-clusters.md`,
finds every command file under `.agent-src.uncompressed/commands/` that
was **added** since `--baseline` (default: `main`), and requires each
new file to declare either:

  - `cluster: <locked-name>`   (file is a cluster entry or sub-command), or
  - `superseded_by: <slug>`    (file is a deprecation shim).

Modifications to pre-existing files are NOT flagged — only additions.
This stops the atomic surface from growing without forcing every existing
command into a Phase 1 cluster (most aren't in Phase 1).

Exit codes: 0 = clean, 1 = violations found, 3 = internal error.

Usage:
    python3 scripts/lint_no_new_atomic_commands.py
    python3 scripts/lint_no_new_atomic_commands.py --baseline origin/main
    python3 scripts/lint_no_new_atomic_commands.py --all       # ignore baseline
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COMMANDS_DIR = Path(".agent-src.uncompressed/commands")
CLUSTER_CONTRACT = Path("docs/contracts/command-clusters.md")


@dataclass
class Violation:
    file: str
    reason: str


def load_locked_clusters() -> set[str]:
    """Parse the locked cluster table from the contract."""
    text = (ROOT / CLUSTER_CONTRACT).read_text(encoding="utf-8")
    # Locate the locked-clusters table; cluster names sit in backticks in column 1.
    in_table = False
    clusters: set[str] = set()
    for line in text.splitlines():
        if line.startswith("## Locked clusters"):
            in_table = True
            continue
        if in_table and line.startswith("## "):
            break
        if in_table:
            m = re.match(r"\|\s*`([a-z][a-z0-9-]*)`\s*\|", line)
            if m:
                clusters.add(m.group(1))
    if not clusters:
        print(
            f"❌  Could not parse locked-clusters table from {CLUSTER_CONTRACT}",
            file=sys.stderr,
        )
        sys.exit(3)
    return clusters


def added_command_files(baseline: str) -> list[Path]:
    """Files under commands/ added (status A) since baseline."""
    try:
        result = subprocess.run(
            ["git", "diff", "--name-only", "--diff-filter=A",
             f"{baseline}...HEAD", "--", str(COMMANDS_DIR)],
            capture_output=True, text=True, cwd=ROOT, timeout=15,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        print(f"❌  git diff failed: {exc}", file=sys.stderr)
        sys.exit(3)
    if result.returncode != 0:
        print(f"❌  git diff exit {result.returncode}: {result.stderr}",
              file=sys.stderr)
        sys.exit(3)
    files = [Path(p) for p in result.stdout.splitlines()
             if p.endswith(".md") and p != "" and Path(p).name != "AGENTS.md"]
    # Also include untracked (newly added, uncommitted) files.
    try:
        wt = subprocess.run(
            ["git", "status", "--porcelain", "--", str(COMMANDS_DIR)],
            capture_output=True, text=True, cwd=ROOT, timeout=10,
        )
        for line in wt.stdout.splitlines():
            if len(line) < 4:
                continue
            status = line[:2]
            if status.strip() not in ("A", "??", "AM"):
                continue
            path = line[3:].strip().split(" -> ")[-1]
            if path.endswith(".md") and Path(path).name != "AGENTS.md":
                p = Path(path)
                if p not in files:
                    files.append(p)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    return files


def all_command_files() -> list[Path]:
    return sorted(p for p in (ROOT / COMMANDS_DIR).rglob("*.md")
                  if p.name != "AGENTS.md")


def parse_frontmatter(path: Path) -> dict[str, str]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end == -1:
        return {}
    fm: dict[str, str] = {}
    for line in text[3:end].splitlines():
        if ":" in line:
            k, _, v = line.partition(":")
            fm[k.strip()] = v.strip()
    return fm


def check_file(path: Path, clusters: set[str]) -> Violation | None:
    abs_path = path if path.is_absolute() else ROOT / path
    if not abs_path.exists():
        return None  # deleted file, nothing to check
    fm = parse_frontmatter(abs_path)
    if "superseded_by" in fm:
        return None  # shim — exempt
    cluster = fm.get("cluster")
    if not cluster:
        return Violation(str(path),
                         "missing `cluster:` frontmatter "
                         f"(allowed: {sorted(clusters)})")
    if cluster not in clusters:
        return Violation(str(path),
                         f"`cluster: {cluster}` is not a locked cluster "
                         f"(allowed: {sorted(clusters)})")
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--baseline", default="main",
                    help="git ref to diff against (default: main)")
    ap.add_argument("--all", action="store_true",
                    help="check every command file, not just changed ones")
    args = ap.parse_args()

    clusters = load_locked_clusters()
    targets = (all_command_files() if args.all
               else added_command_files(args.baseline))
    if not targets:
        print(f"✅  No new commands added under {COMMANDS_DIR} "
              f"(baseline: {args.baseline}).")
        return 0

    violations = [v for v in (check_file(p, clusters) for p in targets)
                  if v is not None]
    if violations:
        print(f"❌  {len(violations)} newly-added atomic command(s) violate "
              f"the command-cluster policy:")
        for v in violations:
            print(f"  • {v.file} — {v.reason}")
        print(f"\nSee docs/contracts/command-clusters.md for the locked "
              f"cluster names and frontmatter contract.")
        return 1
    print(f"✅  {len(targets)} newly-added command(s) all declare a valid "
          f"`cluster:` (or `superseded_by:`).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
