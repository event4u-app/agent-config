#!/usr/bin/env python3
"""Generate llms.txt and docs/skills-catalog.md from SKILL.md frontmatter.

Reads name + description from each `.agent-src/skills/*/SKILL.md` and writes:

- `llms.txt`            — machine-readable index (plain text)
- `docs/skills-catalog.md` — human-readable catalog (markdown)

Idempotent. Safe to re-run. Sort order: alphabetical by skill name.

Usage:
    python3 scripts/generate_catalog.py
"""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = REPO_ROOT / ".agent-src" / "skills"
LLMS_TXT = REPO_ROOT / "llms.txt"
CATALOG_MD = REPO_ROOT / "docs" / "skills-catalog.md"

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL)
NAME_RE = re.compile(r"^name:\s*(.+?)\s*$", re.MULTILINE)
DESC_RE = re.compile(r"^description:\s*\"?(.+?)\"?\s*$", re.MULTILINE)


def parse_skill(skill_md: Path) -> tuple[str, str] | None:
    text = skill_md.read_text(encoding="utf-8")
    m = FRONTMATTER_RE.match(text)
    if not m:
        return None
    front = m.group(1)
    name_m = NAME_RE.search(front)
    desc_m = DESC_RE.search(front)
    if not name_m or not desc_m:
        return None
    return name_m.group(1).strip(), desc_m.group(1).strip()


def collect_skills() -> list[tuple[str, str]]:
    skills = []
    for skill_dir in sorted(SKILLS_DIR.iterdir()):
        if not skill_dir.is_dir():
            continue
        skill_md = skill_dir / "SKILL.md"
        if not skill_md.exists():
            continue
        parsed = parse_skill(skill_md)
        if parsed is not None:
            skills.append(parsed)
    return skills


def render_llms_txt(skills: list[tuple[str, str]]) -> str:
    lines = [
        "# agent-config — Skill Index",
        "",
        "Machine-readable index of all skills in this package. Each line:",
        "  <skill-name>: <one-line description>",
        "",
        "Source: .agent-src/skills/<name>/SKILL.md",
        "Catalog: docs/skills-catalog.md",
        "",
    ]
    for name, desc in skills:
        lines.append(f"{name}: {desc}")
    lines.append("")
    return "\n".join(lines)


def render_catalog_md(skills: list[tuple[str, str]]) -> str:
    lines = [
        "# Skills Catalog",
        "",
        f"All **{len(skills)} skills** available in this package, in alphabetical order.",
        "Click a skill name to open its SKILL.md and read the full guidance.",
        "",
        "> **Regenerate:** `python3 scripts/generate_catalog.py`",
        "> This file is auto-generated from `SKILL.md` frontmatter — do not edit manually.",
        "",
        "| Skill | What your agent learns |",
        "|---|---|",
    ]
    for name, desc in skills:
        lines.append(f"| [`{name}`](../.agent-src/skills/{name}/SKILL.md) | {desc} |")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("← [Back to README](../README.md)")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    if not SKILLS_DIR.exists():
        print(f"❌  Skills directory not found: {SKILLS_DIR}")
        return 1
    skills = collect_skills()
    if not skills:
        print("❌  No skills found.")
        return 1

    LLMS_TXT.write_text(render_llms_txt(skills), encoding="utf-8")
    CATALOG_MD.parent.mkdir(parents=True, exist_ok=True)
    CATALOG_MD.write_text(render_catalog_md(skills), encoding="utf-8")

    print(f"✅  Wrote {LLMS_TXT.relative_to(REPO_ROOT)} ({len(skills)} skills)")
    print(f"✅  Wrote {CATALOG_MD.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
