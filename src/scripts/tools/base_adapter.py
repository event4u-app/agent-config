#!/usr/bin/env python3
"""
Base Tool Adapter — abstract contract for tool integrations.

All tool adapters must:
1. Inherit from BaseToolAdapter
2. Define supported_actions
3. Implement execute_action
4. Implement check_auth

No real API calls are made — adapters return structured results.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, FrozenSet, List, Optional


@dataclass
class ToolAction:
    """Structured representation of a tool action request."""
    tool_name: str
    action: str
    params: Dict[str, Any]


@dataclass
class ToolResult:
    """Structured result from a tool action."""
    tool_name: str
    action: str
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

    def to_dict(self) -> dict:
        result = {
            "tool": self.tool_name,
            "action": self.action,
            "success": self.success,
        }
        if self.data:
            result["data"] = self.data
        if self.error:
            result["error"] = self.error
        return result


class BaseToolAdapter(ABC):
    """Abstract base for tool adapters."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Tool name (must match registry entry)."""

    @property
    @abstractmethod
    def supported_actions(self) -> FrozenSet[str]:
        """Set of supported action names."""

    @abstractmethod
    def check_auth(self) -> bool:
        """Check if authentication is available. Does NOT make API calls."""

    @abstractmethod
    def execute_action(self, action: ToolAction) -> ToolResult:
        """Execute a tool action. Returns structured result."""

    def validate_action(self, action: ToolAction) -> Optional[str]:
        """Validate an action before execution. Returns error message or None."""
        if action.tool_name != self.name:
            return f"Action tool '{action.tool_name}' does not match adapter '{self.name}'"
        if action.action not in self.supported_actions:
            return (f"Action '{action.action}' not supported by '{self.name}'; "
                    f"valid: {', '.join(sorted(self.supported_actions))}")
        return None

    def safe_execute(self, action: ToolAction) -> ToolResult:
        """Validate and execute an action safely."""
        error = self.validate_action(action)
        if error:
            return ToolResult(
                tool_name=self.name,
                action=action.action,
                success=False,
                error=error,
            )
        return self.execute_action(action)
