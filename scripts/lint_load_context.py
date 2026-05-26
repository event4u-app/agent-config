#!/usr/bin/env python3
"""Lint the `load_context:` / `load_context_eager:` frontmatter schema.

Validates per docs/contracts/load-context-schema.md:
  - Paths exist and are .md
  - Allowed roots only (.agent-src*/contexts/, agents/settings/contexts/)
  - No public→project-local leak (warn)
  - No circular refs across lazy + eager edges
  - Combined char-budget for eager edges (rule + eager targets ≤ cap)

Exits non-zero on error; warnings are reported but do not fail.
Used in CI via `task lint-load-context`.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Iterable

import yaml

QUIET = "--quiet" in sys.argv

ROOT = Path(__file__).resolve().parent.parent

SCAN_DIRS = [
    ROOT / ".agent-src.uncondensed" / "rules",
    ROOT / ".agent-src.uncondensed" / "contexts",
    ROOT / "agents" / "contexts",
]

ALLOWED_PREFIXES = (
    "contexts/",                               # logical name (canonical — P1.1 / P5.3)
    ".agent-src/contexts/",                    # projected (defensive — only seen in condensed inputs)
    "agents/settings/contexts/",                        # project-local
)

# `.agent-src.uncondensed/contexts/` was the legacy fully-qualified form
# (pre road-to-path-fixes.md P5.3). It is now a hard error: P2.1 migrated
# all in-tree rules to logical names, the rewriter resolves them at
# condense time, and the schema regex in `scripts/schemas/rule.schema.json`
# rejects the prefix at validate-schema time. Keeping a separate runtime
# diagnostic so the failure points authors at the canonical
# `contexts/<area>/<file>.md` form rather than a generic schema mismatch.
LEGACY_PREFIX = ".agent-src.uncondensed/contexts/"

# Logical names resolve against the source root.
SOURCE_ROOT = ROOT / ".agent-src.uncondensed"

PUBLIC_RULE_PREFIX = ".agent-src.uncondensed/rules/"
PROJECT_LOCAL_PREFIX = "agents/settings/contexts/"


def resolve_entry(entry: str) -> Path:
    """Resolve a `load_context:` entry to an absolute path on disk.

    Logical names (`contexts/...`) live under `.agent-src.uncondensed/`;
    fully-qualified entries are repo-root-relative.
    """
    if entry.startswith("contexts/"):
        return SOURCE_ROOT / entry
    return ROOT / entry

HARD_FLOOR_RULES = {"non-destructive-by-default", "security-sensitive-stop"}

CAP_ALWAYS = 2_500
CAP_AUTO = 4_000
CAP_SAFETY = 5_000


def parse_frontmatter(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        return {}
    end = text.find("\n---\n", 4)
    if end == -1:
        return {}
    try:
        data = yaml.safe_load(text[4:end])
    except yaml.YAMLError:
        return {}
    return data if isinstance(data, dict) else {}


def collect_files() -> Iterable[Path]:
    for d in SCAN_DIRS:
        if d.exists():
            yield from d.rglob("*.md")


def rel(p: Path) -> str:
    return p.relative_to(ROOT).as_posix()


def cap_for(rule_path: Path, fm: dict) -> int:
    if rule_path.stem in HARD_FLOOR_RULES:
        return CAP_SAFETY
    rtype = (fm.get("type") or "").strip('"').strip("'")
    if rtype == "always":
        return CAP_ALWAYS
    if rtype == "auto":
        return CAP_AUTO
    return CAP_AUTO  # default for non-rule contexts cited in eager (won't trigger)


def find_cycles(graph: dict[str, list[str]]) -> list[list[str]]:
    cycles: list[list[str]] = []
    visiting: set[str] = set()
    visited: set[str] = set()
    stack: list[str] = []

    def dfs(node: str) -> None:
        if node in visiting:
            i = stack.index(node)
            cycles.append(stack[i:] + [node])
            return
        if node in visited:
            return
        visiting.add(node)
        stack.append(node)
        for nxt in graph.get(node, []):
            dfs(nxt)
        stack.pop()
        visiting.discard(node)
        visited.add(node)

    for n in graph:
        dfs(n)
    return cycles


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []
    graph: dict[str, list[str]] = {}

    for f in collect_files():
        fm = parse_frontmatter(f)
        lazy = fm.get("load_context") or []
        eager = fm.get("load_context_eager") or []
        if not (lazy or eager):
            continue
        if not isinstance(lazy, list) or not isinstance(eager, list):
            errors.append(f"{rel(f)}: load_context* must be a list")
            continue

        edges = list(lazy) + list(eager)
        graph[rel(f)] = edges

        for entry in edges:
            if not isinstance(entry, str) or not entry.endswith(".md"):
                errors.append(f"{rel(f)}: entry not str ending in .md → {entry!r}")
                continue
            if entry.startswith(LEGACY_PREFIX):
                logical = entry[len(".agent-src.uncondensed/"):]
                errors.append(
                    f"{rel(f)}: legacy `.agent-src.uncondensed/` prefix in load_context → {entry} "
                    f"— use logical name `{logical}` instead (road-to-path-fixes.md P5.3)"
                )
                continue
            if not entry.startswith(ALLOWED_PREFIXES):
                errors.append(f"{rel(f)}: disallowed root → {entry}")
                continue
            target = resolve_entry(entry)
            if not target.exists():
                errors.append(f"{rel(f)}: target missing → {entry}")
                continue
            if rel(f).startswith(PUBLIC_RULE_PREFIX) and entry.startswith(PROJECT_LOCAL_PREFIX):
                warnings.append(f"{rel(f)}: public rule references project-local context → {entry}")

        if eager:
            cap = cap_for(f, fm)
            total = len(f.read_text(encoding="utf-8"))
            for entry in eager:
                tgt = resolve_entry(entry)
                if tgt.exists():
                    total += len(tgt.read_text(encoding="utf-8"))
            if total > cap:
                errors.append(f"{rel(f)}: eager-load combined chars {total} > cap {cap}")

    for cycle in find_cycles(graph):
        errors.append("circular load_context: " + " → ".join(cycle))

    for w in warnings:
        print(f"⚠️  {w}")
    for e in errors:
        print(f"❌  {e}")
    if errors:
        return 1
    if not QUIET:
        print(f"✅  load_context schema clean ({len(graph)} declarer(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main())
