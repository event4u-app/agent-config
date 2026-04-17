#!/usr/bin/env python3
"""
Jira Tool Adapter — read-only Jira API interactions.

Read-only actions use real API calls when JIRA_API_TOKEN + JIRA_BASE_URL are set.
Write actions remain scaffold-only (never auto-executed).
Falls back to scaffold data when no credentials are present.
"""

from __future__ import annotations

import base64
import json
import os
from typing import Any, Dict, FrozenSet, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from tools.base_adapter import BaseToolAdapter, ToolAction, ToolResult

TIMEOUT_SECONDS = 15


class JiraAdapter(BaseToolAdapter):
    """Adapter for Jira API interactions."""

    READ_ACTIONS = frozenset({"read_ticket", "search_tickets"})
    WRITE_ACTIONS = frozenset({"add_comment", "transition_ticket"})

    @property
    def name(self) -> str:
        return "jira"

    @property
    def supported_actions(self) -> FrozenSet[str]:
        return self.READ_ACTIONS | self.WRITE_ACTIONS

    def check_auth(self) -> bool:
        return bool(self._token) and bool(self._base_url)

    @property
    def _token(self) -> Optional[str]:
        return os.environ.get("JIRA_API_TOKEN")

    @property
    def _base_url(self) -> Optional[str]:
        url = os.environ.get("JIRA_BASE_URL", "")
        return url.rstrip("/") if url else None

    @property
    def _email(self) -> Optional[str]:
        return os.environ.get("JIRA_EMAIL")

    def _api_get(self, path: str) -> Dict[str, Any]:
        """Make an authenticated GET request to the Jira API."""
        url = f"{self._base_url}/rest/api/3/{path.lstrip('/')}"
        headers = {"Accept": "application/json"}
        if self._email and self._token:
            creds = base64.b64encode(f"{self._email}:{self._token}".encode()).decode()
            headers["Authorization"] = f"Basic {creds}"
        elif self._token:
            headers["Authorization"] = f"Bearer {self._token}"
        req = Request(url, headers=headers, method="GET")
        with urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
            return json.loads(resp.read().decode())

    def execute_action(self, action: ToolAction) -> ToolResult:
        handler = {
            "read_ticket": self._read_ticket,
            "search_tickets": self._search_tickets,
            "add_comment": self._add_comment,
            "transition_ticket": self._transition_ticket,
        }.get(action.action)

        if not handler:
            return ToolResult(
                tool_name=self.name, action=action.action,
                success=False, error=f"Unsupported action: {action.action}",
            )
        return handler(action)

    def _read_ticket(self, action: ToolAction) -> ToolResult:
        key = action.params.get("key", "")
        if not key or not self.check_auth():
            return self._scaffold("read_ticket", action)
        try:
            data = self._api_get(f"issue/{key}")
            return ToolResult(tool_name=self.name, action="read_ticket", success=True, data=data)
        except (HTTPError, URLError, TimeoutError) as e:
            return ToolResult(tool_name=self.name, action="read_ticket", success=False, error=str(e))

    def _search_tickets(self, action: ToolAction) -> ToolResult:
        jql = action.params.get("jql", "")
        if not jql or not self.check_auth():
            return self._scaffold("search_tickets", action)
        try:
            encoded_jql = jql.replace(" ", "%20")
            data = self._api_get(f"search?jql={encoded_jql}&maxResults=20")
            return ToolResult(tool_name=self.name, action="search_tickets", success=True, data=data)
        except (HTTPError, URLError, TimeoutError) as e:
            return ToolResult(tool_name=self.name, action="search_tickets", success=False, error=str(e))

    def _add_comment(self, action: ToolAction) -> ToolResult:
        """Write action — scaffold only."""
        return self._scaffold("add_comment", action)

    def _transition_ticket(self, action: ToolAction) -> ToolResult:
        """Write action — scaffold only."""
        return self._scaffold("transition_ticket", action)

    def _scaffold(self, action_name: str, action: ToolAction) -> ToolResult:
        return ToolResult(
            tool_name=self.name, action=action_name, success=True,
            data={"scaffold": True, "action": action_name, "params": action.params},
        )
