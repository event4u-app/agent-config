#!/usr/bin/env python3
"""Lint archive notes under agents/archived-skills/.

Enforces the contract from
.agent-src.uncompressed/templates/skill-archive-note.md:

  1. Every <slug>.md under agents/archived-skills/ has the six required
     frontmatter fields with valid values.
  2. `reason` is one of {unused, merged, superseded, deprecated}.
  3. When `reason ∈ {merged, superseded}` the `replacement` slug exists
     under .agent-src.uncompressed/skills/.
  4. No archived slug still has a live SKILL.md (no zombies).
  5. No live SKILL.md cites an archived slug as a router target in
     its frontmatter `replaced_by:` field.

Hooked into `task ci` via `task lint-archived-skills`. Passes cleanly
against an empty agents/archived-skills/ (only README.md present).

Exit codes:
  0  contract holds
  1  one or more violations
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

QUIET = "--quiet" in sys.argv

REPO = Path(__file__).resolve().parents[1]
ARCHIVE_DIR = REPO / "agents" / "archived-skills"
SKILLS_DIR = REPO / ".agent-src.uncompressed" / "skills"

REQUIRED_FIELDS = ("slug", "archived_on", "last_seen_count", "reason", "replacement", "last_known_callers")
VALID_REASONS = frozenset({"unused", "merged", "superseded", "deprecated"})
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def parse_frontmatter(text: str) -> dict[str, str] | None:
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---\n", 4)
    if end == -1:
        return None
    fields: dict[str, str] = {}
    for line in text[4:end].splitlines():
        if ":" not in line or line.startswith(" ") or line.startswith("-"):
            continue
        k, _, v = line.partition(":")
        fields[k.strip()] = v.strip().strip('"').strip("'")
    return fields


def archived_slugs() -> list[Path]:
    return sorted(p for p in ARCHIVE_DIR.glob("*.md") if p.name != "README.md")


def live_skill_slugs() -> set[str]:
    return {p.name for p in SKILLS_DIR.iterdir() if p.is_dir() and (p / "SKILL.md").exists()}


def main() -> int:
    if not ARCHIVE_DIR.exists():
        print(f"❌  lint_archived_skills: {ARCHIVE_DIR} missing", file=sys.stderr)
        return 1

    notes = archived_slugs()
    live = live_skill_slugs()
    errors: list[str] = []

    archived_keys: set[str] = set()
    for note in notes:
        text = note.read_text(encoding="utf-8")
        fm = parse_frontmatter(text)
        slug_from_name = note.stem

        if fm is None:
            errors.append(f"{note.name}: missing or malformed frontmatter")
            continue

        missing = [f for f in REQUIRED_FIELDS if f not in fm]
        if missing:
            errors.append(f"{note.name}: missing required fields: {', '.join(missing)}")
            continue

        if fm["slug"] != slug_from_name:
            errors.append(f"{note.name}: slug field '{fm['slug']}' != filename stem '{slug_from_name}'")

        if not DATE_RE.match(fm["archived_on"]):
            errors.append(f"{note.name}: archived_on '{fm['archived_on']}' is not YYYY-MM-DD")

        if fm["reason"] not in VALID_REASONS:
            errors.append(f"{note.name}: reason '{fm['reason']}' not in {sorted(VALID_REASONS)}")

        try:
            int(fm["last_seen_count"])
        except ValueError:
            errors.append(f"{note.name}: last_seen_count '{fm['last_seen_count']}' is not an integer")

        replacement = fm["replacement"]
        reason = fm["reason"]
        if reason in {"merged", "superseded"}:
            if replacement == "none" or not replacement:
                errors.append(f"{note.name}: reason={reason} requires a replacement slug, got 'none'")
            elif replacement not in live:
                errors.append(f"{note.name}: replacement '{replacement}' not found under {SKILLS_DIR}")
        elif reason in {"unused", "deprecated"}:
            if replacement not in {"none", ""}:
                if replacement not in live:
                    errors.append(f"{note.name}: replacement '{replacement}' not found under {SKILLS_DIR}")

        if fm["slug"] in live:
            errors.append(f"{note.name}: slug '{fm['slug']}' still has a live SKILL.md (zombie)")

        archived_keys.add(fm["slug"])

    # Cross-check: live skills must not list an archived slug as replaced_by.
    for skill_dir in sorted(SKILLS_DIR.iterdir()):
        skill_md = skill_dir / "SKILL.md"
        if not skill_md.exists():
            continue
        text = skill_md.read_text(encoding="utf-8")
        fm = parse_frontmatter(text)
        if fm is None:
            continue
        rb = fm.get("replaced_by", "").strip()
        if rb and rb in archived_keys:
            errors.append(f"{skill_dir.name}/SKILL.md: replaced_by '{rb}' points at an archived slug")

    if errors:
        print(f"❌  lint_archived_skills: {len(errors)} violation(s) across {len(notes)} note(s)", file=sys.stderr)
        for e in errors:
            print(f"    {e}", file=sys.stderr)
        return 1

    if not QUIET:
        print(f"✅  lint_archived_skills: {len(notes)} archive note(s), contract holds")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
