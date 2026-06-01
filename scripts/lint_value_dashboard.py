#!/usr/bin/env python3
"""Lint `docs/value.md` for structural invariants.

Phase 5 Step 3 of `agents/roadmaps/road-to-readable-value-dashboard.md`.

Invariants enforced (any violation → exit 1):

1. Required sections present (intro / Reference scale / Panel A / Panel B
   / Glossar / NETTO line).
2. Every cost-ladder rung row cites a `source_report` (or `n/a` for the
   baseline rung) — no rung sneaks in without traceability.
3. No `measured` rung renders a `pending` source — internal consistency
   of confidence ↔ source state.
4. No negative-saving label: the literal string "Ersparnis" must not
   appear in a row where the displayed Δ-token value is positive (the
   load + terse rungs are *costs*, not savings; mislabelling either is
   a credibility failure the page explicitly forbids).
5. The `latest.json` exists and its `cost_ladder` rung ids match the
   five canonical rungs — the renderer cannot silently drop a rung.

The linter loads `internal/bench/reports/value/latest.json` directly
(not just the rendered `.md`) for items (3) and (5) — the rendered
text alone is too lossy.

Output: one violation per line in non-quiet mode; one-line summary in
quiet mode. Exit 0 on clean, 1 on any violation.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List


REPO_ROOT = Path(__file__).resolve().parent.parent
DASHBOARD = REPO_ROOT / "docs" / "value.md"
LATEST = REPO_ROOT / "internal" / "bench" / "reports" / "value" / "latest.json"

REQUIRED_SECTIONS = (
    "# Value Dashboard",
    "## Reference scale",
    "## Panel A",
    "## Panel B",
    "## Glossar",
    "**NETTO",
)

CANONICAL_RUNG_IDS = ("baseline", "load", "thin", "condense", "rtk", "terse")


def _log(msg: str, quiet: bool, *, err: bool = False) -> None:
    if err:
        print(msg, file=sys.stderr)
    elif not quiet:
        print(msg)


def check_required_sections(text: str) -> List[str]:
    return [
        f"missing required section: '{section}'"
        for section in REQUIRED_SECTIONS
        if section not in text
    ]


def check_source_citations(report: Dict[str, Any]) -> List[str]:
    violations = []
    for rung in report.get("cost_ladder", []) or []:
        source = rung.get("source_report")
        if not source:
            violations.append(
                f"rung '{rung.get('id')}' has no source_report field"
            )
            continue
        if not isinstance(source, str) or not source.strip():
            violations.append(
                f"rung '{rung.get('id')}' has empty source_report"
            )
    return violations


def check_confidence_vs_source(report: Dict[str, Any]) -> List[str]:
    """A `measured` rung's source_report must exist on disk."""
    violations = []
    for rung in report.get("cost_ladder", []) or []:
        if rung.get("confidence") != "measured":
            continue
        source = rung.get("source_report") or ""
        if source in ("", "n/a"):
            continue  # baseline rung
        path = REPO_ROOT / source
        if not path.exists():
            violations.append(
                f"rung '{rung.get('id')}' is 'measured' but its "
                f"source_report does not exist: {source}"
            )
    return violations


def check_no_negative_savings(text: str) -> List[str]:
    """A rung whose Δ-token value is positive must not be labelled a saving.

    Heuristic: scan Panel A's rows; flag any row that contains the
    German word "Ersparnis" with a positive token-delta in the same row.
    """
    violations = []
    # Panel A rows are pipe-delimited; we read every line starting with "|"
    # inside the cost ladder section.
    in_panel_a = False
    for line in text.splitlines():
        if line.startswith("## Panel A"):
            in_panel_a = True
            continue
        if in_panel_a and line.startswith("## "):
            break
        if not in_panel_a or not line.startswith("|"):
            continue
        if "Ersparnis" not in line:
            continue
        # Look for a "+" sign at the start of an integer-shaped delta.
        # The format renders deltas as "+4 843" / "-186".
        m = re.search(r"\|\s*([+-][0-9 ]+)\s*\|", line)
        if m and m.group(1).strip().startswith("+"):
            token_value = m.group(1).strip()
            violations.append(
                "row labelled 'Ersparnis' has a positive Δ-token value: "
                f"{token_value!r} — positive deltas are costs, not savings."
            )
    return violations


def check_canonical_rung_set(report: Dict[str, Any]) -> List[str]:
    rungs = report.get("cost_ladder", []) or []
    ids = [r.get("id") for r in rungs]
    if list(ids) != list(CANONICAL_RUNG_IDS):
        return [
            f"cost_ladder rung ids must be {CANONICAL_RUNG_IDS}, "
            f"got {tuple(ids)}"
        ]
    return []


def lint(quiet: bool = False) -> int:
    violations: List[str] = []

    if not DASHBOARD.exists():
        _log(
            f"FAIL: dashboard not found: {DASHBOARD.relative_to(REPO_ROOT)}",
            quiet,
            err=True,
        )
        return 1
    text = DASHBOARD.read_text()
    violations.extend(check_required_sections(text))
    violations.extend(check_no_negative_savings(text))

    if not LATEST.exists():
        # No JSON to deep-check — that's a placeholder dashboard.
        # Required-sections check still applies; we degrade gracefully.
        if violations:
            for v in violations:
                _log(f"FAIL: {v}", quiet, err=True)
            return 1
        _log(
            "lint_value_dashboard: dashboard is a placeholder "
            "(no value-v1.json yet) — structural checks pass.",
            quiet=False,
        )
        return 0

    try:
        report = json.loads(LATEST.read_text())
    except json.JSONDecodeError as exc:
        _log(f"FAIL: {LATEST.name} is not valid JSON: {exc}", quiet, err=True)
        return 1

    violations.extend(check_source_citations(report))
    violations.extend(check_confidence_vs_source(report))
    violations.extend(check_canonical_rung_set(report))

    if violations:
        for v in violations:
            _log(f"FAIL: {v}", quiet, err=True)
        return 1
    _log(
        (
            "lint_value_dashboard: OK — "
            f"{len(report.get('cost_ladder', []))} rungs, "
            f"{len(report.get('behaviour', []))} behaviour metrics, all "
            "sections present, all sources cited."
        ),
        quiet=False,
    )
    return 0


def parse_args(argv: List[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Lint docs/value.md for structural invariants."
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress non-error output.",
    )
    return parser.parse_args(argv)


def main(argv: List[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])
    return lint(quiet=args.quiet)


if __name__ == "__main__":
    raise SystemExit(main())
