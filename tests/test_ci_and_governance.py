"""Tests for feedback_governance.py."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from feedback_governance import analyze_feedback, generate_governance_report, GovernanceProposal


class TestFeedbackGovernance:

    def test_no_feedback(self):
        proposals = analyze_feedback([], [])
        assert proposals == []

    def test_high_failure_rate(self):
        feedback = [
            {"skill_name": "bad-skill", "outcome": "failure"},
            {"skill_name": "bad-skill", "outcome": "failure"},
            {"skill_name": "bad-skill", "outcome": "failure"},
            {"skill_name": "bad-skill", "outcome": "success"},
        ]
        proposals = analyze_feedback(feedback, [])
        assert len(proposals) == 1
        assert proposals[0].action == "needs_review"
        assert proposals[0].priority == "high"

    def test_moderate_failure_rate(self):
        feedback = [
            {"skill_name": "ok-skill", "outcome": "failure"},
            {"skill_name": "ok-skill", "outcome": "failure"},
            {"skill_name": "ok-skill", "outcome": "success"},
            {"skill_name": "ok-skill", "outcome": "success"},
            {"skill_name": "ok-skill", "outcome": "success"},
        ]
        proposals = analyze_feedback(feedback, [])
        assert len(proposals) == 1
        assert proposals[0].action == "refactor"
        assert proposals[0].priority == "medium"

    def test_tool_adapter_errors(self):
        tool_audit = [
            {"tool": "github", "status": "error"},
            {"tool": "github", "status": "error"},
            {"tool": "github", "status": "success"},
        ]
        proposals = analyze_feedback([], tool_audit)
        assert len(proposals) == 1
        assert proposals[0].action == "adapter_hardening"
        assert "github" in proposals[0].skill_name

    def test_healthy_data(self):
        feedback = [
            {"skill_name": "good", "outcome": "success"},
            {"skill_name": "good", "outcome": "success"},
            {"skill_name": "good", "outcome": "success"},
        ]
        proposals = analyze_feedback(feedback, [])
        assert proposals == []

    def test_report_no_proposals(self):
        report = generate_governance_report([])
        assert "No governance actions needed" in report

    def test_report_with_proposals(self):
        proposals = [
            GovernanceProposal(
                skill_name="bad", action="needs_review",
                reason="High failure rate", priority="high"
            ),
        ]
        report = generate_governance_report(proposals)
        assert "1" in report
        assert "bad" in report
        assert "needs_review" in report

    def test_proposals_sorted_by_priority(self):
        feedback = [
            {"skill_name": "critical", "outcome": "failure"},
            {"skill_name": "critical", "outcome": "failure"},
            {"skill_name": "critical", "outcome": "failure"},
        ]
        tool_audit = [
            {"tool": "jira", "status": "error"},
            {"tool": "jira", "status": "error"},
            {"tool": "jira", "status": "success"},
        ]
        proposals = analyze_feedback(feedback, tool_audit)
        assert proposals[0].priority == "high"
