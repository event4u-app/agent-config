#!/usr/bin/env python3
"""CI guard for the `roadmap-progress-sync` rule's trackability Iron Law.

Every non-draft file under `agents/roadmaps/` (excluding `archive/`,
`skipped/`, template/README/open-questions) MUST:

  1. Be parseable by the dashboard's `PHASE_RE` — i.e. contain at least
     one `## Phase <id>` or `### Phase <id>` heading.
  2. Have at least one trackable checkbox (`- [ ]`, `[x]`, `[~]`, `[-]`)
     under every parsed phase.

A roadmap that fails (1) is invisible to `agents/roadmaps-progress.md`
and silently lies to the next reader. A phase that fails (2) shows as
`⬜ empty` and contributes nothing to progress percentages.

Both failure modes are rule violations per
`.augment/rules/roadmap-progress-sync.md` § "Iron Law — every active
roadmap is trackable". This script is the CI backstop so the rule
cannot be quietly broken again.

Exit codes:
  0 — every active roadmap has parseable phases with at least one
      checkbox per phase.
  1 — at least one violation found; details printed to stdout.

Invocation (from project root):
  python3 scripts/check_roadmap_trackable.py
"""

from __future__ import annotations

import sys
from pathlib import Path

# Reuse the dashboard's regexes and helpers — single source of truth so
# the linter cannot drift from what the dashboard actually parses.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / ".augment" / "scripts"))
from update_roadmap_progress import (  # noqa: E402
    CHECKBOX_RE,
    PHASE_RE,
    is_draft,
    is_roadmap_candidate,
    parse_frontmatter,
)

ROADMAP_ROOT = Path("agents/roadmaps")


def find_active_roadmaps(root: Path) -> list[Path]:
    """Return every non-draft roadmap candidate under root."""
    out: list[Path] = []
    for path in sorted(root.rglob("*.md")):
        if not path.is_file() or not is_roadmap_candidate(path):
            continue
        text = path.read_text(encoding="utf-8")
        if is_draft(parse_frontmatter(text)):
            continue
        out.append(path)
    return out


def violations_for(path: Path) -> list[str]:
    """Return human-readable violation strings for a single roadmap."""
    text = path.read_text(encoding="utf-8")
    matches = list(PHASE_RE.finditer(text))
    if not matches:
        return [
            f"{path}: no `## Phase <id>` or `### Phase <id>` heading "
            "matched the dashboard's PHASE_RE — roadmap is invisible "
            "to agents/roadmaps-progress.md. Either rename headings to "
            "the canonical `Phase <id>` form or add `status: draft` to "
            "the frontmatter."
        ]
    out: list[str] = []
    for i, pm in enumerate(matches):
        start = pm.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        if not CHECKBOX_RE.search(text[start:end]):
            phase_id = pm.group(2)
            name = (pm.group(3) or "").strip() or f"Phase {phase_id}"
            out.append(
                f"{path}: Phase {phase_id} ({name[:60]}) has zero "
                "trackable checkboxes — add at least one `- [ ]` (or "
                "`[x]`/`[~]`/`[-]`) item or remove the phase."
            )
    return out


def main() -> int:
    if not ROADMAP_ROOT.is_dir():
        print(f"❌  {ROADMAP_ROOT} not found — run from project root.", file=sys.stderr)
        return 1
    findings: list[str] = []
    for path in find_active_roadmaps(ROADMAP_ROOT):
        findings.extend(violations_for(path))
    if findings:
        print("❌  Trackable-roadmap rule violations:\n")
        for f in findings:
            print(f"  - {f}")
        print(
            "\nRule: .augment/rules/roadmap-progress-sync.md "
            '§ "Iron Law — every active roadmap is trackable"'
        )
        return 1
    count = len(find_active_roadmaps(ROADMAP_ROOT))
    print(f"✅  {count} active roadmap(s) — all parseable, all phases have checkboxes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
