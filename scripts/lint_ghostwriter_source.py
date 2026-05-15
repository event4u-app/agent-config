#!/usr/bin/env python3
"""Lint ghostwriter profile sources.

Two storage tiers exist (see docs/contracts/ghostwriter-schema.md):

  * .agent-src.uncompressed/ghostwriter/  — package source. Ships
    fictional fixtures ONLY (`fictional: true`). Every file stem must
    be on scripts/ghostwriter_fixture_allowlist.txt.
  * agents/ghostwriter/                    — consumer real-person
    profiles. Gitignored. Must NOT carry `fictional: true`.

This lint enforces both rules and runs in `task ci`.

Exit codes:
  0  all profiles compliant
  1  one or more violations (missing flag, off-allowlist, mis-tier)
"""
from __future__ import annotations

import sys
from pathlib import Path

QUIET = "--quiet" in sys.argv

REPO = Path(__file__).resolve().parents[1]
PACKAGE_DIR = REPO / ".agent-src.uncompressed" / "ghostwriter"
CONSUMER_DIR = REPO / "agents" / "ghostwriter"
ALLOWLIST = REPO / "scripts" / "ghostwriter_fixture_allowlist.txt"
EXEMPT_STEMS = frozenset({"README"})


def load_allowlist() -> set[str]:
    if not ALLOWLIST.exists():
        return set()
    stems: set[str] = set()
    for line in ALLOWLIST.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        stems.add(s)
    return stems


def parse_frontmatter_field(text: str, key: str) -> str | None:
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---\n", 4)
    if end == -1:
        return None
    for line in text[4:end].splitlines():
        if ":" not in line:
            continue
        k, _, v = line.partition(":")
        if k.strip() == key:
            return v.strip().strip('"').strip("'")
    return None


def lint_package_side(allowlist: set[str]) -> list[str]:
    errors: list[str] = []
    if not PACKAGE_DIR.exists():
        return errors
    for path in sorted(PACKAGE_DIR.glob("*.md")):
        stem = path.stem
        if stem in EXEMPT_STEMS:
            continue
        if stem not in allowlist:
            errors.append(
                f"    off-allowlist (package source): {path.relative_to(REPO)} "
                f"— add '{stem}' to scripts/ghostwriter_fixture_allowlist.txt"
            )
            continue
        flag = parse_frontmatter_field(path.read_text(encoding="utf-8"), "fictional")
        if flag != "true":
            errors.append(
                f"    missing 'fictional: true' (package source): {path.relative_to(REPO)} "
                f"(got fictional={flag!r})"
            )
    return errors


def lint_consumer_side() -> list[str]:
    errors: list[str] = []
    if not CONSUMER_DIR.exists():
        return errors
    for path in sorted(CONSUMER_DIR.glob("*.md")):
        if path.stem in EXEMPT_STEMS:
            continue
        flag = parse_frontmatter_field(path.read_text(encoding="utf-8"), "fictional")
        if flag == "true":
            errors.append(
                f"    'fictional: true' in consumer tree: {path.relative_to(REPO)} "
                f"— fictional fixtures belong in .agent-src.uncompressed/ghostwriter/"
            )
    return errors


def main() -> int:
    allowlist = load_allowlist()
    pkg_errors = lint_package_side(allowlist)
    cons_errors = lint_consumer_side()
    errors = pkg_errors + cons_errors

    if errors:
        print(
            f"❌  lint_ghostwriter_source: {len(errors)} violation(s)",
            file=sys.stderr,
        )
        for line in errors:
            print(line, file=sys.stderr)
        print(
            "    see docs/contracts/ghostwriter-schema.md § Lint enforcement",
            file=sys.stderr,
        )
        return 1

    if not QUIET:
        pkg_count = (
            sum(1 for p in PACKAGE_DIR.glob("*.md") if p.stem not in EXEMPT_STEMS)
            if PACKAGE_DIR.exists()
            else 0
        )
        cons_count = (
            sum(1 for p in CONSUMER_DIR.glob("*.md") if p.stem not in EXEMPT_STEMS)
            if CONSUMER_DIR.exists()
            else 0
        )
        print(
            f"✅  lint_ghostwriter_source: {pkg_count} package fixture(s), "
            f"{cons_count} consumer profile(s), all compliant"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
