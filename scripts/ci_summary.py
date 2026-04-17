#!/usr/bin/env python3
"""
CI Summary — generate GitHub Actions job summary from pipeline data.

Reads observability data and produces a concise markdown summary
for GitHub Actions GITHUB_STEP_SUMMARY.

Gated by ci_summary_enabled in .agent-settings.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from persistence import load_metrics, load_feedback, load_tool_audit
from report_generator import generate_health_dashboard


def generate_ci_summary(root: Path, max_lines: int = 30) -> str:
    """Generate a concise CI summary."""
    metrics = load_metrics(root)
    feedback = load_feedback(root)
    tool_audit = load_tool_audit(root)

    lines = ["## 🤖 Agent Infrastructure Summary", ""]

    # Quick stats
    total_skills = len(set(m.get("skill_name") for m in metrics))
    total_events = len(metrics)
    failures = sum(1 for f in feedback if f.get("outcome") in ("failure", "FAILURE"))
    successes = sum(1 for f in feedback if f.get("outcome") in ("success", "SUCCESS"))

    lines.append(f"- Skills executed: **{total_skills}**")
    lines.append(f"- Pipeline events: **{total_events}**")
    if successes + failures > 0:
        rate = successes / (successes + failures) * 100
        lines.append(f"- Success rate: **{rate:.0f}%** ({successes}/{successes + failures})")
    lines.append("")

    # Failures (if any)
    if failures > 0:
        lines.append("### ❌ Failures")
        from collections import Counter
        fail_skills = Counter(
            f.get("skill_name", "unknown")
            for f in feedback
            if f.get("outcome") in ("failure", "FAILURE")
        )
        for skill, count in fail_skills.most_common(5):
            lines.append(f"- `{skill}`: {count} failures")
        lines.append("")

    # Tool errors
    tool_errors = [e for e in tool_audit if e.get("status") in ("error", "failure", "timeout")]
    if tool_errors:
        lines.append("### ⚠️ Tool Adapter Errors")
        for entry in tool_errors[:5]:
            lines.append(f"- `{entry.get('tool', '?')}` → {entry.get('status', '?')}")
        lines.append("")

    if not metrics and not feedback:
        lines.append("*No pipeline data collected in this run.*")

    return "\n".join(lines) + "\n"


def write_github_summary(summary: str) -> bool:
    """Write summary to GITHUB_STEP_SUMMARY if available."""
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a") as f:
            f.write(summary)
        return True
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate CI summary")
    parser.add_argument("--root", default=".", help="Project root")
    parser.add_argument("--max-lines", type=int, default=30)
    args = parser.parse_args()

    root = Path(args.root)
    summary = generate_ci_summary(root, args.max_lines)

    if write_github_summary(summary):
        print("Summary written to GITHUB_STEP_SUMMARY")
    else:
        print(summary)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
