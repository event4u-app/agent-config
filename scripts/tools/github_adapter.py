#!/usr/bin/env python3
"""
GitHub Tool Adapter — read-only GitHub API interactions.

Read-only actions use real API calls when GITHUB_TOKEN is available.
Write actions remain scaffold-only (never auto-executed).
Falls back to scaffold data when no token is present.
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, FrozenSet, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from tools.base_adapter import BaseToolAdapter, ToolAction, ToolResult

GITHUB_API = "https://api.github.com"
TIMEOUT_SECONDS = 15


class GitHubAdapter(BaseToolAdapter):
    """Adapter for GitHub API interactions."""

    READ_ACTIONS = frozenset({"read_pr", "read_issue", "list_files", "read_commit"})
    WRITE_ACTIONS = frozenset({"create_pr"})

    @property
    def name(self) -> str:
        return "github"

    @property
    def supported_actions(self) -> FrozenSet[str]:
        return self.READ_ACTIONS | self.WRITE_ACTIONS

    def check_auth(self) -> bool:
        return bool(os.environ.get("GITHUB_TOKEN"))

    @property
    def _token(self) -> Optional[str]:
        return os.environ.get("GITHUB_TOKEN")

    def _api_get(self, path: str) -> Dict[str, Any]:
        """Make an authenticated GET request to the GitHub API."""
        url = f"{GITHUB_API}/{path.lstrip('/')}"
        headers = {"Accept": "application/vnd.github+json"}
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"
        req = Request(url, headers=headers, method="GET")
        with urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
            return json.loads(resp.read().decode())

    def execute_action(self, action: ToolAction) -> ToolResult:
        handler = {
            "read_pr": self._read_pr,
            "read_issue": self._read_issue,
            "list_files": self._list_files,
            "read_commit": self._read_commit,
            "create_pr": self._create_pr,
        }.get(action.action)

        if not handler:
            return ToolResult(
                tool_name=self.name, action=action.action,
                success=False, error=f"Unsupported action: {action.action}",
            )
        return handler(action)

    def _read_pr(self, action: ToolAction) -> ToolResult:
        owner = action.params.get("owner", "")
        repo = action.params.get("repo", "")
        number = action.params.get("number", "")
        if not all([owner, repo, number]) or not self._token:
            return self._scaffold("read_pr", action)
        try:
            data = self._api_get(f"repos/{owner}/{repo}/pulls/{number}")
            return ToolResult(tool_name=self.name, action="read_pr", success=True, data=data)
        except (HTTPError, URLError, TimeoutError) as e:
            return ToolResult(tool_name=self.name, action="read_pr", success=False, error=str(e))

    def _read_issue(self, action: ToolAction) -> ToolResult:
        owner = action.params.get("owner", "")
        repo = action.params.get("repo", "")
        number = action.params.get("number", "")
        if not all([owner, repo, number]) or not self._token:
            return self._scaffold("read_issue", action)
        try:
            data = self._api_get(f"repos/{owner}/{repo}/issues/{number}")
            return ToolResult(tool_name=self.name, action="read_issue", success=True, data=data)
        except (HTTPError, URLError, TimeoutError) as e:
            return ToolResult(tool_name=self.name, action="read_issue", success=False, error=str(e))

    def _list_files(self, action: ToolAction) -> ToolResult:
        owner = action.params.get("owner", "")
        repo = action.params.get("repo", "")
        number = action.params.get("number", "")
        if not all([owner, repo, number]) or not self._token:
            return self._scaffold("list_files", action)
        try:
            data = self._api_get(f"repos/{owner}/{repo}/pulls/{number}/files")
            return ToolResult(tool_name=self.name, action="list_files", success=True, data=data)
        except (HTTPError, URLError, TimeoutError) as e:
            return ToolResult(tool_name=self.name, action="list_files", success=False, error=str(e))

    def _read_commit(self, action: ToolAction) -> ToolResult:
        owner = action.params.get("owner", "")
        repo = action.params.get("repo", "")
        sha = action.params.get("sha", "")
        if not all([owner, repo, sha]) or not self._token:
            return self._scaffold("read_commit", action)
        try:
            data = self._api_get(f"repos/{owner}/{repo}/commits/{sha}")
            return ToolResult(tool_name=self.name, action="read_commit", success=True, data=data)
        except (HTTPError, URLError, TimeoutError) as e:
            return ToolResult(tool_name=self.name, action="read_commit", success=False, error=str(e))

    def _create_pr(self, action: ToolAction) -> ToolResult:
        """Write action — scaffold only, never auto-executed."""
        return self._scaffold("create_pr", action)

    def _scaffold(self, action_name: str, action: ToolAction) -> ToolResult:
        """Return scaffold data when no token or params are missing."""
        return ToolResult(
            tool_name=self.name, action=action_name, success=True,
            data={"scaffold": True, "action": action_name, "params": action.params},
        )
