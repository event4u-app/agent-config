#!/usr/bin/env python3
"""Controlled-verb linter for visible commands (6.0.0-C Phase 2 Step 4; ADR-041).

A VISIBLE command (tier 0/1) must have a leading token drawn from the approved
verb allowlist in ``src/config/discovery/command-verbs.yml``. ``create-*`` is a
banned leading token for new visible commands (``create-pr`` is grandfathered).

FORWARD-ONLY: only command files **added** since ``--baseline`` (default
``main``), plus files **promoted** to a visible tier since baseline, are
checked. The existing surface is grandfathered — no rename wave. Mirrors the
baseline-diff machinery of ``lint_no_new_atomic_commands.py``.

Single modular lint: both the approved-verb rule and the banned-prefix rule run
in one pass. Every rule blocks CI (no advisory-only tier — see ADR-041 § 6).

Exit codes: 0 = clean, 1 = violations found, 3 = internal error.

Usage:
    python3 scripts/lint_command_verbs.py
    python3 scripts/lint_command_verbs.py --baseline origin/main
    python3 scripts/lint_command_verbs.py --all     # check every visible command
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
VERBS_YML = ROOT / "src" / "config" / "discovery" / "command-verbs.yml"
_CMD_PATH_RE = re.compile(r"\.agent-src\.uncondensed/commands/.+\.md$")
NAME_RE = re.compile(r"^name:\s*(.*)$", re.MULTILINE)
TIER_RE = re.compile(r"^tier:\s*(\d+)", re.MULTILINE)
VISIBLE_TIERS = {0, 1}


@dataclass
class Violation:
    file: str
    rule: str
    reason: str


def load_config() -> tuple[set[str], set[str], set[str]]:
    import yaml
    data = yaml.safe_load(VERBS_YML.read_text(encoding="utf-8")) or {}
    approved = set(data.get("approved_verbs") or [])
    banned = set(data.get("banned_prefixes") or [])
    grandfathered = set(data.get("grandfathered") or [])
    if not approved:
        print(f"❌  No approved_verbs in {VERBS_YML}", file=sys.stderr)
        sys.exit(3)
    return approved, banned, grandfathered


def _git(args: list[str], *, tolerant: bool = False) -> str:
    try:
        r = subprocess.run(["git", *args], capture_output=True, text=True,
                           cwd=ROOT, timeout=15)
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        print(f"❌  git {' '.join(args)} failed: {exc}", file=sys.stderr)
        sys.exit(3)
    if r.returncode != 0:
        if tolerant:
            return ""
        print(f"❌  git {' '.join(args)} exit {r.returncode}: {r.stderr}",
              file=sys.stderr)
        sys.exit(3)
    return r.stdout


def _parse(text: str) -> tuple[str | None, int]:
    """(name, tier) from frontmatter text; tier defaults to 2 (internal)."""
    nm = NAME_RE.search(text)
    name = nm.group(1).strip().strip('"').strip("'") if nm else None
    tm = TIER_RE.search(text)
    tier = int(tm.group(1)) if tm else 2
    return name, tier


def changed_command_files(baseline: str) -> dict[str, str]:
    """relpath → change kind ('A' added | 'M' modified) for command files."""
    out: dict[str, str] = {}
    for kind in ("A", "M"):
        for p in _git(["diff", "--name-only", f"--diff-filter={kind}",
                       f"{baseline}...HEAD"]).splitlines():
            if p.strip() and _CMD_PATH_RE.search(p):
                out[p.strip()] = kind
    for line in _git(["status", "--porcelain", "-uall"]).splitlines():
        st, path = line[:2].strip(), line[3:].strip().split(" -> ")[-1]
        if _CMD_PATH_RE.search(path):
            out[path] = "A" if st in ("A", "??", "AM") else out.get(path, "M")
    return out


def all_visible_command_files() -> dict[str, str]:
    out: dict[str, str] = {}
    pkgs = ROOT / "packages"
    roots = [d for d in pkgs.glob("*/.agent-src.uncondensed/commands")
             if d.is_dir()] if pkgs.is_dir() else []
    for root in roots:
        for md in root.rglob("*.md"):
            if md.name == "AGENTS.md" or "_archive" in md.parts:
                continue
            out[str(md.relative_to(ROOT))] = "A"
    return out


def leading_token(name: str) -> str:
    """The verb token: cluster sub-name's head, or the bare name's head."""
    sub = name.split(":")[-1]
    return sub.split("-")[0]


def check(relpath: str, kind: str, baseline: str, approved: set[str],
          banned: set[str], grandfathered: set[str]) -> list[Violation]:
    abs_path = ROOT / relpath
    if not abs_path.exists():
        return []  # deleted
    name, tier = _parse(abs_path.read_text(encoding="utf-8"))
    if name is None or tier not in VISIBLE_TIERS:
        return []  # internal / unnamed — not gated
    if kind == "M":
        # Only a PROMOTION into visibility counts as a new visible surface.
        prev = _git(["show", f"{baseline}:{relpath}"], tolerant=True)
        if prev:
            _, prev_tier = _parse(prev)
            if prev_tier in VISIBLE_TIERS:
                return []  # already visible before — grandfathered

    if name in grandfathered:
        return []  # documented single-command exception — exempt from both rules
    bare = name.split(":")[-1]
    vio: list[Violation] = []
    # Rule 1 — banned prefix (create-*).
    for bp in banned:
        if bare == bp or bare.startswith(bp + "-"):
            vio.append(Violation(relpath, "banned-prefix",
                                 f"`{name}` uses the banned leading token "
                                 f"`{bp}` (no {bp}-* commands — ADR-041 § 2). "
                                 f"Grandfather it in command-verbs.yml only with "
                                 f"a documented exception."))
            return vio  # banned message is the actionable one; don't pile on
    # Rule 2 — approved verb.
    tok = leading_token(name)
    if tok not in approved:
        vio.append(Violation(relpath, "approved-verb",
                             f"leading token `{tok}` of `{name}` is not an "
                             f"approved verb. Rename to an existing verb, or add "
                             f"`{tok}` to src/config/discovery/command-verbs.yml in "
                             f"its own PR with an ADR (ADR-041 § 5)."))
    return vio


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--baseline", default="main",
                    help="git ref to diff against (default: main)")
    ap.add_argument("--all", action="store_true",
                    help="check every visible command, not just changed ones")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    approved, banned, grandfathered = load_config()
    targets = (all_visible_command_files() if args.all
               else changed_command_files(args.baseline))
    if not targets:
        if not args.quiet:
            print(f"✅  No new/changed commands under commands/ "
                  f"(baseline: {args.baseline}).")
        return 0

    violations: list[Violation] = []
    for relpath, kind in sorted(targets.items()):
        violations += check(relpath, kind, args.baseline, approved,
                            banned, grandfathered)

    if violations:
        print(f"❌  {len(violations)} controlled-verb violation(s):")
        for v in violations:
            print(f"  • [{v.rule}] {v.file} — {v.reason}")
        print("\nSee docs/decisions/ADR-041-controlled-command-verbs.md.")
        return 1
    if not args.quiet:
        print(f"✅  {len(targets)} new/changed command(s) all use an approved "
              f"verb (baseline: {args.baseline}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
