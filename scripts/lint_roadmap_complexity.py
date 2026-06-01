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
    declared;
  - plate / horizon framing is forbidden when
    `roadmap.horizon_weeks` in `.agent-settings.yml` is 0 (default)
    and allowed when it is a positive integer.

Cap: ≤ 150 LOC, stdlib only. Hooked into `task ci` via
`task lint-roadmap-complexity`.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
try:  # invocation-agnostic import (repo-root-on-path vs scripts-on-path)
    from scripts._lib.agent_settings import project_settings_path
except ModuleNotFoundError:  # pragma: no cover
    from _lib.agent_settings import project_settings_path

QUIET = "--quiet" in sys.argv

REPO_ROOT = Path(__file__).resolve().parent.parent
ROADMAP_GLOB = "agents/roadmaps/*.md"
LIGHTWEIGHT_LINE_CAP = 600
LIGHTWEIGHT_PHASE_CAP = 6
SETTINGS_FILE = project_settings_path(REPO_ROOT)
HORIZON_WEEKS_PAT = re.compile(
    r"^\s*horizon_weeks:\s*(\d+)\s*(?:#.*)?$", re.MULTILINE
)

PHASE_PAT = re.compile(r"^## Phase \d+\b", re.MULTILINE)
COUNCIL_PAT = re.compile(r"^## Council Round \d+\b", re.MULTILINE)
VERDICT_PAT = re.compile(r"^### Verdict\b", re.MULTILINE)
COMPLEXITY_PAT = re.compile(
    r"^complexity:\s*(lightweight|structural)\s*$", re.MULTILINE
)

# Plate / horizon detection — template rule 16 forbids time-boxed plates
# in roadmaps. Patterns match the authoring devices we are retiring.
PLATE_PATS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"^##\s+Horizon\b", re.MULTILINE | re.IGNORECASE),
     "'## Horizon' section header"),
    (re.compile(r"\b\d+-week\s+(visible\s+)?plate\b", re.IGNORECASE),
     "'N-week (visible) plate' phrasing"),
    (re.compile(r"\bvisible\s+plate\b", re.IGNORECASE),
     "'visible plate' phrasing"),
    (re.compile(r"\b(in|out)-of-plate\b", re.IGNORECASE),
     "'in-of-plate' / 'out-of-plate' marker"),
    (re.compile(r"\bout-of-horizon\b", re.IGNORECASE),
     "'out-of-horizon' marker"),
    (re.compile(r"\bIn-plate\??\b"),
     "'In-plate' / 'In-plate?' label"),
    (re.compile(r"\bOut-of-plate\b"),
     "'Out-of-plate' label"),
    (re.compile(r"inside\s+(the\s+|\d+-week\s+)?plate", re.IGNORECASE),
     "'inside the plate' phrasing"),
    (re.compile(r"outside\s+(the\s+|\d+-week\s+)?plate", re.IGNORECASE),
     "'outside the plate' phrasing"),
)


def _frontmatter(text: str) -> str:
    if not text.startswith("---\n"):
        return ""
    end = text.find("\n---\n", 4)
    return text[4:end] if end != -1 else ""


def _read_horizon_weeks() -> int:
    """Read roadmap.horizon_weeks from .agent-settings.yml.

    Default 0 (off) when file or key is missing or unparseable.
    Positive integer = horizon framing allowed.
    """
    if not SETTINGS_FILE.is_file():
        return 0
    try:
        text = SETTINGS_FILE.read_text(encoding="utf-8")
    except OSError:
        return 0
    in_roadmap = False
    for raw in text.splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        if raw.startswith("roadmap:"):
            in_roadmap = True
            continue
        if in_roadmap and raw and not raw.startswith((" ", "\t")):
            in_roadmap = False
            continue
        if in_roadmap:
            m = HORIZON_WEEKS_PAT.match(raw)
            if m:
                try:
                    return max(0, int(m.group(1)))
                except ValueError:
                    return 0
    return 0


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


def _check_no_plate(text: str, problems: list[str]) -> None:
    """Detect time-boxed plate / horizon framing.

    Forbidden by template rule 16 when `roadmap.horizon_weeks` is 0
    (default). Allowed when the setting is a positive integer.
    """
    for pat, label in PLATE_PATS:
        m = pat.search(text)
        if m is None:
            continue
        line = text.count("\n", 0, m.start()) + 1
        problems.append(
            f"plate/horizon convention detected ({label}) at line {line} — "
            f"forbidden by templates/roadmaps.md rule 16 when "
            f"`roadmap.horizon_weeks` is 0; set a positive integer in "
            f".agent-settings.yml to opt in"
        )


def lint_roadmap(path: Path, horizon_weeks: int) -> list[str]:
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
    if horizon_weeks <= 0:
        _check_no_plate(text, problems)
    return problems


def main() -> int:
    roadmaps = sorted(REPO_ROOT.glob(ROADMAP_GLOB))
    horizon_weeks = _read_horizon_weeks()
    if not roadmaps:
        if not QUIET:
            print(f"✅  no active roadmaps under {ROADMAP_GLOB} — nothing to lint")
        return 0
    failed = 0
    summary: list[tuple[str, str]] = []
    for roadmap in roadmaps:
        rel = roadmap.relative_to(REPO_ROOT)
        problems = lint_roadmap(roadmap, horizon_weeks)
        text = roadmap.read_text(encoding="utf-8")
        complexity = _read_complexity(_frontmatter(text)) or "untagged"
        summary.append((str(rel), complexity))
        if problems:
            failed += 1
            print(f"❌  {rel}  [{complexity}]", file=sys.stderr)
            for p in problems:
                print(f"    - {p}", file=sys.stderr)
        else:
            if not QUIET:
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
    if not QUIET:
        print(f"\n✅  {len(roadmaps)} roadmap(s) complexity-clean")
    return 0


if __name__ == "__main__":
    sys.exit(main())
