#!/usr/bin/env python3
"""Auto-detection contract linter for command orchestrators (6.1.0 Step 1).

Every command source under ``src/domains/**/command.md`` that opts into
auto-detection (front-matter ``auto_detect: true``) MUST honor the
non-interactive contract by carrying both:

  1. a body link to ``contexts/execution/non-interactive-contract.md`` —
     the single source of truth for TTY/CI detection, confidence tiers,
     ``--yes``/``--json`` semantics, abort schemas, and the kill-switch;
  2. a ``## Non-interactive & auto-detection`` section that holds the
     orchestrator's confidence-tiered detection table.

This is the CI test that 6.1.0 Acceptance Criterion 1 ("every merged
command works non-interactively (CI-safe); proven by a CI test") rests
on: an orchestrator cannot claim auto-detection without wiring the
contract that makes it CI-safe.

Symmetry guard: ``auto_detect`` is only meaningful on an orchestrator
(``type: orchestrator``). A non-orchestrator carrying ``auto_detect`` is
a mistake and fails too.

Exit codes: 0 = clean, 1 = violations found, 3 = internal error.

Usage:
    python3 scripts/lint_orchestrator_auto_detect.py
    python3 scripts/lint_orchestrator_auto_detect.py --quiet
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DOMAINS = ROOT / "src" / "domains"

CONTRACT_LINK = "contexts/execution/non-interactive-contract.md"
SECTION_HEADING = "## Non-interactive & auto-detection"

_AUTO_DETECT_RE = re.compile(r"^auto_detect:\s*(true|false)\s*$", re.MULTILINE)
_TYPE_RE = re.compile(r"^type:\s*orchestrator\s*$", re.MULTILINE)


@dataclass
class Violation:
    file: str
    reason: str


def _split_frontmatter(text: str) -> tuple[str, str]:
    """Return (frontmatter, body); frontmatter is '' when absent."""
    if not text.startswith("---\n"):
        return "", text
    end = text.find("\n---\n", 4)
    if end == -1:
        return "", text
    return text[4:end], text[end + len("\n---\n"):]


def check() -> list[Violation]:
    violations: list[Violation] = []
    if not DOMAINS.is_dir():
        return violations
    for path in sorted(DOMAINS.rglob("command.md")):
        text = path.read_text(encoding="utf-8")
        fm, body = _split_frontmatter(text)
        m = _AUTO_DETECT_RE.search(fm)
        if not m:
            continue  # opted out of the contract — nothing to enforce
        rel = path.relative_to(ROOT).as_posix()
        is_orchestrator = bool(_TYPE_RE.search(fm))
        if m.group(1) == "false":
            # Explicit kill-switch — allowed, but still must be an orchestrator.
            if not is_orchestrator:
                violations.append(Violation(rel, "auto_detect set on a non-orchestrator command (type: orchestrator required)"))
            continue
        # auto_detect: true → full contract required.
        if not is_orchestrator:
            violations.append(Violation(rel, "auto_detect: true on a non-orchestrator command (type: orchestrator required)"))
        if CONTRACT_LINK not in body:
            violations.append(Violation(rel, f"auto_detect: true but missing a body link to {CONTRACT_LINK}"))
        if SECTION_HEADING not in body:
            violations.append(Violation(rel, f"auto_detect: true but missing the '{SECTION_HEADING}' section"))
    return violations


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quiet", action="store_true", help="Suppress the success line.")
    args = parser.parse_args()
    try:
        violations = check()
    except Exception as exc:  # pragma: no cover — defensive
        print(f"❌  lint-orchestrator-auto-detect: internal error: {exc}", file=sys.stderr)
        return 3
    if violations:
        print("❌  Orchestrator auto-detection contract violations:", file=sys.stderr)
        for v in violations:
            print(f"  • {v.file}\n      {v.reason}", file=sys.stderr)
        return 1
    if not args.quiet:
        print("✅  Every auto_detect orchestrator honors the non-interactive contract.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
