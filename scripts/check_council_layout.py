#!/usr/bin/env python3
"""CI guard for the `ai-council` skill's output-path convention.

Council artefacts (questions, responses, sessions) belong in three
canonical directories under `agents/`:

  - agents/runtime/council/questions/<topic-slug>.md       (paired with roadmap/ADR)
  - agents/runtime/council/responses/<topic-slug>.json     (paired with question)
  - agents/runtime/council/sessions/<UTC-timestamp>.json   (ad-hoc sessions)

The three canonical dirs are gitignored — the linter therefore only
catches **misplacement**, not naming-conventions inside the dirs:

  - Files at agents/ root with a council-* or .council-* prefix
    (e.g. agents/council-foo.md, agents/.council-foo.md).
  - council-* files under any other subdirectory of agents/.

`agents/evidence/audits/` is exempt — historical audit bundles are cohesive,
checked-in narratives (the canonical council dirs are gitignored)
and may legitimately include council-* artefacts as part of the
audit's evidence trail. `agents/runtime/` is exempt too — the
canonical council dirs live at `agents/runtime/council/{questions,
responses,sessions}/` and the whole `runtime/` tree is gitignored.

Failure modes are enforced by `.agent-src.uncondensed/skills/ai-council/SKILL.md`
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
# Canonical council dirs now live under agents/runtime/council/.
# Stored as relative POSIX paths from AGENTS_ROOT.
CANONICAL_DIRS = {
    "runtime/council/questions": ".md",
    "runtime/council/responses": ".json",
    "runtime/council/sessions": ".json",
}
# Top-level subdirectories whose contents are exempt from the layout
# check. `audits/` covers historical audit bundles. `runtime/` is the
# gitignored volatile tree (canonical council dirs live there).
EXEMPT_DIR_PREFIXES = ("audits", "runtime")
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
                f"agents/runtime/council/questions/, agents/runtime/council/responses/, "
                f"or agents/runtime/council/sessions/ per ai-council § Output path "
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
        rel_posix = rel.as_posix()
        if any(rel_posix.startswith(d + "/") for d in CANONICAL_DIRS):
            continue
        if rel.parts[0].startswith(EXEMPT_DIR_PREFIXES):
            continue
        findings.append(
            f"{path}: council artefact in non-canonical directory "
            f"agents/{rel.parts[0]}/ — only "
            f"agents/runtime/council/{{questions,responses,sessions}}/ "
            f"are allowed."
        )

    return findings


def main() -> int:
    findings = find_violations(AGENTS_ROOT)
    if findings:
        print("❌  Council layout violations:\n")
        for f in findings:
            print(f"  - {f}")
        print(
            "\nRule: .agent-src.uncondensed/skills/ai-council/SKILL.md "
            '§ "Output path convention"'
        )
        return 1
    if not QUIET:
        print("✅  Council layout clean.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
