#!/usr/bin/env python3
"""CI guard: council config lives in `.ai-council.yml`, never `.agent-settings.yml`.

Per [ADR-093](docs/decisions/ADR-093-ai-council-config-user-global.md) the
council reads a dedicated `.ai-council.yml` — resolved project-local
(`agents/settings/.ai-council.yml`) first, else user-global
(`~/.event4u/agent-config/settings/.ai-council.yml`). Keys are **top-level**
in that file; the legacy `ai_council.*` block under `.agent-settings.yml` was
removed in Phase 0.

When agent-facing surfaces still tell the model to "read `.agent-settings.yml`
→ `ai_council`", the agent inspects the wrong file, finds nothing, and tells
the user the council "needs `.agent-settings.yml` set up" — even though a
user-global `.ai-council.yml` with `enabled: true` is present and works from
every project. This guard makes that drift fail CI.

What it flags, in the council command/skill surfaces + the config contract:

  1. A `.agent-settings.yml` reference that is NOT negated — i.e. an
     instruction to read/use it for council config. Corrective mentions
     ("NOT in `.agent-settings.yml`", "was removed", "never read") carry a
     negation marker on the same line and are allowed.
  2. A bare `ai_council:` YAML parent-block declaration — post-ADR-093 the
     keys are top-level in `.ai-council.yml`; there is no `ai_council:`
     namespace to nest under.

Escape hatch: a line carrying `<!-- council-config-allowed -->` is exempt
(for a legitimate non-council `.agent-settings.yml` reference, e.g.
`personal.autonomy`).

Exit codes:
  0 — clean.
  1 — at least one violation; details printed to stdout.

Invocation (from project root):
  python3 src/scripts/check_council_config_location.py [--quiet]
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

QUIET = "--quiet" in sys.argv

# Agent-facing surfaces where council config must resolve to `.ai-council.yml`.
# Globs are relative to the repo root; non-existent paths are skipped silently.
SCAN_GLOBS = (
    "src/domains/meta/council/**/*.md",
    "src/domains/product-basic/roadmap/ai-council/**/*.md",
    "src/skills/ai-council/**/*.md",
    "docs/contracts/ai-council-config.md",
)

AGENT_SETTINGS_RE = re.compile(r"\.agent-settings\.yml")
# A negation marker on the same line marks a corrective reference (allowed).
NEGATION_RE = re.compile(
    r"\b(not|never|removed|no\s+longer|neither|instead)\b", re.IGNORECASE
)
# A YAML parent-block declaration: `ai_council:` alone (optionally indented,
# optional trailing comment). Inline-code mentions like `under \`ai_council:\``
# do not match because the line does not START with the key.
AI_COUNCIL_BLOCK_RE = re.compile(r"^\s*ai_council:\s*(#.*)?$")
ALLOW_PRAGMA = "<!-- council-config-allowed -->"


def iter_files(root: Path):
    seen: set[Path] = set()
    for pattern in SCAN_GLOBS:
        for path in sorted(root.glob(pattern)):
            if path.is_file() and path not in seen:
                seen.add(path)
                yield path


def find_violations(root: Path) -> list[str]:
    findings: list[str] = []
    for path in iter_files(root):
        rel = path.relative_to(root)
        in_fence = False
        for lineno, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            stripped = raw.lstrip()
            if stripped.startswith("```") or stripped.startswith("~~~"):
                in_fence = not in_fence
                continue
            if ALLOW_PRAGMA in raw:
                continue
            if AGENT_SETTINGS_RE.search(raw) and not NEGATION_RE.search(raw):
                findings.append(
                    f"{rel}:{lineno}: council config referenced via "
                    f"`.agent-settings.yml` without a negation marker — council "
                    f"config lives in `.ai-council.yml` (ADR-093). Point at the "
                    f"resolved `.ai-council.yml`, or add a negation / "
                    f"`{ALLOW_PRAGMA}` if this is a non-council reference."
                )
            if AI_COUNCIL_BLOCK_RE.match(raw):
                where = "fenced YAML" if in_fence else "prose"
                findings.append(
                    f"{rel}:{lineno}: `ai_council:` parent block ({where}) — "
                    f"post-ADR-093 the keys are top-level in `.ai-council.yml` "
                    f"(no `ai_council:` wrapper)."
                )
    return findings


def main() -> int:
    root = Path.cwd()
    findings = find_violations(root)
    if findings:
        print("❌  Council config-location violations:\n")
        for f in findings:
            print(f"  - {f}")
        print(
            "\nRule: council config lives in `.ai-council.yml` "
            "(docs/contracts/ai-council-config.md + ADR-093), never in "
            "`.agent-settings.yml`."
        )
        return 1
    if not QUIET:
        print("✅  Council config-location clean.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
