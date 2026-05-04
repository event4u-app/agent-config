---
type: auto
tier: "2b"
source: package
description: "When a skill uses external tools — enforce allowlist, deny-by-default, and no hidden credential patterns"
---

# Tool Safety

## Core principle

Tools are permissions, not abilities. Every tool access must be declared and reviewable.

## Constraints

- **Deny by default** — no tool access unless explicitly listed in `allowed_tools`
- **Allowlist only** — tool names must match the tool registry
- **Read-first** — prefer read-only actions; write requires explicit approval
- **No hidden credentials** — tools must not embed API keys or tokens in skill files
- **No arbitrary execution** — tool adapters have fixed interfaces, not free-form calls
- **Audit trail** — tool usage should be observable and logged

## When this applies

- Skills that declare `allowed_tools` in their execution block
- Skills that reference external APIs (GitHub, Jira, etc.)
- Any runtime execution that accesses external services

## Escalation

If a skill needs a tool that is not in the registry:
1. Do NOT use the tool
2. Flag it as a suggestion for registry extension
3. The tool must be added to the registry before use

## What this rule does NOT cover

- Internal agent capabilities (file reading, code analysis) — these are not external tools
- MCP server configuration — handled by the `mcp` skill
- Credential management — handled by environment configuration
