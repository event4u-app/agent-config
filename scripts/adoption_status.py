#!/usr/bin/env python3
"""One-screen adoption dashboard for the maintainer's weekly review.

Phase C Step 6 of ``road-to-adoption-proof-and-ci-green.md``. Prints
three things in one short block:

  1. Registry-submission status — counts per status from
     ``docs/distribution/registry-submissions.md``.
  2. Recruit-session report count — files matching
     ``agents/recruit-sessions/[0-9]*.md`` (excludes template / runbook /
     findings).
  3. Latest required-check colour on ``main`` — shells out to
     ``scripts/ci_status.py`` (zero-cost; per-shape required set).

CLI:

  scripts/adoption_status.py [--json] [--branch main]

Exit codes:

  0 — printed successfully (status itself does not gate the exit).
  1 — IO error reading the registry-submissions sheet.

Anchored to:

- ``docs/distribution/registry-submissions.md`` § Tracking rows.
- ``agents/recruit-sessions/_runbook.md`` § Post-session.
- ``docs/contracts/ci-green-floor.md`` § Blocking set.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Iterable


REPO_ROOT = Path(__file__).resolve().parent.parent
REGISTRY_DOC = REPO_ROOT / "docs" / "distribution" / "registry-submissions.md"
RECRUIT_DIR = REPO_ROOT / "agents" / "recruit-sessions"

STATUS_VALUES = ("pending", "submitted", "accepted", "rejected", "stalled")


def parse_registry_statuses(text: str) -> dict[str, int]:
    """Parse the `Tracking rows` table; return counts per status value."""
    counts = {s: 0 for s in STATUS_VALUES}
    in_table = False
    for line in text.splitlines():
        if line.startswith("## Tracking rows"):
            in_table = True
            continue
        if in_table and line.startswith("## "):
            break
        if not in_table:
            continue
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.split("|")[1:-1]]
        if len(cells) < 4:
            continue
        # Header / separator rows have the literal "Registry" or "---" in cell 1.
        if cells[0] in ("#", "---") or cells[1] in ("Registry", "---"):
            continue
        status_cell = cells[3].strip("`")
        if status_cell in counts:
            counts[status_cell] += 1
    return counts


def count_recruit_reports(reports_dir: Path) -> int:
    """Count files matching `<NN>-<role>.md` under recruit-sessions/."""
    if not reports_dir.exists():
        return 0
    pattern = re.compile(r"^\d{2}-[a-z][a-z0-9-]*\.md$")
    return sum(1 for p in reports_dir.iterdir() if p.is_file() and pattern.match(p.name))


def ci_status_color(branch: str) -> tuple[str, str]:
    """Shell out to `scripts/ci_status.py --json` to find the required-set color."""
    script = REPO_ROOT / "scripts" / "ci_status.py"
    if not script.exists():
        return ("unknown", "ci_status.py not present — Phase A Step 6 not landed")
    if shutil.which("gh") is None:
        return ("unknown", "gh CLI not on PATH — cannot probe required-check set")
    try:
        proc = subprocess.run(
            ["python3", str(script), "--branch", branch, "--json", "--no-phantom-resolve"],
            capture_output=True,
            text=True,
            timeout=15,
        )
    except subprocess.TimeoutExpired:
        return ("unknown", f"ci_status.py timed out probing branch {branch}")
    if proc.returncode not in (0, 1):
        return ("unknown", f"ci_status.py exit={proc.returncode}: {proc.stderr.strip()[:80]}")
    try:
        data = json.loads(proc.stdout or "{}")
    except json.JSONDecodeError:
        return ("unknown", "ci_status.py output not parseable as JSON")
    if data.get("red"):
        return ("red", f"{len(data['red'])} required check(s) red")
    if data.get("missing"):
        return ("amber", f"{len(data['missing'])} check(s) missing on {branch}")
    return ("green", f"{len(data.get('green', []))} required check(s) green")


def render_text(registry_counts: dict[str, int], reports: int, ci: tuple[str, str], branch: str) -> str:
    color_emoji = {"green": "🟢", "amber": "🟡", "red": "🔴", "unknown": "⚪"}
    lines = []
    lines.append("Adoption status (one-screen)")
    lines.append("============================")
    lines.append("")
    lines.append("Registry submissions:")
    for status in STATUS_VALUES:
        lines.append(f"  {status:10} {registry_counts[status]}")
    lines.append("")
    lines.append(f"Recruit-session reports filed: {reports}")
    lines.append("")
    lines.append(f"Required-check status on {branch}: {color_emoji[ci[0]]} {ci[0]} — {ci[1]}")
    return "\n".join(lines)


def render_json(registry_counts: dict[str, int], reports: int, ci: tuple[str, str], branch: str) -> str:
    return json.dumps(
        {
            "registries": registry_counts,
            "recruit_reports": reports,
            "ci": {"branch": branch, "color": ci[0], "summary": ci[1]},
        },
        indent=2,
    )


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(prog="adoption_status")
    p.add_argument("--json", action="store_true", help="Emit JSON instead of text.")
    p.add_argument("--branch", default="main", help="Branch to probe for CI color (default: main).")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    try:
        registry_text = REGISTRY_DOC.read_text(encoding="utf-8")
    except OSError as exc:
        print(f"error: failed to read {REGISTRY_DOC}: {exc}", file=sys.stderr)
        return 1
    registry_counts = parse_registry_statuses(registry_text)
    reports = count_recruit_reports(RECRUIT_DIR)
    ci = ci_status_color(args.branch)

    if args.json:
        print(render_json(registry_counts, reports, ci, args.branch))
    else:
        print(render_text(registry_counts, reports, ci, args.branch))
    return 0


if __name__ == "__main__":
    sys.exit(main())
