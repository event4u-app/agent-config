#!/usr/bin/env python3
"""
Jira Tool Adapter — scaffold for Jira API interactions.

Does NOT make real API calls. Produces structured requests/results.
"""

from __future__ import annotations

import os
from typing import FrozenSet

from tools.base_adapter import BaseToolAdapter, ToolAction, ToolResult


class JiraAdapter(BaseToolAdapter):
    """Adapter for Jira API interactions."""

    @property
    def name(self) -> str:
        return "jira"

    @property
    def supported_actions(self) -> FrozenSet[str]:
        return frozenset({"read_ticket", "search_tickets", "add_comment", "transition_ticket"})

    def check_auth(self) -> bool:
        """Check if Jira credentials are available."""
        return bool(os.environ.get("JIRA_API_TOKEN")) and bool(os.environ.get("JIRA_BASE_URL"))

    def execute_action(self, action: ToolAction) -> ToolResult:
        """Execute a Jira action (scaffold — no real API calls)."""
        if action.action == "read_ticket":
            return self._read_ticket(action)
        elif action.action == "search_tickets":
            return self._search_tickets(action)
        elif action.action == "add_comment":
            return self._add_comment(action)
        elif action.action == "transition_ticket":
            return self._transition_ticket(action)
        return ToolResult(
            tool_name=self.name,
            action=action.action,
            success=False,
            error=f"Unimplemented action: {action.action}",
        )

    def _read_ticket(self, action: ToolAction) -> ToolResult:
        return ToolResult(
            tool_name=self.name, action="read_ticket", success=True,
            data={"scaffold": True, "action": "read_ticket", "params": action.params},
        )

    def _search_tickets(self, action: ToolAction) -> ToolResult:
        return ToolResult(
            tool_name=self.name, action="search_tickets", success=True,
            data={"scaffold": True, "action": "search_tickets", "params": action.params},
        )

    def _add_comment(self, action: ToolAction) -> ToolResult:
        return ToolResult(
            tool_name=self.name, action="add_comment", success=True,
            data={"scaffold": True, "action": "add_comment", "params": action.params},
        )

    def _transition_ticket(self, action: ToolAction) -> ToolResult:
        return ToolResult(
            tool_name=self.name, action="transition_ticket", success=True,
            data={"scaffold": True, "action": "transition_ticket", "params": action.params},
        )
