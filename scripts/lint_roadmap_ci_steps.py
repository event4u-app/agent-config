#!/usr/bin/env python3
"""Hard-Gate linter for the ``roadmap-ci-steps-policy`` rule.

Forbids full-pipeline CI literals (``task ci``, ``make test``,
``npm run check`` etc.) inside ``agents/roadmaps/*.md`` checkbox steps
or fenced bash blocks **when** ``quality.local_auto_run`` in
``.agent-settings.yml`` is ``false``.

Carve-outs:
  * Setting is ``true`` → linter no-ops (exit 0).
  * Step line carries ``<!-- carve-out: new-gate-verification -->`` →
    allowed (new gate added by the same roadmap).
  * ``## Acceptance criteria`` section → documentation, not steps.
  * ``agents/roadmaps/archive/`` and ``agents/roadmaps/skipped/`` → out
    of scope; they record history.

Cap: ≤ 150 LOC, stdlib only. Hooked into ``task ci-fast`` via
``task lint-roadmap-ci-steps``.
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
SETTINGS_FILE = project_settings_path(REPO_ROOT)
LOCAL_AUTO_RUN_PAT = re.compile(
    r"^\s*local_auto_run:\s*(true|false)\s*(?:#.*)?$", re.MULTILINE
)
CARVE_OUT_MARKER = "carve-out: new-gate-verification"

# CI-shaped literals — case-insensitive whole-word(-ish) matches.
CI_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\btask\s+ci-strict\b", re.IGNORECASE), "task ci-strict"),
    (re.compile(r"\btask\s+ci-fast\b", re.IGNORECASE), "task ci-fast"),
    (re.compile(r"\btask\s+ci\b(?!-)", re.IGNORECASE), "task ci"),
    (re.compile(r"\bmake\s+ci\b", re.IGNORECASE), "make ci"),
    (re.compile(r"\bmake\s+test\b", re.IGNORECASE), "make test"),
    (re.compile(r"\bnpm\s+run\s+check\b", re.IGNORECASE), "npm run check"),
    (re.compile(r"\bpnpm\s+run\s+check\b", re.IGNORECASE), "pnpm run check"),
    (re.compile(r"\byarn\s+check\b", re.IGNORECASE), "yarn check"),
    (re.compile(r"\bcomposer\s+test\b", re.IGNORECASE), "composer test"),
    # Whole-suite = bare command, or command followed only by prose
    # ("before the boundary"). A real shell argument starts with ``-``
    # (flag) or contains ``/`` or ``.`` (path / .php file) — that
    # signals a targeted run and is allowed.
    (re.compile(r"\bvendor/bin/phpunit\b(?!\s+(?:-|\S*[/.]))", re.IGNORECASE),
     "vendor/bin/phpunit (whole suite)"),
    (re.compile(r"\bphp\s+artisan\s+test\b(?!\s+(?:-|\S*[/.]))", re.IGNORECASE),
     "php artisan test (whole suite)"),
)

CHECKBOX_PAT = re.compile(r"^\s*-\s*\[[ x~/-]\]\s")
FENCE_PAT = re.compile(r"^\s*```")
HEADING_PAT = re.compile(r"^(#{1,6})\s+(.*?)\s*$")
ACCEPTANCE_HEADING_PAT = re.compile(
    r"^acceptance criteria\b", re.IGNORECASE
)


def _read_local_auto_run() -> bool:
    """Return ``quality.local_auto_run`` from ``.agent-settings.yml``.

    Default ``True`` (= no-op) when file or key is missing. The Hard
    Gate only fires when the setting is explicitly ``false``.
    """
    if not SETTINGS_FILE.is_file():
        return True
    try:
        text = SETTINGS_FILE.read_text(encoding="utf-8")
    except OSError:
        return True
    in_quality = False
    for raw in text.splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        if raw.startswith("quality:"):
            in_quality = True
            continue
        if in_quality and raw and not raw.startswith((" ", "\t")):
            in_quality = False
            continue
        if in_quality:
            m = LOCAL_AUTO_RUN_PAT.match(raw)
            if m:
                return m.group(1).lower() == "true"
    return True


def _scan(text: str) -> list[tuple[int, str, str]]:
    """Return ``(line_no, matched_literal, line_text)`` for every hit.

    Only scans:
      * checkbox-step lines (``- [ ] …``)
      * lines inside fenced code blocks (```` ``` ````)
    Skips lines under an ``## Acceptance criteria`` heading.
    Skips lines carrying the carve-out marker.
    """
    hits: list[tuple[int, str, str]] = []
    in_fence = False
    in_acceptance = False
    for idx, line in enumerate(text.splitlines(), start=1):
        if FENCE_PAT.match(line):
            in_fence = not in_fence
            continue
        if not in_fence:
            heading = HEADING_PAT.match(line)
            if heading:
                in_acceptance = bool(
                    ACCEPTANCE_HEADING_PAT.match(heading.group(2))
                )
                continue
        if in_acceptance:
            continue
        is_checkbox = CHECKBOX_PAT.match(line) is not None
        if not (is_checkbox or in_fence):
            continue
        if CARVE_OUT_MARKER in line:
            continue
        for pat, label in CI_PATTERNS:
            if pat.search(line):
                hits.append((idx, label, line.strip()))
                break
    return hits


def main() -> int:
    if _read_local_auto_run():
        if not QUIET:
            print(
                "✅  quality.local_auto_run=true (or unset) — "
                "CI-step gate disabled"
            )
        return 0
    roadmaps = sorted(REPO_ROOT.glob(ROADMAP_GLOB))
    if not roadmaps:
        if not QUIET:
            print(f"✅  no active roadmaps under {ROADMAP_GLOB}")
        return 0
    failed = 0
    for roadmap in roadmaps:
        rel = roadmap.relative_to(REPO_ROOT)
        text = roadmap.read_text(encoding="utf-8")
        hits = _scan(text)
        if hits:
            failed += 1
            print(f"❌  {rel}", file=sys.stderr)
            for line_no, label, line_text in hits:
                print(
                    f"    line {line_no}: '{label}' in: {line_text}",
                    file=sys.stderr,
                )
            print(
                "    → reword as a narrow command "
                "(e.g. 'vendor/bin/phpstan analyse app/Modules/X'), or "
                "mark with '<!-- carve-out: new-gate-verification -->' "
                "when the step verifies a NEW gate introduced by this "
                "roadmap.",
                file=sys.stderr,
            )
        else:
            if not QUIET:
                print(f"✅  {rel}")
    if failed:
        print(
            f"\n❌  {failed} roadmap(s) schedule full-pipeline CI steps "
            f"while quality.local_auto_run=false — "
            f"see .augment/rules/roadmap-ci-steps-policy.md",
            file=sys.stderr,
        )
        return 1
    if not QUIET:
        print(f"\n✅  {len(roadmaps)} roadmap(s) CI-step-clean")
    return 0


if __name__ == "__main__":
    sys.exit(main())
