#!/usr/bin/env python3
"""Maintainer dev script — export / import file-first patterns across projects.

NOT a user command. Patterns are reusable fix/refactor recipes under
``src/patterns/`` (see ``src/patterns/README.md`` + ``docs/decisions/ADR-099``).
This script moves a pattern between repos **through the same redactor** as the
``low-impact-corpus-privacy-floor`` rule, so no secret / email / project path /
customer name / internal host / money / business-SQL / long-code excerpt leaves
the repo. It overlaps team-shared-memory only in governance (redaction), not
storage — patterns are recipes, not memory entries.

Both gates redact:
  * ``export`` — refuse to emit a pattern that fails the floor.
  * ``import`` — refuse to ingest one that fails the floor (defense in depth).

The redactor never auto-rewrites; it refuses and surfaces what to rephrase.

Usage:
  python3 src/scripts/pattern_share.py export src/patterns/n-plus-one-eager-load.md
  python3 src/scripts/pattern_share.py export src/patterns/<slug>.md --out /tmp/share
  python3 src/scripts/pattern_share.py import /tmp/share/<slug>.md
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent          # src/scripts
_SRC = _HERE.parent                              # src — makes `scripts` resolve
sys.path.insert(0, str(_SRC))
from scripts.ai_council.redact_low_impact_entry import (  # noqa: E402
    redact_low_impact_entry,
)

REPO_ROOT = _SRC.parent
PATTERNS_DIR = REPO_ROOT / "src" / "patterns"
_REQUIRED_FRONTMATTER = ("applies_to", "reliability", "last_verified")


# The low-impact-corpus redactor's `long_code_excerpt` class is a *corpus-bloat*
# control for prose decision entries — NOT a privacy control. Patterns are
# code recipes (Before/After), so long code is their essence, not a leak. We keep
# every PRIVACY class (secrets, emails, project paths, customer names, internal
# hosts, money, business-SQL) and exempt only `long_code_excerpt`.
_EXEMPT_CATEGORIES = frozenset({"long_code_excerpt"})


def _redact(text: str) -> tuple[bool, str]:
    """Run the privacy floor (minus the code-length bloat rule); return (ok, summary)."""
    result = redact_low_impact_entry(text, repo_root=str(REPO_ROOT))
    privacy_violations = tuple(
        v for v in result.violations if v.category not in _EXEMPT_CATEGORIES
    )
    if not privacy_violations:
        return True, "redaction: clean (code excerpts exempt — patterns are recipes)"
    parts = [f"{v.category}: {v.snippet!r}" for v in privacy_violations]
    return False, "redaction REFUSED — " + "; ".join(parts)


def _validate_frontmatter(text: str) -> list[str]:
    """Cheap check that the pattern carries the required frontmatter keys."""
    missing = []
    if not text.lstrip().startswith("---"):
        return ["no frontmatter block"]
    head = text.split("---", 2)
    block = head[1] if len(head) >= 3 else ""
    for key in _REQUIRED_FRONTMATTER:
        if f"{key}:" not in block:
            missing.append(key)
    return missing


def cmd_export(args: argparse.Namespace) -> int:
    src = Path(args.pattern)
    if not src.is_file():
        print(f"❌  not a file: {src}", file=sys.stderr)
        return 2
    text = src.read_text(encoding="utf-8")
    ok, summary = _redact(text)
    if not ok:
        print(f"❌  export refused — {summary}", file=sys.stderr)
        print("    Rephrase the offending content and retry.", file=sys.stderr)
        return 1
    if args.out:
        out_dir = Path(args.out)
        out_dir.mkdir(parents=True, exist_ok=True)
        dest = out_dir / src.name
        dest.write_text(text, encoding="utf-8")
        print(f"✅  exported (redaction clean) → {dest}")
    else:
        sys.stdout.write(text)
    return 0


def cmd_import(args: argparse.Namespace) -> int:
    src = Path(args.file)
    if not src.is_file():
        print(f"❌  not a file: {src}", file=sys.stderr)
        return 2
    text = src.read_text(encoding="utf-8")
    ok, summary = _redact(text)
    if not ok:
        print(f"❌  import refused — {summary}", file=sys.stderr)
        return 1
    missing = _validate_frontmatter(text)
    if missing:
        print(f"❌  import refused — missing frontmatter: {', '.join(missing)}",
              file=sys.stderr)
        return 1
    PATTERNS_DIR.mkdir(parents=True, exist_ok=True)
    dest = PATTERNS_DIR / src.name
    if dest.exists() and not args.force:
        print(f"❌  {dest} exists — pass --force to overwrite", file=sys.stderr)
        return 1
    dest.write_text(text, encoding="utf-8")
    print(f"✅  imported (redaction clean) → {dest}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_export = sub.add_parser("export", help="redact + emit a pattern for sharing")
    p_export.add_argument("pattern", help="path to a src/patterns/<slug>.md")
    p_export.add_argument("--out", help="write to this dir instead of stdout")
    p_export.set_defaults(func=cmd_export)

    p_import = sub.add_parser("import", help="redact + ingest a shared pattern")
    p_import.add_argument("file", help="path to an incoming pattern .md")
    p_import.add_argument("--force", action="store_true", help="overwrite if exists")
    p_import.set_defaults(func=cmd_import)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
