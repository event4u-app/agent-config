"""Tests for the feedback collector."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from feedback_collector import (
    ExecutionFeedback,
    FeedbackCollector,
    Outcome,
)


def _feedback(skill: str = "test", outcome: Outcome = Outcome.SUCCESS,
              duration: float = 100.0, errors: list = None) -> ExecutionFeedback:
    return ExecutionFeedback(
        skill_name=skill, outcome=outcome, duration_ms=duration,
        timestamp=0, error_codes=errors or [],
    )


def test_record_and_count() -> None:
    collector = FeedbackCollector()
    collector.record(_feedback())
    collector.record(_feedback())
    assert collector.count == 2


def test_record_outcome() -> None:
    collector = FeedbackCollector()
    collector.record_outcome("test-skill", Outcome.SUCCESS, 50.0)
    assert collector.count == 1
    fb = collector.get_feedback("test-skill")
    assert len(fb) == 1
    assert fb[0].outcome == Outcome.SUCCESS


def test_get_feedback_filters() -> None:
    collector = FeedbackCollector()
    collector.record(_feedback("a"))
    collector.record(_feedback("b"))
    collector.record(_feedback("a"))
    assert len(collector.get_feedback("a")) == 2
    assert len(collector.get_feedback("b")) == 1
    assert len(collector.get_feedback()) == 3


def test_report_empty() -> None:
    collector = FeedbackCollector()
    report = collector.generate_report()
    assert report.total_executions == 0
    assert report.avg_duration_ms == 0.0
    assert len(report.suggestions) == 0


def test_report_with_data() -> None:
    collector = FeedbackCollector()
    collector.record(_feedback("s1", Outcome.SUCCESS, 100.0))
    collector.record(_feedback("s1", Outcome.FAILURE, 200.0, ["err_1"]))
    report = collector.generate_report()
    assert report.total_executions == 2
    assert report.avg_duration_ms == 150.0
    assert report.outcomes.get("success") == 1
    assert report.outcomes.get("failure") == 1


def test_report_top_errors() -> None:
    collector = FeedbackCollector()
    for _ in range(5):
        collector.record(_feedback("s1", Outcome.FAILURE, 100.0, ["err_a"]))
    for _ in range(3):
        collector.record(_feedback("s1", Outcome.FAILURE, 100.0, ["err_b"]))
    report = collector.generate_report()
    assert len(report.top_errors) >= 2
    assert report.top_errors[0]["code"] == "err_a"
    assert report.top_errors[0]["count"] == 5


def test_suggest_high_failure_rate() -> None:
    collector = FeedbackCollector()
    collector.record(_feedback("s1", Outcome.FAILURE, 100.0))
    collector.record(_feedback("s1", Outcome.FAILURE, 100.0))
    collector.record(_feedback("s1", Outcome.SUCCESS, 100.0))
    suggestions = collector.suggest_improvements()
    assert any(s.suggestion_type == "refactor" and s.priority == "high" for s in suggestions)


def test_suggest_repeated_errors() -> None:
    collector = FeedbackCollector()
    for _ in range(4):
        collector.record(_feedback("skill-a", Outcome.FAILURE, 100.0, ["config_err"]))
    suggestions = collector.suggest_improvements()
    assert any(s.skill_name == "skill-a" and s.suggestion_type == "fix_error" for s in suggestions)


def test_suggest_timeout_pattern() -> None:
    collector = FeedbackCollector()
    collector.record(_feedback("s1", Outcome.TIMEOUT, 30000.0))
    collector.record(_feedback("s2", Outcome.TIMEOUT, 60000.0))
    suggestions = collector.suggest_improvements()
    assert any(s.suggestion_type == "improve_timeout" for s in suggestions)


def test_no_suggestions_for_all_success() -> None:
    collector = FeedbackCollector()
    for _ in range(10):
        collector.record(_feedback("s1", Outcome.SUCCESS, 100.0))
    suggestions = collector.suggest_improvements()
    assert len(suggestions) == 0


def test_report_to_dict() -> None:
    collector = FeedbackCollector()
    collector.record(_feedback("s1", Outcome.SUCCESS, 100.0))
    report = collector.generate_report()
    d = report.to_dict()
    assert "total_executions" in d
    assert "outcomes" in d
    assert "suggestions" in d
