#!/usr/bin/env python3
"""
Tool Registry — manages available external tools and their permissions.

Responsibilities:
- Define available tools and their supported actions
- Validate tool declarations from skills
- Check tool permissions
- Report on tool usage across skills

Usage:
    python3 scripts/tool_registry.py [--format text|json]
    python3 scripts/tool_registry.py --validate-skill SKILL_TOOLS
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, FrozenSet, List, Optional, Set


@dataclass
class ToolDefinition:
    """Definition of an available tool."""
    name: str
    description: str
    supported_actions: FrozenSet[str]
    default_mode: str  # "read-only" or "read-write"
    requires_auth: bool


# --- Built-in tool definitions ---
TOOL_REGISTRY: Dict[str, ToolDefinition] = {
    "github": ToolDefinition(
        name="github",
        description="GitHub API — PRs, issues, files, commits",
        supported_actions=frozenset({"read_pr", "read_issue", "create_pr", "list_files", "read_commit"}),
        default_mode="read-only",
        requires_auth=True,
    ),
    "jira": ToolDefinition(
        name="jira",
        description="Jira API — tickets, search, comments",
        supported_actions=frozenset({"read_ticket", "search_tickets", "add_comment", "transition_ticket"}),
        default_mode="read-only",
        requires_auth=True,
    ),
}


@dataclass
class ToolValidationResult:
    """Result of validating tool declarations."""
    valid: bool
    errors: List[str]
    warnings: List[str]


def get_tool(name: str) -> Optional[ToolDefinition]:
    """Look up a tool by name."""
    return TOOL_REGISTRY.get(name)


def list_tools() -> List[ToolDefinition]:
    """List all registered tools."""
    return list(TOOL_REGISTRY.values())


def validate_tool_declarations(allowed_tools: List[str],
                                tool_permissions: Optional[Dict] = None) -> ToolValidationResult:
    """Validate tool declarations from a skill's execution block."""
    errors: List[str] = []
    warnings: List[str] = []

    for tool_name in allowed_tools:
        tool_def = get_tool(tool_name)
        if tool_def is None:
            errors.append(f"Tool '{tool_name}' is not registered in the tool registry")
            continue

        # Check permissions if declared
        if tool_permissions and tool_name in tool_permissions:
            perms = tool_permissions[tool_name]
            actions = perms.get("actions", [])
            for action in actions:
                if action not in tool_def.supported_actions:
                    errors.append(f"Tool '{tool_name}' does not support action '{action}'")

    # Check for tools in permissions but not in allowed_tools
    if tool_permissions:
        for tool_name in tool_permissions:
            if tool_name not in allowed_tools:
                warnings.append(f"Tool '{tool_name}' has permissions but is not in allowed_tools")

    return ToolValidationResult(
        valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Tool Registry — manage and validate tools")
    parser.add_argument("--format", choices=["text", "json"], default="text")
    parser.add_argument("--validate-tools", nargs="*", help="Tool names to validate")
    args = parser.parse_args()

    if args.validate_tools is not None:
        result = validate_tool_declarations(args.validate_tools)
        if args.format == "json":
            print(json.dumps(asdict(result), indent=2))
        else:
            if result.valid:
                print(f"✅  All {len(args.validate_tools)} tool declarations are valid")
            else:
                for e in result.errors:
                    print(f"❌  {e}")
                for w in result.warnings:
                    print(f"⚠️  {w}")
        return 0 if result.valid else 1

    # List tools
    tools = list_tools()
    if args.format == "json":
        print(json.dumps([{
            "name": t.name, "description": t.description,
            "actions": sorted(t.supported_actions),
            "default_mode": t.default_mode, "requires_auth": t.requires_auth,
        } for t in tools], indent=2))
    else:
        print(f"Registered tools: {len(tools)}\n")
        for t in tools:
            actions = ", ".join(sorted(t.supported_actions))
            print(f"  {t.name} ({t.default_mode})")
            print(f"    {t.description}")
            print(f"    Actions: {actions}")
            print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
