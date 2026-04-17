#!/usr/bin/env python3
"""
Feedback Governance — derive actionable governance proposals from feedback data.

Reads persisted feedback and generates proposals for:
- Skills with high failure rates → needs_review flag
- Never-used skills → deprecation candidate
- Repeated errors → refactoring candidate
- Consistent tool failures → adapter hardening

All proposals are suggestions only — never auto-applied.
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))

from persistence import load_feedback, load_tool_audit


@dataclass
class GovernanceProposal:
    """A proposed governance action based on feedback data."""
    skill_name: str
    action: str  # needs_review, deprecation_candidate, refactor, adapter_hardening
    reason: str
    evidence: Dict = field(default_factory=dict)
    priority: str = "low"  # low, medium, high

    def to_markdown(self) -> str:
        icon = {"high": "🔴", "medium": "🟡", "low": "🔵"}.get(self.priority, "⚪")
        return f"{icon} **{self.skill_name}** → `{self.action}` — {self.reason}"


def analyze_feedback(feedback: List[Dict], tool_audit: List[Dict]) -> List[GovernanceProposal]:
    """Analyze feedback data and generate governance proposals."""
    proposals: List[GovernanceProposal] = []

    # Failure analysis
    skill_outcomes: Dict[str, Counter] = {}
    for entry in feedback:
        skill = entry.get("skill_name", "unknown")
        outcome = entry.get("outcome", "unknown").lower()
        if skill not in skill_outcomes:
            skill_outcomes[skill] = Counter()
        skill_outcomes[skill][outcome] += 1

    for skill, outcomes in skill_outcomes.items():
        total = sum(outcomes.values())
        failures = outcomes.get("failure", 0)

        if total >= 3 and failures / total > 0.5:
            proposals.append(GovernanceProposal(
                skill_name=skill,
                action="needs_review",
                reason=f"High failure rate: {failures}/{total} ({failures/total*100:.0f}%)",
                evidence={"failures": failures, "total": total},
                priority="high",
            ))
        elif total >= 5 and failures / total > 0.3:
            proposals.append(GovernanceProposal(
                skill_name=skill,
                action="refactor",
                reason=f"Elevated failure rate: {failures}/{total} ({failures/total*100:.0f}%)",
                evidence={"failures": failures, "total": total},
                priority="medium",
            ))

    # Tool adapter analysis
    tool_outcomes: Dict[str, Counter] = {}
    for entry in tool_audit:
        tool = entry.get("tool", "unknown")
        status = entry.get("status", "unknown")
        if tool not in tool_outcomes:
            tool_outcomes[tool] = Counter()
        tool_outcomes[tool][status] += 1

    for tool, outcomes in tool_outcomes.items():
        errors = outcomes.get("error", 0) + outcomes.get("failure", 0) + outcomes.get("timeout", 0)
        total = sum(outcomes.values())
        if total >= 3 and errors / total > 0.3:
            proposals.append(GovernanceProposal(
                skill_name=f"adapter:{tool}",
                action="adapter_hardening",
                reason=f"High error rate: {errors}/{total} ({errors/total*100:.0f}%)",
                evidence={"errors": errors, "total": total},
                priority="high" if errors / total > 0.5 else "medium",
            ))

    # Sort by priority
    priority_order = {"high": 0, "medium": 1, "low": 2}
    proposals.sort(key=lambda p: priority_order.get(p.priority, 3))

    return proposals


def generate_governance_report(proposals: List[GovernanceProposal]) -> str:
    """Generate a markdown governance report."""
    lines = ["# Feedback Governance Report", ""]

    if not proposals:
        lines.append("✅ No governance actions needed. All skills and adapters within thresholds.")
        return "\n".join(lines) + "\n"

    lines.append(f"Found **{len(proposals)}** governance proposals:")
    lines.append("")

    for proposal in proposals:
        lines.append(f"- {proposal.to_markdown()}")

    lines.append("")
    lines.append("*All proposals are suggestions — review before applying.*")

    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Analyze feedback for governance actions")
    parser.add_argument("--root", default=".", help="Project root")
    args = parser.parse_args()

    root = Path(args.root)
    feedback = load_feedback(root)
    tool_audit = load_tool_audit(root)

    proposals = analyze_feedback(feedback, tool_audit)
    report = generate_governance_report(proposals)
    print(report)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
