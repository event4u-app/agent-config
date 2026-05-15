#!/usr/bin/env python3
"""Verify every skill link in role-based docs resolves to a real file.

Part of step-12 Phase 2. Runs in `task ci` to catch link rot when a
skill is renamed or removed but the role docs still reference it.

Scans `docs/getting-started-by-role.md` and `docs/getting-started-laravel.md`
for markdown links of the form `../.agent-src/skills/<name>/SKILL.md`
(relative to docs/) and checks that the target file exists on disk.

Exit codes:
  0 — every link resolves
  1 — at least one broken link; prints the offending file:line:url tuples
  2 — usage error (one of the role doc files missing)

Usage:
  python3 scripts/check_role_doc_links.py
  python3 scripts/check_role_doc_links.py --quiet
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = ROOT / "docs"

# (display-path, on-disk path, link-anchor) — anchor is the relative
# prefix that identifies a skill link from inside docs/.
ROLE_DOCS = [
    DOCS_DIR / "getting-started-by-role.md",
    DOCS_DIR / "getting-started-laravel.md",
]

# Markdown link: [label](path). We only check the (path) part. The
# regex tolerates trailing #anchor fragments and ignores absolute URLs.
LINK_RE = re.compile(r"\]\(([^)\s]+)\)")

# Anchors we know how to resolve. Each tuple is (prefix, base_dir).
ANCHORS: list[tuple[str, Path]] = [
    ("../.agent-src/skills/", ROOT / ".agent-src" / "skills"),
    ("../.agent-src/commands/", ROOT / ".agent-src" / "commands"),
    ("../.agent-src/rules/", ROOT / ".agent-src" / "rules"),
    ("../agents/", ROOT / "agents"),
    ("contracts/", DOCS_DIR / "contracts"),
    ("guidelines/", DOCS_DIR / "guidelines"),
]


def resolve(url: str, doc_path: Path) -> Path | None:
    """Return the on-disk target path for a relative link, or None if external."""
    if url.startswith(("http://", "https://", "mailto:")):
        return None
    bare = url.split("#", 1)[0]
    if not bare:
        return None
    # Relative to the doc's own directory.
    target = (doc_path.parent / bare).resolve()
    return target


def scan(doc_path: Path) -> list[tuple[int, str]]:
    """Return list of (line_no, url) tuples for every non-external link."""
    if not doc_path.is_file():
        print(f"error: missing role doc: {doc_path}", file=sys.stderr)
        sys.exit(2)
    links: list[tuple[int, str]] = []
    for i, line in enumerate(doc_path.read_text(encoding="utf-8").splitlines(), 1):
        for m in LINK_RE.finditer(line):
            url = m.group(1)
            if url.startswith(("http://", "https://", "mailto:")):
                continue
            links.append((i, url))
    return links


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--quiet", action="store_true", help="Suppress success summary.")
    args = p.parse_args()

    failures: list[tuple[Path, int, str]] = []
    checked = 0

    for doc in ROLE_DOCS:
        for line_no, url in scan(doc):
            target = resolve(url, doc)
            if target is None:
                continue
            checked += 1
            if not target.exists():
                failures.append((doc, line_no, url))

    if failures:
        print("Broken links in role docs:", file=sys.stderr)
        for doc, line_no, url in failures:
            rel = doc.relative_to(ROOT)
            print(f"  {rel}:{line_no}  -> {url}", file=sys.stderr)
        print(f"\n{len(failures)} broken / {checked} checked", file=sys.stderr)
        return 1

    if not args.quiet:
        print(f"check_role_doc_links: {checked} links OK across {len(ROLE_DOCS)} files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
