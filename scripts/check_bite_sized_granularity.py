#!/usr/bin/env python3
"""Bite-sized task granularity gate for structural roadmaps (P1.5).

Adopted from `obra/superpowers` `writing-plans/SKILL.md` § Task Structure +
§ No Placeholders (v5.1.0). Complexity-gating is our addition (Council
Round 1, Q4) — only roadmaps tagged `complexity: structural` in frontmatter
are subject to the granularity rules; `complexity: lightweight` skips.

Public API (stdlib-only):

    read_complexity(text)            -> 'structural' | 'lightweight' | None
    scan_placeholders(text)          -> list[Placeholder]
    check_granularity(text)          -> Result(complexity, gated, violations)

`gated` is True only when `complexity == 'structural'`. Violations are
empty when the gate is not active, regardless of placeholder presence.

The CI contract for P1.5 is the pytest harness in
`tests/test_bite_sized_granularity.py`; this module is the test surface.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

PLACEHOLDER_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("angle-placeholder", re.compile(r"<[a-z][a-z0-9 _\-/]*>", re.IGNORECASE)),
    ("todo", re.compile(r"\bTODO\b")),
    ("fixme", re.compile(r"\bFIXME\b")),
    ("xxx", re.compile(r"\bXXX\b")),
    ("tbd", re.compile(r"\btbd\b", re.IGNORECASE)),
    ("triple-question", re.compile(r"\?\?\?")),
)

COMPLEXITY_PAT = re.compile(
    r"^complexity:\s*(lightweight|structural)\s*$", re.MULTILINE
)


@dataclass(frozen=True)
class Placeholder:
    kind: str
    line: int
    text: str


@dataclass
class Result:
    complexity: str | None
    gated: bool
    violations: list[Placeholder] = field(default_factory=list)


def _frontmatter(text: str) -> str:
    if not text.startswith("---\n"):
        return ""
    end = text.find("\n---\n", 4)
    return text[4:end] if end != -1 else ""


def read_complexity(text: str) -> str | None:
    """Return the `complexity:` value from the roadmap frontmatter, or None."""
    fm = _frontmatter(text)
    if not fm:
        return None
    m = COMPLEXITY_PAT.search(fm)
    return m.group(1) if m else None


def scan_placeholders(text: str) -> list[Placeholder]:
    """Return every placeholder hit in task-bullet lines (`- [ ]` / `- [x]`)."""
    hits: list[Placeholder] = []
    for line_no, line in enumerate(text.splitlines(), start=1):
        stripped = line.lstrip()
        if not stripped.startswith(("- [ ]", "- [x]", "- [/]", "- [-]")):
            continue
        for kind, pat in PLACEHOLDER_PATTERNS:
            if pat.search(line):
                hits.append(Placeholder(kind=kind, line=line_no, text=line.rstrip()))
                break
    return hits


def check_granularity(text: str) -> Result:
    """Run the granularity gate.

    Structural roadmaps fail on any placeholder hit in task bullets.
    Lightweight or untagged roadmaps skip the gate (gated=False) and
    return an empty violation list even when placeholders are present.
    """
    complexity = read_complexity(text)
    gated = complexity == "structural"
    if not gated:
        return Result(complexity=complexity, gated=False, violations=[])
    return Result(
        complexity=complexity,
        gated=True,
        violations=scan_placeholders(text),
    )
