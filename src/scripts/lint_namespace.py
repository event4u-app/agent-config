#!/usr/bin/env python3
"""Namespace linter. Enforces `<stem>-<intent>` kebab-case + reserved
names list across skills / rules / commands / personas.

Contract: docs/contracts/namespace.md.
Wired into: `task lint-skills` (taskfiles/ci-fast.yml).
"""
from __future__ import annotations
import argparse, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
SRC = ROOT / ".agent-src.uncondensed"

# Source-of-truth regex; mirrored in docs/contracts/namespace.md § 1.
NAME_RE = re.compile(r"^[a-z][a-z0-9]*(-[a-z0-9]+)*$")

MIN_LEN = 2
MIN_LEN_SKILL = 3
MAX_LEN = 64

RESERVED = {"pattern", "claude-memories", "default", "index", "router"}

# Filenames that are documentation, not artefacts.
NON_ARTEFACTS = {"README.md", "INDEX.md"}

# (kind, root, glob, depth, sub_verb) — depth tells us how to extract
# the name. depth=0 → file stem; depth=1 → first directory under root.
# sub_verb=True → the path is a `<group>/<verb>.md` form; reserved-name
# check is skipped because the verb is namespaced under the group.
TARGETS = [
    ("skill",    SRC / "skills",    "*/SKILL.md", 1, False),
    ("rule",     SRC / "rules",     "*.md",       0, False),
    ("command",  SRC / "commands",  "*.md",       0, False),
    ("command",  SRC / "commands",  "*/*.md",     0, True),
    ("persona",  SRC / "personas",  "*.md",       0, False),
]


def _name_for(path: Path, root: Path, depth: int) -> str:
    if depth == 0:
        return path.stem
    rel = path.relative_to(root)
    return rel.parts[0]


def _shape_errors(name: str, *, sub_verb: bool = False,
                  kind: str = "command") -> list[str]:
    errs = []
    floor = MIN_LEN_SKILL if kind == "skill" else MIN_LEN
    if not (floor <= len(name) <= MAX_LEN):
        errs.append(f"length — {len(name)} chars (must be {floor}–{MAX_LEN})")
    if not NAME_RE.match(name):
        errs.append("regex — must match ^[a-z][a-z0-9]*(-[a-z0-9]+)*$")
    if name in RESERVED and not sub_verb:
        errs.append(f"reserved — '{name}' in reserved-names list")
    return errs


def _skill_name_field(path: Path) -> str | None:
    """Read `name:` from skill frontmatter. None on missing / unparseable."""
    try:
        text = path.read_text(encoding="utf-8")
    except Exception:
        return None
    if not text.startswith("---"):
        return None
    end = text.find("\n---", 3)
    if end < 0:
        return None
    fm = text[3:end]
    for line in fm.splitlines():
        m = re.match(r"^name:\s*['\"]?([^'\"]+)['\"]?\s*$", line.strip())
        if m:
            return m.group(1).strip()
    return None


def scan() -> tuple[int, int]:
    issues = 0
    checked = 0
    seen: set[tuple[str, str]] = set()
    for kind, root, glob, depth, sub_verb in TARGETS:
        if not root.is_dir():
            continue
        for path in sorted(root.glob(glob)):
            if path.name in NON_ARTEFACTS:
                continue
            name = _name_for(path, root, depth)
            key = (kind, str(path.relative_to(root)))
            if key in seen:
                continue
            seen.add(key)
            checked += 1
            errs = _shape_errors(name, sub_verb=sub_verb, kind=kind)
            if kind == "skill":
                fm_name = _skill_name_field(path)
                if fm_name and fm_name != name:
                    errs.append(f"skill — frontmatter name='{fm_name}' != dir '{name}'")
            for e in errs:
                rel = path.relative_to(ROOT)
                print(f"❌ {rel}: {e}", file=sys.stderr)
                issues += 1
    return checked, issues


def check_single(name: str) -> int:
    errs = _shape_errors(name)
    if not errs:
        print(f"✅ '{name}' is a valid artefact name")
        return 0
    for e in errs:
        print(f"❌ '{name}': {e}", file=sys.stderr)
    return 1


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--name", help="Check a single candidate name and exit.")
    ap.add_argument("--quiet", action="store_true",
                    help="Suppress the summary line on success.")
    args = ap.parse_args()
    if args.name:
        return check_single(args.name)
    checked, issues = scan()
    if issues:
        print(f"BASELINE: {issues} issue(s) across {checked} name(s)", file=sys.stderr)
        return 1
    if not args.quiet:
        print(f"BASELINE: 0 issues · {checked} name(s) checked")
    return 0


if __name__ == "__main__":
    sys.exit(main())
