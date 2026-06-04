#!/usr/bin/env python3
"""Lint cross-wing handoffs declared in senior-tier skills' ``## Related Skills`` blocks.

Builds a directed graph from every ``tier: senior`` skill's Related Skills
block (markdown links pointing at peer ``SKILL.md`` files), then enforces
the rules from ``docs/contracts/cross-wing-handoff.md`` § 4:

  handoff_cycle           — graph must be a DAG.
  handoff_dangling        — every linked target must exist.
  handoff_tier_mismatch   — senior may delegate only to senior.

Hooked into ``task lint-handoffs`` and ``task ci`` (between ``lint-skills``
and ``test``). Output mirrors ``scripts/skill_linter.py``: ``file:line:reason``.

Exit codes:
  0  no violations
  1  one or more violations
"""
from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

QUIET = "--quiet" in sys.argv

REPO = Path(__file__).resolve().parents[2]
SKILLS_DIR = REPO / ".agent-src.uncondensed" / "skills"

LINK_RE = re.compile(r"\[`?([a-z0-9][a-z0-9-]*)`?\]\(([^)]+SKILL\.md)\)")
RELATED_HEADING_RE = re.compile(r"^##\s+Related\s+Skills\s*$", re.IGNORECASE)
NEXT_HEADING_RE = re.compile(r"^##\s+\S")
WHEN_USE_RE = re.compile(r"^\*\*WHEN\s+to\s+use\s+this\*\*\s*$", re.IGNORECASE)
WHEN_NOT_RE = re.compile(r"^\*\*WHEN\s+NOT\s+to\s+use\s+this\*\*\s*$", re.IGNORECASE)


@dataclass(frozen=True)
class Violation:
    file: Path
    line: int
    code: str
    message: str

    def render(self, repo: Path) -> str:
        rel = self.file.relative_to(repo) if self.file.is_absolute() else self.file
        return f"{rel}:{self.line}:{self.code}: {self.message}"


def parse_frontmatter_tier(text: str) -> str | None:
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---\n", 4)
    if end == -1:
        return None
    for raw in text[4:end].splitlines():
        if ":" not in raw:
            continue
        key, _, val = raw.partition(":")
        if key.strip() == "tier":
            return val.strip().strip('"').strip("'")
    return None


def extract_related_block(text: str) -> tuple[int, list[tuple[int, str]]] | None:
    """Return (block_start_line, [(line, raw_line), ...]) for ``## Related Skills``."""
    lines = text.splitlines()
    start: int | None = None
    for idx, line in enumerate(lines):
        if RELATED_HEADING_RE.match(line):
            start = idx
            break
    if start is None:
        return None
    body: list[tuple[int, str]] = []
    for idx in range(start + 1, len(lines)):
        if NEXT_HEADING_RE.match(lines[idx]):
            break
        body.append((idx + 1, lines[idx]))
    return start + 1, body


def split_when_subblocks(body: list[tuple[int, str]]) -> tuple[
    list[tuple[int, str]], list[tuple[int, str]]
]:
    """Split a ``## Related Skills`` body into (when_to_use, when_not_to_use).

    WHEN-to-use links are composition (delegation) edges — graph for cycles.
    WHEN-NOT-to-use links are alternative pointers (peer cognition the user
    picks instead) — never composition edges. Lines outside both sub-blocks
    are treated as WHEN-to-use for backward compatibility.
    """
    when_use: list[tuple[int, str]] = []
    when_not: list[tuple[int, str]] = []
    current = when_use
    for lineno, raw in body:
        if WHEN_USE_RE.match(raw):
            current = when_use
            continue
        if WHEN_NOT_RE.match(raw):
            current = when_not
            continue
        current.append((lineno, raw))
    return when_use, when_not


def extract_links(body: list[tuple[int, str]]) -> list[tuple[int, str, str]]:
    """Yield ``(line, slug, target_path)`` for every markdown link in the block."""
    out: list[tuple[int, str, str]] = []
    for lineno, raw in body:
        for match in LINK_RE.finditer(raw):
            out.append((lineno, match.group(1), match.group(2)))
    return out


def resolve_target(skill_file: Path, link: str) -> Path:
    return (skill_file.parent / link).resolve()


def detect_cycles(graph: dict[Path, set[Path]]) -> list[list[Path]]:
    cycles: list[list[Path]] = []
    visited: set[Path] = set()
    stack: list[Path] = []
    on_stack: set[Path] = set()

    def dfs(node: Path) -> None:
        if node in on_stack:
            i = stack.index(node)
            cycles.append(stack[i:] + [node])
            return
        if node in visited:
            return
        visited.add(node)
        on_stack.add(node)
        stack.append(node)
        for nxt in graph.get(node, ()):
            dfs(nxt)
        stack.pop()
        on_stack.discard(node)

    for node in list(graph):
        dfs(node)
    return cycles


def lint(skills_dir: Path) -> list[Violation]:
    senior_skills: dict[Path, str] = {}
    all_skills: dict[Path, str] = {}
    for skill_md in sorted(skills_dir.rglob("SKILL.md")):
        text = skill_md.read_text(encoding="utf-8")
        tier = parse_frontmatter_tier(text)
        all_skills[skill_md.resolve()] = tier or ""
        if tier == "senior":
            senior_skills[skill_md.resolve()] = text

    violations: list[Violation] = []
    graph: dict[Path, set[Path]] = {}

    for skill_path, text in senior_skills.items():
        block = extract_related_block(text)
        if block is None:
            continue
        _, body = block
        when_use, when_not = split_when_subblocks(body)

        # WHEN-to-use links: composition edges (graph) + dangling/tier checks.
        for lineno, slug, link in extract_links(when_use):
            target = resolve_target(skill_path, link)
            graph.setdefault(skill_path, set()).add(target)
            if target not in all_skills:
                violations.append(Violation(skill_path, lineno, "handoff_dangling",
                    f"link to `{slug}` resolves to missing file {link}"))
                continue
            if all_skills[target] != "senior":
                violations.append(Violation(skill_path, lineno, "handoff_tier_mismatch",
                    f"senior skill links to non-senior `{slug}` "
                    f"(tier={all_skills[target] or 'unset'!r})"))

        # WHEN-NOT-to-use links: alternative pointers, NOT composition edges.
        # Dangling + tier-mismatch still apply (a broken alternative is wrong);
        # cycles do not (mutual "use X instead" pointers are intentional).
        for lineno, slug, link in extract_links(when_not):
            target = resolve_target(skill_path, link)
            if target not in all_skills:
                violations.append(Violation(skill_path, lineno, "handoff_dangling",
                    f"link to `{slug}` resolves to missing file {link}"))
                continue
            if all_skills[target] != "senior":
                violations.append(Violation(skill_path, lineno, "handoff_tier_mismatch",
                    f"senior skill links to non-senior `{slug}` "
                    f"(tier={all_skills[target] or 'unset'!r})"))

    for cycle in detect_cycles(graph):
        names = " → ".join(p.parent.name for p in cycle)
        violations.append(Violation(cycle[0], 1, "handoff_cycle",
            f"composition cycle: {names}"))
    return violations


def main(argv: list[str] | None = None) -> int:
    skills_dir = SKILLS_DIR
    if argv:
        skills_dir = Path(argv[0]).resolve()
    violations = lint(skills_dir)
    if not violations:
        if not QUIET:
            print(f"✅  lint_handoffs: no violations under {skills_dir.relative_to(REPO)}")
        return 0
    for v in violations:
        print(v.render(REPO))
    print(f"\n❌  lint_handoffs: {len(violations)} violation(s)", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
