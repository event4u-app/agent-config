"""Tests for the tool registry."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from tool_registry import (
    TOOL_REGISTRY,
    get_tool,
    list_tools,
    validate_tool_declarations,
)


def test_github_tool_exists() -> None:
    tool = get_tool("github")
    assert tool is not None
    assert tool.name == "github"
    assert "read_pr" in tool.supported_actions


def test_jira_tool_exists() -> None:
    tool = get_tool("jira")
    assert tool is not None
    assert tool.name == "jira"
    assert "read_ticket" in tool.supported_actions


def test_unknown_tool_returns_none() -> None:
    tool = get_tool("nonexistent")
    assert tool is None


def test_list_tools_returns_all() -> None:
    tools = list_tools()
    names = {t.name for t in tools}
    assert "github" in names
    assert "jira" in names


def test_validate_valid_tools() -> None:
    result = validate_tool_declarations(["github", "jira"])
    assert result.valid
    assert len(result.errors) == 0


def test_validate_unknown_tool_fails() -> None:
    result = validate_tool_declarations(["github", "slack"])
    assert not result.valid
    assert any("slack" in e for e in result.errors)


def test_validate_empty_tools_passes() -> None:
    result = validate_tool_declarations([])
    assert result.valid


def test_validate_tool_permissions_valid() -> None:
    result = validate_tool_declarations(
        ["github"],
        {"github": {"actions": ["read_pr", "create_pr"]}},
    )
    assert result.valid


def test_validate_tool_permissions_invalid_action() -> None:
    result = validate_tool_declarations(
        ["github"],
        {"github": {"actions": ["delete_repo"]}},
    )
    assert not result.valid
    assert any("delete_repo" in e for e in result.errors)


def test_validate_permissions_without_allowed_warns() -> None:
    result = validate_tool_declarations(
        ["github"],
        {"jira": {"actions": ["read_ticket"]}},
    )
    assert result.valid  # no errors
    assert any("jira" in w for w in result.warnings)


def test_tool_default_modes() -> None:
    github = get_tool("github")
    assert github is not None
    assert github.default_mode == "read-only"
    assert github.requires_auth is True
