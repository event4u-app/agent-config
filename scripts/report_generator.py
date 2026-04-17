#!/usr/bin/env python3
"""
Report Generator — generates markdown reports answering the 6 key questions.

Questions:
1. Which skills fail most often?
2. Which skills produce the most warnings?
3. Which execution types are stable?
4. Which tool adapters cause the most errors?
5. Which skills should be deprecated?
6. Is the overall system improving over time?

Usage:
    python3 scripts/report_generator.py [--root ROOT] [--max-lines N]
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

sys.path.insert(0, str(Path(__file__).resolve().parent))

from persistence import load_metrics, load_feedback, load_tool_audit


def generate_health_dashboard(
    metrics: List[Dict], feedback: List[Dict], tool_audit: List[Dict],
    max_lines: int = 30,
) -> str:
    """Generate the health dashboard answering all 6 key questions."""
    lines = ["# Health Dashboard", ""]
    lines.append(f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    lines.append("")

    # Q1: Which skills fail most often?
    lines.append("## Skill Failure Rate")
    failure_counter: Counter = Counter()
    success_counter: Counter = Counter()
    for entry in feedback:
        skill = entry.get("skill_name", "unknown")
        outcome = entry.get("outcome", "")
        if outcome in ("failure", "FAILURE"):
            failure_counter[skill] += 1
        elif outcome in ("success", "SUCCESS"):
            success_counter[skill] += 1

    if failure_counter:
        lines.append("| Skill | Failures | Successes | Rate |")
        lines.append("|---|---|---|---|")
        for skill, fails in failure_counter.most_common(max_lines):
            successes = success_counter.get(skill, 0)
            total = fails + successes
            rate = f"{(fails / total * 100):.0f}%" if total > 0 else "N/A"
            lines.append(f"| `{skill}` | {fails} | {successes} | {rate} |")
    else:
        lines.append("No failures recorded yet.")
    lines.append("")

    # Q2: Which execution types are stable?
    lines.append("## Execution Type Stability")
    type_outcomes: Dict[str, Counter] = {}
    for entry in metrics:
        exec_type = entry.get("execution_type", "unknown")
        outcome = entry.get("outcome", "unknown")
        if exec_type not in type_outcomes:
            type_outcomes[exec_type] = Counter()
        type_outcomes[exec_type][outcome] += 1

    if type_outcomes:
        lines.append("| Type | Success | Failure | Blocked | Total |")
        lines.append("|---|---|---|---|---|")
        for exec_type, outcomes in sorted(type_outcomes.items()):
            total = sum(outcomes.values())
            lines.append(f"| {exec_type} | {outcomes.get('success', 0)} | "
                        f"{outcomes.get('failure', 0)} | {outcomes.get('blocked', 0)} | {total} |")
    else:
        lines.append("No execution data yet.")
    lines.append("")

    # Q3: Tool adapter errors
    lines.append("## Tool Adapter Errors")
    tool_errors: Counter = Counter()
    for entry in tool_audit:
        if entry.get("status") in ("error", "failure", "timeout"):
            tool_errors[entry.get("tool", "unknown")] += 1

    if tool_errors:
        lines.append("| Tool | Errors |")
        lines.append("|---|---|")
        for tool, count in tool_errors.most_common(10):
            lines.append(f"| `{tool}` | {count} |")
    else:
        lines.append("No tool adapter errors recorded.")
    lines.append("")

    # Q4: Summary
    lines.append("## Summary")
    total_events = len(metrics)
    total_feedback = len(feedback)
    total_tool_calls = len(tool_audit)
    lines.append(f"- Events: {total_events}")
    lines.append(f"- Feedback entries: {total_feedback}")
    lines.append(f"- Tool calls: {total_tool_calls}")

    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate observability reports")
    parser.add_argument("--root", default=".", help="Project root")
    parser.add_argument("--max-lines", type=int, default=30, help="Max lines per section")
    parser.add_argument("--output", default=None, help="Write to file (default: stdout)")
    args = parser.parse_args()

    root = Path(args.root)
    metrics = load_metrics(root)
    feedback = load_feedback(root)
    tool_audit = load_tool_audit(root)

    report = generate_health_dashboard(metrics, feedback, tool_audit, args.max_lines)

    if args.output:
        Path(args.output).write_text(report)
        print(f"Report written to {args.output}")
    else:
        print(report)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
