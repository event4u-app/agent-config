#!/usr/bin/env python3
"""Context-spine usage linter.

Closes the lint gap left after `scripts/schemas/skill.schema.json`
gained the `context_spine` enum: a skill can declare
`context_spine: [product]` in frontmatter without ever citing the
slot in its body, and the schema check will not catch it.

This linter enforces the author checklist in
`docs/contracts/context-spine.md` § 6: for every slot declared in
frontmatter, the skill body MUST cite the slot at least once.
A citation is any of these tokens:

  - the literal path `agents/context-spine/<slot>.md`
  - the slot name in bold: ``**<slot>**``
  - the slot name in inline code: `` `<slot>` ``

Cap: ≤ 150 LOC, stdlib only. Hooked into `task ci` via
`task lint-context-spine-usage`.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

QUIET = "--quiet" in sys.argv

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILL_GLOBS = (
    ".agent-src.uncompressed/skills/**/SKILL.md",
    ".agent-src/skills/**/SKILL.md",
)
VALID_SLOTS = (
    "product", "team", "repo",
    "channel-stage", "funnel-stage", "customer-segment",
)

CONTEXT_SPINE_PAT = re.compile(
    r"^context_spine:\s*\[([^\]]*)\]\s*$", re.MULTILINE
)


def _frontmatter_and_body(text: str) -> tuple[str, str]:
    if not text.startswith("---\n"):
        return "", text
    end = text.find("\n---\n", 4)
    if end == -1:
        return "", text
    return text[4:end], text[end + 5 :]


def _read_spine(fm: str) -> list[str] | None:
    m = CONTEXT_SPINE_PAT.search(fm)
    if m is None:
        return None
    raw = m.group(1).strip()
    if not raw:
        return []
    return [s.strip().strip("'\"") for s in raw.split(",") if s.strip()]


def _slot_cited(body: str, slot: str) -> bool:
    """A slot is cited if any of three forms appears in the body."""
    forms = (
        f"agents/context-spine/{slot}.md",
        f"**{slot}**",
        f"`{slot}`",
    )
    return any(form in body for form in forms)


def lint_skill(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    fm, body = _frontmatter_and_body(text)
    if not fm:
        return []
    slots = _read_spine(fm)
    if slots is None:
        return []
    problems: list[str] = []
    for slot in slots:
        if slot not in VALID_SLOTS:
            problems.append(
                f"unknown_context_spine_slot: '{slot}' "
                f"(valid: {', '.join(VALID_SLOTS)})"
            )
            continue
        if not _slot_cited(body, slot):
            problems.append(
                f"declared context_spine slot '{slot}' is never cited "
                f"in the skill body — add `**{slot}**`, `` `{slot}` ``, "
                f"or a link to `agents/context-spine/{slot}.md` "
                f"(see docs/contracts/context-spine.md § 6)"
            )
    return problems


def main() -> int:
    skills: list[Path] = []
    for pattern in SKILL_GLOBS:
        skills.extend(sorted(REPO_ROOT.glob(pattern)))
    if not skills:
        print("❌  no SKILL.md files matched", file=sys.stderr)
        return 1
    failed = 0
    declared = 0
    for skill in skills:
        rel = skill.relative_to(REPO_ROOT)
        problems = lint_skill(skill)
        text = skill.read_text(encoding="utf-8")
        fm, _ = _frontmatter_and_body(text)
        if fm and CONTEXT_SPINE_PAT.search(fm):
            declared += 1
        if problems:
            failed += 1
            print(f"❌  {rel}", file=sys.stderr)
            for p in problems:
                print(f"    - {p}", file=sys.stderr)
    if failed:
        print(
            f"\n❌  {failed} skill(s) failed context-spine usage lint "
            f"({declared} skill(s) declare a spine)",
            file=sys.stderr,
        )
        return 1
    if not QUIET:
        print(
            f"✅  {declared} skill(s) declare context_spine; "
            f"all declared slots are cited in the body"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
