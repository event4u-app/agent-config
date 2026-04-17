"""Tests for report_generator.py."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from report_generator import generate_health_dashboard


class TestHealthDashboard:

    def test_empty_data(self):
        report = generate_health_dashboard([], [], [])
        assert "# Health Dashboard" in report
        assert "No failures recorded" in report
        assert "No execution data" in report
        assert "No tool adapter errors" in report

    def test_with_feedback(self):
        feedback = [
            {"skill_name": "s1", "outcome": "failure"},
            {"skill_name": "s1", "outcome": "failure"},
            {"skill_name": "s1", "outcome": "success"},
            {"skill_name": "s2", "outcome": "success"},
        ]
        report = generate_health_dashboard([], feedback, [])
        assert "s1" in report
        assert "67%" in report  # 2/3 failure rate

    def test_with_metrics(self):
        metrics = [
            {"execution_type": "assisted", "outcome": "success"},
            {"execution_type": "assisted", "outcome": "success"},
            {"execution_type": "automated", "outcome": "failure"},
        ]
        report = generate_health_dashboard(metrics, [], [])
        assert "assisted" in report
        assert "automated" in report

    def test_with_tool_audit(self):
        audit = [
            {"tool": "github", "status": "success"},
            {"tool": "github", "status": "error"},
            {"tool": "jira", "status": "timeout"},
        ]
        report = generate_health_dashboard([], [], audit)
        assert "github" in report
        assert "jira" in report

    def test_summary_counts(self):
        metrics = [{"execution_type": "x", "outcome": "y"}] * 5
        feedback = [{"skill_name": "s", "outcome": "success"}] * 3
        audit = [{"tool": "t", "status": "ok"}] * 2
        report = generate_health_dashboard(metrics, feedback, audit)
        assert "Events: 5" in report
        assert "Feedback entries: 3" in report
        assert "Tool calls: 2" in report

    def test_max_lines_respected(self):
        feedback = [{"skill_name": f"s{i}", "outcome": "failure"} for i in range(50)]
        report = generate_health_dashboard([], feedback, [], max_lines=5)
        # Should only show top 5 failing skills
        lines = [l for l in report.split("\n") if l.startswith("| `s")]
        assert len(lines) <= 5
