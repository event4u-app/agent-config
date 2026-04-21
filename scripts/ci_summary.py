#!/usr/bin/env python3
"""
CI Summary — render a GitHub Step Summary from dispatcher run results.

Consumes JSON files produced by `scripts/runtime_dispatcher.py run
--output FILE`. Each file is an ExecutionResult dump (see runtime_handler).

Usage:
    python3 scripts/ci_summary.py --runs agents/reports/runs [--title TITLE]

Writes to $GITHUB_STEP_SUMMARY if the environment variable is set,
otherwise prints the markdown to stdout. Missing or empty run
directories render a short "no runs" note and exit 0.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import List, Dict


def load_runs(runs_dir: Path) -> List[Dict]:
    """Load every *.json in runs_dir as an ExecutionResult dict. Sorted by filename."""
    if not runs_dir.is_dir():
        return []
    runs: List[Dict] = []
    for path in sorted(runs_dir.glob("*.json")):
        try:
            runs.append(json.loads(path.read_text(encoding="utf-8")))
        except (OSError, json.JSONDecodeError):
            # Skip unreadable/malformed files — CI still reports the rest.
            continue
    return runs


_STATUS_ICON = {
    "success": "✅",
    "failure": "❌",
    "timeout": "⏱️",
    "error": "⚠️",
}


def render_summary(runs: List[Dict], title: str) -> str:
    """Render a markdown summary for the given runs."""
    lines: List[str] = [f"## {title}", ""]

    if not runs:
        lines.append("*No dispatcher runs recorded in this job.*")
        lines.append("")
        return "\n".join(lines)

    total = len(runs)
    passed = sum(1 for r in runs if r.get("status") == "success")
    failed = total - passed

    lines.append(f"- Runs: **{total}**  ·  Passed: **{passed}**  ·  Failed: **{failed}**")
    lines.append("")
    lines.append("| Skill | Status | Exit | Duration |")
    lines.append("|---|---|---:|---:|")
    for r in runs:
        status = str(r.get("status", "?"))
        icon = _STATUS_ICON.get(status, "•")
        duration_ms = r.get("duration_ms", 0) or 0
        lines.append(
            f"| `{r.get('skill_name', '?')}` "
            f"| {icon} {status} "
            f"| {r.get('exit_code', '?')} "
            f"| {duration_ms} ms |"
        )

    failures = [r for r in runs if r.get("status") != "success"]
    if failures:
        lines.append("")
        lines.append("### Failure details")
        for r in failures:
            name = r.get("skill_name", "?")
            lines.append(f"<details><summary><code>{name}</code></summary>")
            err = r.get("error")
            if err:
                lines.append("")
                lines.append(f"**Error:** {err}")
            stderr = (r.get("stderr") or "").rstrip()
            if stderr:
                lines.append("")
                lines.append("```")
                lines.append(stderr[-1500:])
                lines.append("```")
            lines.append("</details>")

    lines.append("")
    return "\n".join(lines)


def write_output(summary: str) -> bool:
    """Append to $GITHUB_STEP_SUMMARY if set; return True when the env path was used."""
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return False
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(summary)
        if not summary.endswith("\n"):
            fh.write("\n")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Render CI summary from dispatcher runs")
    parser.add_argument(
        "--runs", type=Path, default=Path("agents/reports/runs"),
        help="Directory containing ExecutionResult JSON files",
    )
    parser.add_argument(
        "--title", default="🤖 Dispatcher runs",
        help="Section title for the summary",
    )
    args = parser.parse_args()

    runs = load_runs(args.runs)
    summary = render_summary(runs, args.title)

    if not write_output(summary):
        print(summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
