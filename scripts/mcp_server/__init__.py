"""MCP server for agent-config — Phase 1 MVP.

Exposes a hand-picked subset of `.agent-src/skills/` as MCP `prompts`
over stdio. Read-only and instructional per the A0 execution-safety
boundary in `agents/roadmaps/road-to-mcp-server.md`. No `tools`
primitive, no engine spawn, no shell execution.

Stability: experimental. Contract: `docs/contracts/mcp-phase-1-scope.md`.
"""
from __future__ import annotations

__version__ = "0.1.0"
SERVER_NAME = "agent-config"
