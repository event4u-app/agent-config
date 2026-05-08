#!/usr/bin/env python3
"""CI guard for the `ai-council` skill's output-path convention.

Council artefacts (questions, responses, sessions) belong in three
canonical directories under `agents/`:

  - agents/council-questions/<topic-slug>.md       (paired with roadmap/ADR)
  - agents/council-responses/<topic-slug>.json     (paired with question)
  - agents/council-sessions/<UTC-timestamp>.json   (ad-hoc sessions)

The three canonical dirs are gitignored — the linter therefore only
catches **misplacement**, not naming-conventions inside the dirs:

  - Files at agents/ root with a council-* or .council-* prefix
    (e.g. agents/council-question-foo.md, agents/.council-foo.md).
  - council-* files under any other subdirectory of agents/.

Failure modes are enforced by `.agent-src.uncompressed/skills/ai-council/SKILL.md`
§ "Output path convention".

Exit codes:
  0 — layout is clean.
  1 — at least one violation found; details printed to stdout.

Invocation (from project root):
  python3 scripts/check_council_layout.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

QUIET = "--quiet" in sys.argv

AGENTS_ROOT = Path("agents")
CANONICAL_DIRS = {
    "council-questions": ".md",
    "council-responses": ".json",
    "council-sessions": ".json",
}
# A council artefact is a file whose name starts with `council-` or
# `.council-`. This intentionally excludes roadmaps like
# `road-to-ai-council.md` whose stem only contains the word "council".
COUNCIL_PREFIX_RE = re.compile(r"^\.?council-")


def is_council_artefact(path: Path) -> bool:
    return bool(COUNCIL_PREFIX_RE.match(path.name))


def find_violations(root: Path) -> list[str]:
    findings: list[str] = []
    if not root.is_dir():
        return findings

    # 1. Stray council artefacts at agents/ root
    for path in sorted(root.iterdir()):
        if not path.is_file():
            continue
        if is_council_artefact(path):
            findings.append(
                f"{path}: council artefact at agents/ root — move to "
                f"agents/council-questions/, agents/council-responses/, "
                f"or agents/council-sessions/ per ai-council § Output path "
                f"convention."
            )

    # 2. Council artefacts in non-canonical subdirectories
    for path in sorted(root.rglob("*")):
        if not path.is_file() or not is_council_artefact(path):
            continue
        try:
            rel = path.relative_to(root)
        except ValueError:
            continue
        if len(rel.parts) == 1:
            continue  # already handled above
        if rel.parts[0] in CANONICAL_DIRS:
            continue
        findings.append(
            f"{path}: council artefact in non-canonical directory "
            f"agents/{rel.parts[0]}/ — only council-questions/, "
            f"council-responses/, council-sessions/ are allowed."
        )

    return findings


def main() -> int:
    findings = find_violations(AGENTS_ROOT)
    if findings:
        print("❌  Council layout violations:\n")
        for f in findings:
            print(f"  - {f}")
        print(
            "\nRule: .agent-src.uncompressed/skills/ai-council/SKILL.md "
            '§ "Output path convention"'
        )
        return 1
    if not QUIET:
        print("✅  Council layout clean.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
