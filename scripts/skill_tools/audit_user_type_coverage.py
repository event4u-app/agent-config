#!/usr/bin/env python3
"""Block D · D3 — audit_user_type_coverage.

Coverage audit for the user-type axis. User-types are **CLI-only** in v1
(see `docs/contracts/adr-user-types-axis.md` and Phase 4 step 3 of
`agents/roadmaps/step-6-user-types-axis.md`) — skills do NOT declare a
`user-types:` frontmatter key, so persona-style citation counting does
not apply. Instead this script:

  - Inventories every user-type file in the source directory.
  - Scans skills, commands, and `docs/` for `--user-type=<id>` mentions.
  - Flags **orphan references** (CLI mention to a non-existent id) and
    **never-referenced** user-types (file exists but nobody cites it).

Inputs:
  --user-types-dir DIR — directory holding user-type Markdown files
  --search-root DIR    — root to recurse for `--user-type=<id>` mentions
  --json               — machine-readable output

Output: per-user-type reference count + status (ok / never-referenced /
orphan). Exit code: 0 always (advisory, not a CI gate).

Stdlib-only. ≤ 130 LOC. Sibling of `audit_persona_coverage.py`.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Set

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_USER_TYPES = ROOT / ".agent-src.uncompressed" / "user-types"
DEFAULT_SEARCH_ROOT = ROOT / ".agent-src.uncompressed"
REFERENCE_THRESHOLD = 1  # user-type with 0 references → flagged.

# Matches `--user-type=<id>` in command markdown, skill prose, docs.
_REFERENCE_RE = re.compile(r"--user-type=([\w-]+)")


def _read_block(path: Path) -> str:
    text = path.read_text(encoding="utf-8", errors="replace")
    if not text.startswith("---"):
        return ""
    end = text.find("\n---", 3)
    return text[3:end] if end != -1 else ""


def _frontmatter_value(block: str, key: str) -> str | None:
    m = re.search(rf"^{re.escape(key)}\s*:\s*(.+)$", block, re.MULTILINE)
    if not m:
        return None
    val = m.group(1).strip()
    if val.startswith('"') and val.endswith('"'):
        val = val[1:-1]
    return val


def _load_user_types(user_types_dir: Path) -> Set[str]:
    ids: Set[str] = set()
    if not user_types_dir.is_dir():
        return ids
    for md in sorted(user_types_dir.glob("*.md")):
        if md.name.lower() == "readme.md":
            continue
        block = _read_block(md)
        slug = _frontmatter_value(block, "id") or md.stem
        ids.add(slug)
    # Walk one level deeper to skip `_template/` etc.
    for md in sorted(user_types_dir.glob("*/*.md")):
        if "_template" in md.parts:
            continue
        block = _read_block(md)
        slug = _frontmatter_value(block, "id") or md.parent.name
        ids.add(slug)
    return ids


def _count_references(search_root: Path, skip_dir: Path) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    if not search_root.is_dir():
        return counts
    skip_resolved = skip_dir.resolve() if skip_dir.is_dir() else None
    for md in search_root.rglob("*.md"):
        # Don't count references inside the user-types dir itself
        # (the README documents the flag in example form).
        if skip_resolved and skip_resolved in md.resolve().parents:
            continue
        text = md.read_text(encoding="utf-8", errors="replace")
        for slug in _REFERENCE_RE.findall(text):
            counts[slug] = counts.get(slug, 0) + 1
    return counts


def audit(user_types_dir: Path, search_root: Path) -> List[Dict[str, object]]:
    ids = _load_user_types(user_types_dir)
    references = _count_references(search_root, user_types_dir)
    rows: List[Dict[str, object]] = []
    for slug in sorted(ids):
        count = references.get(slug, 0)
        status = "ok" if count >= REFERENCE_THRESHOLD else "never-referenced"
        rows.append({"user_type": slug, "references": count,
                     "threshold": REFERENCE_THRESHOLD, "status": status})
    for slug in sorted(references.keys()):
        if slug not in ids:
            rows.append({"user_type": slug, "references": references[slug],
                         "threshold": REFERENCE_THRESHOLD, "status": "orphan"})
    return rows


def _print_human(rows: List[Dict[str, object]]) -> None:
    if not rows:
        print("(no user-types found)")
        return
    width = max(len(str(r["user_type"])) for r in rows)
    print(f"  {'user-type':<{width}}  refs   status")
    print(f"  {'-' * width}  -----  ----------------")
    for r in rows:
        print(f"  {str(r['user_type']):<{width}}  "
              f"{int(r['references']):>5}  {r['status']}")
    flagged = [r for r in rows if r["status"] != "ok"]
    if flagged:
        print(f"\n  {len(flagged)} user-type(s) flagged "
              f"(never-referenced or orphan).")


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--user-types-dir", default=str(DEFAULT_USER_TYPES))
    parser.add_argument("--search-root", default=str(DEFAULT_SEARCH_ROOT))
    parser.add_argument("--json", action="store_true",
                        help="emit JSON instead of text")
    args = parser.parse_args(argv)
    rows = audit(Path(args.user_types_dir), Path(args.search_root))
    if args.json:
        json.dump({"rows": rows}, sys.stdout, indent=2)
        sys.stdout.write("\n")
    else:
        _print_human(rows)
    return 0


_SAMPLE = {"threshold": REFERENCE_THRESHOLD}

if __name__ == "__main__":
    raise SystemExit(main())
