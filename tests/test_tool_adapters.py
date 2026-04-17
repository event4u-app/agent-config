"""Tests for tool adapters."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from tools.base_adapter import BaseToolAdapter, ToolAction, ToolResult
from tools.github_adapter import GitHubAdapter
from tools.jira_adapter import JiraAdapter


# --- Base adapter tests ---

def test_validate_action_wrong_tool() -> None:
    adapter = GitHubAdapter()
    action = ToolAction(tool_name="jira", action="read_pr", params={})
    error = adapter.validate_action(action)
    assert error is not None
    assert "does not match" in error


def test_validate_action_unsupported() -> None:
    adapter = GitHubAdapter()
    action = ToolAction(tool_name="github", action="delete_repo", params={})
    error = adapter.validate_action(action)
    assert error is not None
    assert "not supported" in error


def test_validate_action_valid() -> None:
    adapter = GitHubAdapter()
    action = ToolAction(tool_name="github", action="read_pr", params={})
    error = adapter.validate_action(action)
    assert error is None


def test_safe_execute_rejects_invalid() -> None:
    adapter = GitHubAdapter()
    action = ToolAction(tool_name="github", action="delete_repo", params={})
    result = adapter.safe_execute(action)
    assert not result.success
    assert result.error is not None


def test_safe_execute_runs_valid() -> None:
    adapter = GitHubAdapter()
    action = ToolAction(tool_name="github", action="read_pr", params={"pr_number": 42})
    result = adapter.safe_execute(action)
    assert result.success
    assert result.data is not None


# --- GitHub adapter tests ---

def test_github_name() -> None:
    assert GitHubAdapter().name == "github"


def test_github_supported_actions() -> None:
    actions = GitHubAdapter().supported_actions
    assert "read_pr" in actions
    assert "create_pr" in actions
    assert "list_files" in actions


def test_github_all_actions_scaffold() -> None:
    adapter = GitHubAdapter()
    for action_name in adapter.supported_actions:
        action = ToolAction(tool_name="github", action=action_name, params={"test": True})
        result = adapter.execute_action(action)
        assert result.success, f"Action {action_name} failed"
        assert result.data is not None
        assert result.data["scaffold"] is True


# --- Jira adapter tests ---

def test_jira_name() -> None:
    assert JiraAdapter().name == "jira"


def test_jira_supported_actions() -> None:
    actions = JiraAdapter().supported_actions
    assert "read_ticket" in actions
    assert "search_tickets" in actions
    assert "add_comment" in actions


def test_jira_all_actions_scaffold() -> None:
    adapter = JiraAdapter()
    for action_name in adapter.supported_actions:
        action = ToolAction(tool_name="jira", action=action_name, params={"test": True})
        result = adapter.execute_action(action)
        assert result.success, f"Action {action_name} failed"
        assert result.data is not None


# --- ToolResult tests ---

def test_tool_result_to_dict_success() -> None:
    result = ToolResult(tool_name="github", action="read_pr", success=True, data={"id": 1})
    d = result.to_dict()
    assert d["success"] is True
    assert d["data"]["id"] == 1
    assert "error" not in d


def test_tool_result_to_dict_error() -> None:
    result = ToolResult(tool_name="github", action="read_pr", success=False, error="Not found")
    d = result.to_dict()
    assert d["success"] is False
    assert d["error"] == "Not found"
    assert "data" not in d
