#!/usr/bin/env python3
"""
Token-Optimizer freshness validator.

Per `road-to-token-optimization.md` P1.3: parses the catalog table inside
`.agent-src.uncondensed/skills/token-optimizer/SKILL.md`, verifies every
cited internal asset exists, and `grep`s the trigger keywords against
each target file. Fails on missing target OR keyword mismatch.

Authoritative-link rows (upstream URLs, planned commands marked TBD) are
recorded but not fetched — they live and die with their upstream and are
out of scope for this CI gate.

Acceptance: stdlib-only, deterministic, exit 0 = clean / exit 1 = drift.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))
from _lib.agent_src import resolve_logical  # noqa: E402

# Post-ADR-017 the source-of-truth lives under whichever package owns
# the skill; resolve_logical() walks every artefact root.
SKILL = resolve_logical("skills/token-optimizer/SKILL.md") or (
    REPO_ROOT / ".agent-src.uncondensed" / "skills" / "token-optimizer" / "SKILL.md"
)

from _lib.agent_src import strip_source_prefix  # noqa: E402

# Catalog row pattern: | name | path | keywords | description |
ROW_RE = re.compile(
    r"^\|\s*`?(?P<name>[^`|]+?)`?\s*\|\s*"
    r"(?P<path>[^|]+?)\s*\|\s*"
    r"(?P<keywords>[^|]+?)\s*\|\s*"
    r"(?P<desc>[^|]+?)\s*\|\s*$"
)
KW_RE = re.compile(r"`([^`]+)`")


def parse_catalog(text: str) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    in_catalog = False
    for line in text.splitlines():
        if line.strip().startswith("## "):
            in_catalog = line.strip() == "## Catalog"
            continue
        if not in_catalog:
            continue
        if line.startswith("|---") or line.startswith("| Asset"):
            continue
        m = ROW_RE.match(line)
        if not m:
            continue
        rows.append(
            {
                "name": m["name"].strip(),
                "path": m["path"].strip(),
                "keywords": m["keywords"].strip(),
                "desc": m["desc"].strip(),
            }
        )
    return rows


def is_external(path: str) -> bool:
    p = path.lower()
    return (
        p.startswith("upstream:")
        or p.startswith("http://")
        or p.startswith("https://")
        or p.startswith("tbd")
        or "github.com" in p
    )


def resolve(path: str) -> Path | None:
    if is_external(path):
        return None
    cleaned = path.strip().lstrip("`").rstrip("`")
    cleaned = cleaned.split(")")[0].lstrip("[(")
    # Catalog rows still cite the legacy .agent-src.uncondensed/ prefix
    # for compactness; resolve those across every packages/* root.
    logical = strip_source_prefix(cleaned)
    if logical is not None:
        hit = resolve_logical(logical)
        if hit is not None:
            return hit
    return (REPO_ROOT / cleaned).resolve()


def check_row(row: dict[str, str]) -> list[str]:
    errs: list[str] = []
    if is_external(row["path"]):
        return errs
    target = resolve(row["path"])
    if target is None or not target.exists():
        errs.append(f"[{row['name']}] target missing: {row['path']}")
        return errs
    body = target.read_text(encoding="utf-8", errors="replace").lower()
    for kw in KW_RE.findall(row["keywords"]):
        kw_lc = kw.strip().lower()
        if not kw_lc:
            continue
        if kw_lc not in body:
            errs.append(
                f"[{row['name']}] trigger keyword '{kw}' not found in "
                f"{row['path']} — catalog row may be stale"
            )
    return errs


def main() -> int:
    if not SKILL.exists():
        print(f"ERROR: token-optimizer skill not found at {SKILL}", file=sys.stderr)
        return 1
    text = SKILL.read_text(encoding="utf-8")
    rows = parse_catalog(text)
    if not rows:
        print(
            "ERROR: token-optimizer SKILL.md has no parseable catalog rows",
            file=sys.stderr,
        )
        return 1
    all_errs: list[str] = []
    checked = 0
    for row in rows:
        errs = check_row(row)
        all_errs.extend(errs)
        if not is_external(row["path"]):
            checked += 1
    print(
        f"token-optimizer freshness: {len(rows)} catalog rows, "
        f"{checked} internal targets checked, {len(all_errs)} drift signal(s)"
    )
    for e in all_errs:
        print(f"  FAIL  {e}")
    return 1 if all_errs else 0


if __name__ == "__main__":
    sys.exit(main())
