#!/usr/bin/env python3
"""
GitHub Tool Adapter — scaffold for GitHub API interactions.

Does NOT make real API calls. Produces structured requests/results.
"""

from __future__ import annotations

import os
from typing import FrozenSet

from tools.base_adapter import BaseToolAdapter, ToolAction, ToolResult


class GitHubAdapter(BaseToolAdapter):
    """Adapter for GitHub API interactions."""

    @property
    def name(self) -> str:
        return "github"

    @property
    def supported_actions(self) -> FrozenSet[str]:
        return frozenset({"read_pr", "read_issue", "create_pr", "list_files", "read_commit"})

    def check_auth(self) -> bool:
        """Check if GITHUB_TOKEN is available."""
        return bool(os.environ.get("GITHUB_TOKEN"))

    def execute_action(self, action: ToolAction) -> ToolResult:
        """Execute a GitHub action (scaffold — no real API calls)."""
        if action.action == "read_pr":
            return self._read_pr(action)
        elif action.action == "read_issue":
            return self._read_issue(action)
        elif action.action == "create_pr":
            return self._create_pr(action)
        elif action.action == "list_files":
            return self._list_files(action)
        elif action.action == "read_commit":
            return self._read_commit(action)
        return ToolResult(
            tool_name=self.name,
            action=action.action,
            success=False,
            error=f"Unimplemented action: {action.action}",
        )

    def _read_pr(self, action: ToolAction) -> ToolResult:
        return ToolResult(
            tool_name=self.name, action="read_pr", success=True,
            data={"scaffold": True, "action": "read_pr", "params": action.params},
        )

    def _read_issue(self, action: ToolAction) -> ToolResult:
        return ToolResult(
            tool_name=self.name, action="read_issue", success=True,
            data={"scaffold": True, "action": "read_issue", "params": action.params},
        )

    def _create_pr(self, action: ToolAction) -> ToolResult:
        return ToolResult(
            tool_name=self.name, action="create_pr", success=True,
            data={"scaffold": True, "action": "create_pr", "params": action.params},
        )

    def _list_files(self, action: ToolAction) -> ToolResult:
        return ToolResult(
            tool_name=self.name, action="list_files", success=True,
            data={"scaffold": True, "action": "list_files", "params": action.params},
        )

    def _read_commit(self, action: ToolAction) -> ToolResult:
        return ToolResult(
            tool_name=self.name, action="read_commit", success=True,
            data={"scaffold": True, "action": "read_commit", "params": action.params},
        )
