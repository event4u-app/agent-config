#!/usr/bin/env python3
"""Agent-Skills name-compliance linter (2026-06 Zed fix).

Strict Agent-Skills consumers (Zed, Anthropic skill validators) require a
skill `name:` to (a) match ``^[a-z0-9]+(-[a-z0-9]+)*$`` (lowercase letters,
digits, single hyphens; no leading/trailing/double hyphen), (b) be at most
64 characters, and (c) equal the directory name the SKILL.md lives in.
Colon-namespaced command names (``council:default``) used to leak into every
skill-shaped projection (``.claude/skills/``, global ``<anchor>/skills/``
deploys) and made Zed reject the entries with *"Skill name must contain only
lowercase letters, numbers, and hyphens"*.

Two checks, both blocking:

1. **Commands** — every ``src/domains/<pack>/<subpath>/command.md`` carries
   ``name:`` equal to the canonical path-derived hyphen slug
   (``_lib.agent_src.command_slug``). The slug is what condense.py uses as
   the ``.claude/skills/<slug>/`` directory, so name==slug guarantees the
   projected SKILL.md satisfies (c) by construction.
2. **Skills** — every ``src/skills/<dir>/SKILL.md`` carries ``name:`` equal
   to ``<dir>`` and matching the Agent-Skills pattern.

Exit codes: 0 = clean, 1 = violations found, 3 = internal error.

Usage:
    python3 src/scripts/lint_agent_skill_names.py
    python3 src/scripts/lint_agent_skill_names.py --quiet
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIR))

from _lib.agent_src import command_slug  # noqa: E402

ROOT = SCRIPTS_DIR.parent.parent
SRC_DOMAINS = ROOT / "src" / "domains"
SRC_SKILLS = ROOT / "src" / "skills"

# Agent-Skills spec name shape (Zed enforces this verbatim; Claude Code is
# lenient today but the spec is the contract): lowercase letters, digits,
# single hyphens, no leading/trailing hyphen, 1-64 chars.
NAME_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
MAX_NAME_LEN = 64

NAME_RE = re.compile(r"^name:\s*(.*)$", re.MULTILINE)


def _frontmatter_name(path: Path) -> str | None:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return None
    end = text.find("\n---", 3)
    block = text[3:end] if end != -1 else text
    m = NAME_RE.search(block)
    return m.group(1).strip().strip('"').strip("'") if m else None


def _spec_violation(name: str) -> str | None:
    if len(name) > MAX_NAME_LEN:
        return f"longer than {MAX_NAME_LEN} chars"
    if not NAME_PATTERN.match(name):
        return ("must contain only lowercase letters, numbers, and single "
                "hyphens (no leading/trailing/double hyphen, no `:`)")
    return None


def check_commands() -> list[str]:
    violations: list[str] = []
    if not SRC_DOMAINS.is_dir():
        return violations
    for md in sorted(SRC_DOMAINS.rglob("command.md")):
        slug = command_slug(md)
        if slug is None:
            continue
        rel = md.relative_to(ROOT)
        name = _frontmatter_name(md)
        if not name:
            violations.append(f"{rel}: missing `name:` frontmatter")
            continue
        spec = _spec_violation(name)
        if spec:
            violations.append(f"{rel}: name `{name}` {spec}")
        if name != slug:
            violations.append(
                f"{rel}: name `{name}` != path-derived slug `{slug}` — "
                f"the slug is the `.claude/skills/` directory name; they "
                f"must match so strict Agent-Skills consumers (Zed) accept "
                f"the projected SKILL.md"
            )
    return violations


def check_skills() -> list[str]:
    violations: list[str] = []
    if not SRC_SKILLS.is_dir():
        return violations
    for skill_dir in sorted(p for p in SRC_SKILLS.iterdir() if p.is_dir()):
        md = skill_dir / "SKILL.md"
        if not md.is_file():
            continue
        rel = md.relative_to(ROOT)
        dirname = skill_dir.name
        spec = _spec_violation(dirname)
        if spec:
            violations.append(f"{rel}: directory `{dirname}` {spec}")
        name = _frontmatter_name(md)
        if not name:
            violations.append(f"{rel}: missing `name:` frontmatter")
            continue
        if name != dirname:
            violations.append(
                f"{rel}: name `{name}` != directory `{dirname}` — Zed "
                f"requires the folder name to match the `name:` field"
            )
    return violations


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    try:
        violations = check_commands() + check_skills()
    except OSError as exc:
        print(f"❌  lint-skill-names internal error: {exc}", file=sys.stderr)
        return 3

    if violations:
        print(f"❌  {len(violations)} Agent-Skills name violation(s):")
        for v in violations:
            print(f"  • {v}")
        print("\nNames must be the path-derived hyphen slug "
              "(command.schema.json `name` pattern; 2026-06 Zed fix).")
        return 1
    if not args.quiet:
        print("✅  All command + skill names are Agent-Skills-spec compliant "
              "(hyphen slugs, name == directory/slug).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
