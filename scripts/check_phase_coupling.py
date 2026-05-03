#!/usr/bin/env python3
"""Phase 6 → Phase 2B coupling guard (Phase 0.3.3).

Re-runs the audit recorded in `agents/roadmaps/phase6-2b-coupling.md`
on every CI run. Fails the build if any of the 13 Phase-2B target
rules introduces a reference to one of the three Phase-6-owned rules
(`chat-history-cadence`, `chat-history-ownership`,
`chat-history-visibility`) — by rule name, `load_context:` entry, or
body link / cite.

Excluded from the coupling probe (separate infrastructure, not
reshaped by Phase 6):

- The CLI dispatcher subcommand `./agent-config chat-history:hook`
  and any other `chat-history:*` colon-suffix command surface.

Exit codes: 0 = decoupling intact, 1 = coupling detected,
3 = internal error (target rule missing, unreadable file).
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_RULES = REPO_ROOT / ".agent-src.uncompressed" / "rules"
COMP_RULES = REPO_ROOT / ".agent-src" / "rules"

# Phase 2B priority list — see road-to-structural-optimization.md § Phase 2 → 2B.
TARGET_RULES: tuple[str, ...] = (
    "roadmap-progress-sync",
    "user-interaction",
    "augment-source-of-truth",
    "command-suggestion-policy",
    "artifact-engagement-recording",
    "review-routing-awareness",
    "autonomous-execution",
    "docs-sync",
    "cli-output-handling",
    "augment-portability",
    "ui-audit-gate",
    "skill-quality",
    "package-ci-checks",
)

# Phase 6 owns these three rule names. Match must be a *rule reference*,
# not a *dispatcher reference* (chat-history:hook etc).
PHASE6_RULES: tuple[str, ...] = (
    "chat-history-cadence",
    "chat-history-ownership",
    "chat-history-visibility",
)

# Rule-reference pattern: rule name not immediately followed by `:` (which
# would mark it as a CLI subcommand like `chat-history:hook`). Allows
# trailing word-boundary characters typical of Markdown / YAML contexts.
_RULE_REF_RE = re.compile(
    r"\bchat-history-(?:cadence|ownership|visibility)\b(?!:)"
)


def _scan(file: Path) -> list[tuple[int, str]]:
    """Return [(line_no, line)] of rule-reference matches in `file`."""
    if not file.is_file():
        return []
    hits: list[tuple[int, str]] = []
    for i, line in enumerate(file.read_text(encoding="utf-8").splitlines(), 1):
        if _RULE_REF_RE.search(line):
            hits.append((i, line.strip()))
    return hits


def _check_surface(label: str, base: Path) -> tuple[int, list[str]]:
    """Scan `base` for all 13 Phase-2B targets; return (#hits, formatted lines)."""
    if not base.is_dir():
        return 0, [f"❌  {label} dir missing: {base}"]
    out: list[str] = []
    total = 0
    for rule in TARGET_RULES:
        path = base / f"{rule}.md"
        if not path.is_file():
            return 0, [f"❌  target rule missing: {path}"]
        hits = _scan(path)
        if not hits:
            continue
        total += len(hits)
        for line_no, line in hits:
            out.append(f"  {label}/{rule}.md:{line_no}  {line}")
    return total, out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="suppress the per-rule breakdown when no coupling found",
    )
    args = parser.parse_args()

    hits_src, lines_src = _check_surface("uncompressed", SRC_RULES)
    if any(line.startswith("❌") for line in lines_src):
        for line in lines_src:
            print(line, file=sys.stderr)
        return 3
    hits_comp, lines_comp = _check_surface("compressed", COMP_RULES)
    if any(line.startswith("❌") for line in lines_comp):
        for line in lines_comp:
            print(line, file=sys.stderr)
        return 3

    total = hits_src + hits_comp

    if total == 0:
        if not args.quiet:
            print(
                f"✅  Phase 6 → 2B decoupling intact: 0 rule-references "
                f"across {len(TARGET_RULES)} Phase-2B targets "
                f"(uncompressed + compressed surfaces)."
            )
            print(
                "      probe: rule names, load_context: entries, body "
                "link/cite — dispatcher subcommand chat-history:hook "
                "excluded by design."
            )
        return 0

    print(
        f"❌  Phase 6 → 2B coupling detected: {total} rule-reference(s) "
        f"across Phase-2B targets:"
    )
    for line in lines_src + lines_comp:
        print(line)
    print(
        "\n      Action: see agents/roadmaps/phase6-2b-coupling.md. "
        "Either drop the new reference, migrate it to the dispatcher "
        "(chat-history:hook), or trigger the >0-hits branch in 0.3.2 "
        "(Phase 6 ships call-signature contract before Phase 2B "
        "touches the coupled rule)."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
