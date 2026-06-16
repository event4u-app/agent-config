#!/usr/bin/env python3
"""CI guard for the `later/` roadmap disposition.

A roadmap with open work that **cannot proceed now** (blocked on an external
trigger or a decision) but **will resume** belongs in
`agents/roadmaps/later/` — distinct from `archive/` (work done, none planned)
and `skipped/` (decided against). This guard makes that disposition a
first-class, enforced contract instead of an informal convention:

  A. A roadmap whose frontmatter declares ``status: later`` MUST live under
     ``agents/roadmaps/later/`` (and nowhere else). A ``status: later`` file
     sitting in the active tree silently counts as backlog the dashboard and
     ``/roadmap:process-*`` would try to execute.

  B. Every roadmap under ``agents/roadmaps/later/`` MUST record a **resume
     condition** so it never rots without a "when does it come back": either
     ``status: later`` frontmatter, or a body line matching
     ``Blocked until`` / ``Resume when`` / ``Trigger`` (case-insensitive).

Rationale: "roadmaps with open tasks deferred for later are always moved to
``later/``" (user directive 2026-06-16). The active tree holds only roadmaps
that are actually workable now; everything blocked-for-later is parked in
``later/`` with its resume condition, ready to be picked back up.

Exit codes: 0 = clean, 1 = violations found, 2 = internal error.

Usage:
    python3 scripts/lint_roadmap_later_disposition.py
    python3 scripts/lint_roadmap_later_disposition.py --json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
ROADMAP_ROOT = REPO_ROOT / "agents" / "roadmaps"
LATER_DIR = ROADMAP_ROOT / "later"

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)
STATUS_RE = re.compile(r"^status:\s*([A-Za-z0-9_-]+)\s*$", re.MULTILINE)
# A resume condition: the "when does this come back" signal a parked roadmap
# must carry. Matched case-insensitively anywhere in the body.
RESUME_RE = re.compile(r"\b(blocked until|resume when|trigger|blocked-until|resume-when)\b", re.IGNORECASE)

# Non-roadmap files that live in the tree but are not roadmaps.
EXCLUDE_NAMES = {"template.md", "README.md", "progress.md", "roadmaps-progress.md"}
EXCLUDE_PREFIXES = ("open-questions",)


@dataclass
class Violation:
    file: str
    reason: str


def _is_roadmap(path: Path) -> bool:
    if path.name in EXCLUDE_NAMES:
        return False
    return not any(path.name.startswith(p) for p in EXCLUDE_PREFIXES)


def _frontmatter(text: str) -> str:
    m = FRONTMATTER_RE.match(text)
    return m.group(1) if m else ""


def _status(text: str) -> str | None:
    m = STATUS_RE.search(_frontmatter(text))
    return m.group(1).lower() if m else None


def check(root: Path) -> list[Violation]:
    out: list[Violation] = []
    if not root.is_dir():
        return out
    for path in sorted(root.rglob("*.md")):
        if not path.is_file() or not _is_roadmap(path):
            continue
        rel = str(path.relative_to(REPO_ROOT))
        text = path.read_text(encoding="utf-8", errors="ignore")
        status = _status(text)
        in_later = LATER_DIR in path.parents

        # Rule A — status: later must live under later/.
        if status == "later" and not in_later:
            out.append(Violation(
                file=rel,
                reason="frontmatter `status: later` but file is not under "
                       "`agents/roadmaps/later/` — a blocked-for-later roadmap "
                       "must be parked in `later/` (move it there), not left in "
                       "the active backlog.",
            ))

        # Rule B — every later/ roadmap records a resume condition.
        if in_later:
            body = text[len(_frontmatter(text)):]
            if status != "later" and not RESUME_RE.search(body):
                out.append(Violation(
                    file=rel,
                    reason="roadmap under `agents/roadmaps/later/` has no resume "
                           "condition — add `status: later` to the frontmatter or a "
                           "`Blocked until` / `Resume when` / `Trigger` line so it "
                           "records when the work comes back.",
                ))
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)

    violations = check(ROADMAP_ROOT)

    if args.json:
        print(json.dumps([asdict(v) for v in violations], indent=2))
    elif violations:
        print("❌  later/ disposition violations:")
        for v in violations:
            print(f"   • {v.file}\n       {v.reason}")
    else:
        print("✅  later/ disposition: every blocked-for-later roadmap is parked "
              "correctly with a resume condition.")

    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main())
