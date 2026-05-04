#!/usr/bin/env python3
"""Phase 3.4 demo-shape linter — wrong / right / why per demo.

Cap: ≤ 100 LOC, stdlib only. Hooked into `task ci` via
`Taskfile.yml` ▸ `check-examples-shape`. Validates every
`docs/guidelines/agent-infra/*-demos.md`: frontmatter keys
(`demo_for:`, `layer: pattern-memory`, `prose_delta:` with before /
after char counts), and each `## Demo N` section having Wrong /
Right shape headings, a `**Failure mode:**` line, and a Why-it-works
explanation (heading or inline).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEMO_GLOB = "docs/guidelines/agent-infra/*-demos.md"
REQUIRED_FM_KEYS = ("demo_for:", "layer: pattern-memory", "prose_delta:")
REQUIRED_FM_DELTA = ("rule_chars_before:", "rule_chars_after:")


def _frontmatter(text: str) -> str:
    if not text.startswith("---\n"):
        return ""
    end = text.find("\n---\n", 4)
    return text[4:end] if end != -1 else ""


def _check_frontmatter(fm: str, problems: list[str]) -> None:
    for key in (*REQUIRED_FM_KEYS, *REQUIRED_FM_DELTA):
        if key not in fm:
            problems.append(f"frontmatter missing: {key!r}")


def _check_demo_sections(text: str, problems: list[str]) -> None:
    demo_pat = re.compile(r"^## Demo \d+\b.*$", re.MULTILINE)
    demo_starts = [m.start() for m in demo_pat.finditer(text)]
    if not demo_starts:
        problems.append("no '## Demo N — …' sections found")
        return
    bounds = demo_starts + [len(text)]
    for i, start in enumerate(demo_starts):
        section = text[start:bounds[i + 1]]
        title = section.splitlines()[0]
        if "### Wrong shape" not in section:
            problems.append(f"{title!r}: missing '### Wrong shape'")
        if "### Right shape" not in section:
            problems.append(f"{title!r}: missing '### Right shape'")
        if "**Failure mode:**" not in section:
            problems.append(f"{title!r}: missing '**Failure mode:**' line")
        has_why_section = "### Why it works" in section
        has_why_inline = "**Why it works:**" in section
        if not (has_why_section or has_why_inline):
            problems.append(
                f"{title!r}: missing 'Why it works' explanation "
                "(### Why it works or **Why it works:** inline)"
            )


def lint_demo(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    problems: list[str] = []
    fm = _frontmatter(text)
    if not fm:
        problems.append("missing YAML frontmatter (--- block at top)")
    else:
        _check_frontmatter(fm, problems)
    _check_demo_sections(text, problems)
    return problems


def main() -> int:
    demos = sorted(REPO_ROOT.glob(DEMO_GLOB))
    if not demos:
        print(f"❌  no demo files matched {DEMO_GLOB}", file=sys.stderr)
        return 1
    failed = 0
    for demo in demos:
        rel = demo.relative_to(REPO_ROOT)
        problems = lint_demo(demo)
        if problems:
            failed += 1
            print(f"❌  {rel}", file=sys.stderr)
            for p in problems:
                print(f"    - {p}", file=sys.stderr)
        else:
            print(f"✅  {rel}")
    if failed:
        print(f"\n❌  {failed} demo file(s) failed shape lint", file=sys.stderr)
        return 1
    print(f"\n✅  {len(demos)} demo file(s) shape-clean")
    return 0


if __name__ == "__main__":
    sys.exit(main())
