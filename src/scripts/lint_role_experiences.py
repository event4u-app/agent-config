#!/usr/bin/env python3
"""Linter for ``agents/roles/<slug>/`` role experiences.

Asserts the structural floor pinned in
``docs/contracts/role-experience.md``:

  1. Every role directory has ``index.md`` + ``skills.yml``.
  2. ``index.md`` carries all required frontmatter keys (``role``,
     ``display_name``, ``tagline``, ``recommended_packs``,
     ``install_path_hint``, ``recruit_session_ref``, ``status``).
  3. ``index.md`` body declares at least three first tasks (per
     ``## Three first tasks`` heading + numbered list).
  4. ``prompts/`` contains at least five prompts (per the roadmap's
     Phase B Step 6 acceptance — ``≥ 5 prompts per role``).
  5. Every prompt under ``prompts/<name>.md`` carries the four
     required frontmatter keys (``name``, ``intent``, ``inputs``,
     ``output_shape``) plus ``skill_hint``.
  6. Every ``skills.yml`` skill ``id`` resolves to an existing skill
     under ``.agent-src.uncondensed/skills/<id>/`` or
     ``dist/agent-src/skills/<id>/`` (condensed projection counts).

The roadmap step is intentionally opt-in for CI — the existing
``task ci`` wiring is the caller's concern; this script is the
mechanical floor it can wrap.

Phase B Step 6 of ``road-to-frictionless-employee-workspace.md``.
Adds a ``--plain-language`` mode for Phase C Step 5 that scans the
role indices for jargon listed in
``docs/contracts/plain-language-surface.md`` and flags any hit.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
ROLES_DIR = ROOT / "agents" / "roles"
SKILL_SOURCES = [
    ROOT / ".agent-src.uncondensed" / "skills",
    ROOT / "dist/agent-src" / "skills",
]

REQUIRED_INDEX_KEYS = {
    "role",
    "display_name",
    "tagline",
    "recommended_packs",
    "install_path_hint",
    "recruit_session_ref",
    "status",
}

REQUIRED_PROMPT_KEYS = {"name", "intent", "inputs", "output_shape", "skill_hint"}

MIN_FIRST_TASKS = 3
MIN_PROMPTS_PER_ROLE = 5

FRONTMATTER_RE = re.compile(r"^---\r?\n(.*?)\r?\n---\r?\n", re.DOTALL)
TASK_HEADING_RE = re.compile(r"^## Three first tasks\s*$", re.MULTILINE)
TASK_ITEM_RE = re.compile(r"^\s*\d+\.\s+\*\*[^*]+\*\*", re.MULTILINE)

# Jargon list mirrors docs/contracts/plain-language-surface.md.
PLAIN_LANGUAGE_JARGON = [
    "council",
    "trust level",
    "pack",
    "orchestration",
    "contract",
    "advisory",
]


def parse_frontmatter(text: str) -> tuple[dict, str]:
    m = FRONTMATTER_RE.match(text)
    if m is None:
        return {}, text
    try:
        loaded = yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError:
        return {}, text[m.end():]
    if not isinstance(loaded, dict):
        return {}, text[m.end():]
    return loaded, text[m.end():]


def count_first_tasks(body: str) -> int:
    heading_match = TASK_HEADING_RE.search(body)
    if heading_match is None:
        return 0
    # Slice from heading to the next "## " heading (or end of file).
    after = body[heading_match.end():]
    next_section = re.search(r"^## ", after, re.MULTILINE)
    section = after[: next_section.start()] if next_section else after
    return len(TASK_ITEM_RE.findall(section))


def all_skills() -> set[str]:
    found: set[str] = set()
    for src in SKILL_SOURCES:
        if not src.exists():
            continue
        for child in src.iterdir():
            if child.is_dir():
                found.add(child.name)
    return found


def lint_role(role_dir: Path, known_skills: set[str], failures: list[str]) -> None:
    slug = role_dir.name
    if slug.startswith(("_", ".")):
        return

    index_path = role_dir / "index.md"
    skills_path = role_dir / "skills.yml"

    if not index_path.exists():
        failures.append(f"{role_dir}: missing index.md")
        return
    if not skills_path.exists():
        failures.append(f"{role_dir}: missing skills.yml")
        return

    fm, body = parse_frontmatter(index_path.read_text(encoding="utf-8"))
    missing_keys = REQUIRED_INDEX_KEYS - set(fm)
    if missing_keys:
        failures.append(
            f"{index_path}: missing frontmatter keys: {sorted(missing_keys)}"
        )

    first_tasks = count_first_tasks(body)
    if first_tasks < MIN_FIRST_TASKS:
        failures.append(
            f"{index_path}: requires ≥ {MIN_FIRST_TASKS} first tasks, found {first_tasks}"
        )

    prompts_dir = role_dir / "prompts"
    prompts = sorted(prompts_dir.glob("*.md")) if prompts_dir.exists() else []
    if len(prompts) < MIN_PROMPTS_PER_ROLE:
        failures.append(
            f"{role_dir}: requires ≥ {MIN_PROMPTS_PER_ROLE} prompts in prompts/, "
            f"found {len(prompts)}"
        )

    for prompt_path in prompts:
        prompt_fm, _ = parse_frontmatter(prompt_path.read_text(encoding="utf-8"))
        missing = REQUIRED_PROMPT_KEYS - set(prompt_fm)
        if missing:
            failures.append(
                f"{prompt_path}: missing frontmatter keys: {sorted(missing)}"
            )

    try:
        skills_doc = yaml.safe_load(skills_path.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError as exc:
        failures.append(f"{skills_path}: malformed YAML ({exc})")
        return
    skill_entries = skills_doc.get("skills", [])
    if not isinstance(skill_entries, list):
        failures.append(f"{skills_path}: `skills:` must be a list")
        return
    for entry in skill_entries:
        if not isinstance(entry, dict):
            failures.append(f"{skills_path}: skill entry is not a mapping: {entry!r}")
            continue
        skill_id = entry.get("id")
        if not isinstance(skill_id, str):
            failures.append(f"{skills_path}: skill entry missing `id`: {entry!r}")
            continue
        if known_skills and skill_id not in known_skills:
            failures.append(
                f"{skills_path}: skill `{skill_id}` does not resolve to an existing skill"
            )


def lint_plain_language(failures: list[str]) -> None:
    """Scan each role's index.md for the six jargon terms; flag hits.

    Skipped sections: frontmatter, fenced code blocks. Role-experience
    index files are the non-developer surface and must not leak the
    package's internal vocabulary.
    """
    for role_dir in sorted(ROLES_DIR.iterdir()):
        if not role_dir.is_dir() or role_dir.name.startswith(("_", ".")):
            continue
        index_path = role_dir / "index.md"
        if not index_path.exists():
            continue
        _, body = parse_frontmatter(index_path.read_text(encoding="utf-8"))
        # Strip fenced code blocks.
        body_stripped = re.sub(r"```[\s\S]*?```", "", body)
        for term in PLAIN_LANGUAGE_JARGON:
            pattern = re.compile(rf"\b{re.escape(term)}\b", re.IGNORECASE)
            if pattern.search(body_stripped):
                failures.append(
                    f"{index_path}: contains the jargon term `{term}` "
                    f"(see docs/contracts/plain-language-surface.md)"
                )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="lint_role_experiences")
    parser.add_argument(
        "--plain-language",
        action="store_true",
        help="Additionally scan role indices for jargon listed in "
        "docs/contracts/plain-language-surface.md.",
    )
    args = parser.parse_args(argv)

    if not ROLES_DIR.exists():
        print(f"lint_role_experiences: roles dir not found at {ROLES_DIR}")
        return 0

    known_skills = all_skills()
    failures: list[str] = []
    for role_dir in sorted(ROLES_DIR.iterdir()):
        if role_dir.is_dir():
            lint_role(role_dir, known_skills, failures)

    if args.plain_language:
        lint_plain_language(failures)

    if failures:
        for f in failures:
            print(f"❌ {f}")
        print(f"\nlint_role_experiences: {len(failures)} failure(s)")
        return 1
    print("✅ lint_role_experiences: all role experiences pass")
    return 0


if __name__ == "__main__":
    sys.exit(main())
