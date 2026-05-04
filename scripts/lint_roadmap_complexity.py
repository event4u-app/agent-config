#!/usr/bin/env python3
"""Phase 5.2 roadmap-complexity linter.

Enforces the measurable subset of
`docs/contracts/roadmap-complexity-standard.md`:

  - every `agents/roadmaps/*.md` declares `complexity: lightweight`
    or `complexity: structural` in frontmatter;
  - lightweight roadmaps have ≤ 600 total lines and ≤ 6 `## Phase N`
    headings, and contain no `## Council Round N` / `### Verdict`
    sections;
  - structural roadmaps have no upper cap, but the tag must be
    declared.

Cap: ≤ 150 LOC, stdlib only. Hooked into `task ci` via
`task lint-roadmap-complexity`.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ROADMAP_GLOB = "agents/roadmaps/*.md"
LIGHTWEIGHT_LINE_CAP = 600
LIGHTWEIGHT_PHASE_CAP = 6

PHASE_PAT = re.compile(r"^## Phase \d+\b", re.MULTILINE)
COUNCIL_PAT = re.compile(r"^## Council Round \d+\b", re.MULTILINE)
VERDICT_PAT = re.compile(r"^### Verdict\b", re.MULTILINE)
COMPLEXITY_PAT = re.compile(
    r"^complexity:\s*(lightweight|structural)\s*$", re.MULTILINE
)


def _frontmatter(text: str) -> str:
    if not text.startswith("---\n"):
        return ""
    end = text.find("\n---\n", 4)
    return text[4:end] if end != -1 else ""


def _read_complexity(fm: str) -> str | None:
    m = COMPLEXITY_PAT.search(fm)
    return m.group(1) if m else None


def _check_lightweight(text: str, line_count: int, problems: list[str]) -> None:
    if line_count > LIGHTWEIGHT_LINE_CAP:
        problems.append(
            f"lightweight cap exceeded: {line_count} lines "
            f"(max {LIGHTWEIGHT_LINE_CAP}); consider tagging structural "
            f"or trimming"
        )
    phases = len(PHASE_PAT.findall(text))
    if phases > LIGHTWEIGHT_PHASE_CAP:
        problems.append(
            f"lightweight phase cap exceeded: {phases} phases "
            f"(max {LIGHTWEIGHT_PHASE_CAP})"
        )
    if COUNCIL_PAT.search(text):
        problems.append(
            "lightweight roadmap contains '## Council Round N' "
            "block — council debates belong in structural roadmaps"
        )
    if VERDICT_PAT.search(text):
        problems.append(
            "lightweight roadmap contains '### Verdict' block — "
            "council verdicts belong in structural roadmaps"
        )


def lint_roadmap(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    line_count = text.count("\n") + (1 if text and not text.endswith("\n") else 0)
    problems: list[str] = []
    fm = _frontmatter(text)
    complexity = _read_complexity(fm) if fm else None
    if complexity is None:
        problems.append(
            "missing 'complexity:' frontmatter "
            "(must declare 'lightweight' or 'structural')"
        )
        return problems
    if complexity == "lightweight":
        _check_lightweight(text, line_count, problems)
    return problems


def main() -> int:
    roadmaps = sorted(REPO_ROOT.glob(ROADMAP_GLOB))
    if not roadmaps:
        print(f"❌  no roadmaps matched {ROADMAP_GLOB}", file=sys.stderr)
        return 1
    failed = 0
    summary: list[tuple[str, str]] = []
    for roadmap in roadmaps:
        rel = roadmap.relative_to(REPO_ROOT)
        problems = lint_roadmap(roadmap)
        text = roadmap.read_text(encoding="utf-8")
        complexity = _read_complexity(_frontmatter(text)) or "untagged"
        summary.append((str(rel), complexity))
        if problems:
            failed += 1
            print(f"❌  {rel}  [{complexity}]", file=sys.stderr)
            for p in problems:
                print(f"    - {p}", file=sys.stderr)
        else:
            print(f"✅  {rel}  [{complexity}]")
    print()
    light = sum(1 for _, c in summary if c == "lightweight")
    structural = sum(1 for _, c in summary if c == "structural")
    untagged = sum(1 for _, c in summary if c == "untagged")
    print(
        f"summary: {light} lightweight · {structural} structural · "
        f"{untagged} untagged · {len(summary)} total"
    )
    if failed:
        print(f"\n❌  {failed} roadmap(s) failed complexity lint", file=sys.stderr)
        return 1
    print(f"\n✅  {len(roadmaps)} roadmap(s) complexity-clean")
    return 0


if __name__ == "__main__":
    sys.exit(main())
