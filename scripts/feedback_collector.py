#!/usr/bin/env python3
"""
Feedback Collector — captures execution outcomes and suggests improvements.

Responsibilities:
- Record execution outcomes (success, failure, partial)
- Classify failure patterns
- Suggest skill improvements based on patterns
- Generate feedback reports

Usage:
    python3 scripts/feedback_collector.py --report [--format text|json]
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Dict, List, Optional


class Outcome(str, Enum):
    """Execution outcome classification."""
    SUCCESS = "success"
    FAILURE = "failure"
    PARTIAL = "partial"
    BLOCKED = "blocked"
    TIMEOUT = "timeout"


@dataclass
class ExecutionFeedback:
    """Feedback from a single execution."""
    skill_name: str
    outcome: Outcome
    duration_ms: float
    timestamp: float
    error_codes: List[str] = field(default_factory=list)
    notes: Optional[str] = None


@dataclass
class ImprovementSuggestion:
    """Suggested improvement based on feedback patterns."""
    skill_name: str
    suggestion_type: str  # "fix_error", "add_validation", "improve_timeout", "refactor"
    description: str
    priority: str  # "high", "medium", "low"
    evidence: str


@dataclass
class FeedbackReport:
    """Aggregated feedback report."""
    total_executions: int
    outcomes: Dict[str, int]
    avg_duration_ms: float
    top_errors: List[Dict[str, int]]
    suggestions: List[ImprovementSuggestion]

    def to_dict(self) -> dict:
        return {
            "total_executions": self.total_executions,
            "outcomes": self.outcomes,
            "avg_duration_ms": round(self.avg_duration_ms, 2),
            "top_errors": self.top_errors,
            "suggestions": [asdict(s) for s in self.suggestions],
        }


class FeedbackCollector:
    """Collects and analyzes execution feedback."""

    def __init__(self) -> None:
        self._feedback: List[ExecutionFeedback] = []

    def record(self, feedback: ExecutionFeedback) -> None:
        self._feedback.append(feedback)

    def record_outcome(self, skill_name: str, outcome: Outcome,
                       duration_ms: float, error_codes: Optional[List[str]] = None,
                       notes: Optional[str] = None) -> None:
        self._feedback.append(ExecutionFeedback(
            skill_name=skill_name,
            outcome=outcome,
            duration_ms=duration_ms,
            timestamp=time.time(),
            error_codes=error_codes or [],
            notes=notes,
        ))

    @property
    def count(self) -> int:
        return len(self._feedback)

    def get_feedback(self, skill_name: Optional[str] = None) -> List[ExecutionFeedback]:
        if skill_name is None:
            return list(self._feedback)
        return [f for f in self._feedback if f.skill_name == skill_name]

    def _count_outcomes(self) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for f in self._feedback:
            key = f.outcome.value
            counts[key] = counts.get(key, 0) + 1
        return counts

    def _count_errors(self) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for f in self._feedback:
            for code in f.error_codes:
                counts[code] = counts.get(code, 0) + 1
        return counts

    def _avg_duration(self) -> float:
        if not self._feedback:
            return 0.0
        return sum(f.duration_ms for f in self._feedback) / len(self._feedback)

    def suggest_improvements(self) -> List[ImprovementSuggestion]:
        suggestions: List[ImprovementSuggestion] = []
        errors = self._count_errors()
        outcomes = self._count_outcomes()

        # High failure rate
        total = len(self._feedback)
        failures = outcomes.get("failure", 0)
        if total > 0 and failures / total > 0.5:
            suggestions.append(ImprovementSuggestion(
                skill_name="*",
                suggestion_type="refactor",
                description="Overall failure rate exceeds 50% — review execution pipeline",
                priority="high",
                evidence=f"{failures}/{total} executions failed",
            ))

        # Repeated errors per skill
        skill_errors: Dict[str, Dict[str, int]] = {}
        for f in self._feedback:
            if f.error_codes:
                if f.skill_name not in skill_errors:
                    skill_errors[f.skill_name] = {}
                for code in f.error_codes:
                    skill_errors[f.skill_name][code] = skill_errors[f.skill_name].get(code, 0) + 1

        for skill, error_counts in skill_errors.items():
            for code, count in error_counts.items():
                if count >= 3:
                    suggestions.append(ImprovementSuggestion(
                        skill_name=skill,
                        suggestion_type="fix_error",
                        description=f"Error '{code}' occurred {count} times",
                        priority="high",
                        evidence=f"{count} occurrences of {code}",
                    ))

        # Timeout pattern
        timeouts = outcomes.get("timeout", 0)
        if timeouts >= 2:
            suggestions.append(ImprovementSuggestion(
                skill_name="*",
                suggestion_type="improve_timeout",
                description=f"{timeouts} executions timed out — review timeout settings",
                priority="medium",
                evidence=f"{timeouts} timeouts",
            ))

        return suggestions

    def generate_report(self) -> FeedbackReport:
        errors = self._count_errors()
        top_errors = [{"code": k, "count": v} for k, v in
                      sorted(errors.items(), key=lambda x: x[1], reverse=True)[:5]]
        return FeedbackReport(
            total_executions=len(self._feedback),
            outcomes=self._count_outcomes(),
            avg_duration_ms=self._avg_duration(),
            top_errors=top_errors,
            suggestions=self.suggest_improvements(),
        )


def main() -> int:
    parser = argparse.ArgumentParser(description="Feedback Collector — execution outcome analysis")
    parser.add_argument("--report", action="store_true", help="Generate report (from demo data)")
    parser.add_argument("--format", choices=["text", "json"], default="text")
    args = parser.parse_args()

    collector = FeedbackCollector()
    if not args.report:
        print("No feedback data. Use --report with recorded data.")
        return 0

    report = collector.generate_report()
    if args.format == "json":
        print(json.dumps(report.to_dict(), indent=2))
    else:
        print(f"Total executions: {report.total_executions}")
        print(f"Avg duration: {report.avg_duration_ms:.2f}ms")
        print(f"Outcomes: {report.outcomes}")
        if report.suggestions:
            print(f"\nSuggestions ({len(report.suggestions)}):")
            for s in report.suggestions:
                print(f"  [{s.priority}] {s.skill_name}: {s.description}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
