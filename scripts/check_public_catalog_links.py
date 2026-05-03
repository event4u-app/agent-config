#!/usr/bin/env python3
"""
Public-catalog link checker (regression guard for road-to-pr-34-followups 1.1).

`docs/catalog.md` is the consumer-facing catalog rendered by
`scripts/generate_index.py`. Consumers receive the package via npm /
Composer / archive surfaces — `.agent-src.uncompressed/` is **not**
shipped (see `package.json#files`). Every link in the public catalog
must therefore resolve to a shipped surface.

Checks:
  1. No link href contains `.agent-src.uncompressed/`.
  2. Every link href resolves on disk.
  3. Every link href starts with a path declared in `package.json#files`
     (or one of the always-shipped root files).

Exit codes: 0 = clean, 1 = violations found.

Usage:
    python3 scripts/check_public_catalog_links.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "docs" / "catalog.md"
PACKAGE_JSON = ROOT / "package.json"

LINK_RE = re.compile(r"\]\((?P<href>[^)\s]+)(?:\s+\"[^\"]*\")?\)")
FORBIDDEN_PREFIX = ".agent-src.uncompressed/"


def _shipped_roots() -> tuple[set[str], set[str]]:
    """Return (shipped_dirs, shipped_files) from package.json#files."""
    data = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))
    dirs: set[str] = set()
    files: set[str] = set()
    for entry in data.get("files", []):
        if entry.endswith("/"):
            dirs.add(entry.rstrip("/"))
        else:
            files.add(entry)
    return dirs, files


def _resolve(href: str) -> Path | None:
    href = href.split("#", 1)[0]
    if not href or href.startswith(("http://", "https://", "mailto:", "tel:")):
        return None
    target = (CATALOG.parent / href).resolve()
    try:
        return target.relative_to(ROOT.resolve())
    except ValueError:
        return None


def _under_shipped_surface(rel: Path, dirs: set[str], files: set[str]) -> bool:
    s = str(rel)
    if s in files:
        return True
    return any(s == d or s.startswith(d + "/") for d in dirs)


def main() -> int:
    if not CATALOG.exists():
        print(f"❌  {CATALOG.relative_to(ROOT)} not found")
        return 1

    dirs, files = _shipped_roots()
    text = CATALOG.read_text(encoding="utf-8")

    forbidden: list[tuple[int, str]] = []
    missing: list[tuple[int, str]] = []
    unshipped: list[tuple[int, str]] = []

    for lineno, line in enumerate(text.splitlines(), 1):
        for m in LINK_RE.finditer(line):
            href = m.group("href")
            if FORBIDDEN_PREFIX in href:
                forbidden.append((lineno, href))
                continue
            rel = _resolve(href)
            if rel is None:
                continue  # external / non-resolvable
            if not (ROOT / rel).exists():
                missing.append((lineno, href))
                continue
            if not _under_shipped_surface(rel, dirs, files):
                unshipped.append((lineno, href))

    total_violations = len(forbidden) + len(missing) + len(unshipped)
    if not total_violations:
        print(f"✅  docs/catalog.md — all links resolve to shipped surfaces.")
        return 0

    print(f"❌  docs/catalog.md — {total_violations} violation(s):")
    if forbidden:
        print(f"\n  {len(forbidden)} link(s) point at unshipped `.agent-src.uncompressed/`:")
        for ln, href in forbidden[:10]:
            print(f"    line {ln}: {href}")
        if len(forbidden) > 10:
            print(f"    … and {len(forbidden) - 10} more")
    if missing:
        print(f"\n  {len(missing)} link(s) do not resolve on disk:")
        for ln, href in missing[:10]:
            print(f"    line {ln}: {href}")
    if unshipped:
        print(f"\n  {len(unshipped)} link(s) point outside `package.json#files`:")
        for ln, href in unshipped[:10]:
            print(f"    line {ln}: {href}")
    print("\nFix: update `scripts/generate_index.py` _to_shipped_path() / catalog renderer,")
    print("then re-run `python3 scripts/generate_index.py`.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
