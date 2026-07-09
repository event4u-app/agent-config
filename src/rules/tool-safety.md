---
type: auto
tier: "2b"
description: "Skill uses external tools — enforce allowlist, deny-by-default, no hidden credential patterns"
triggers:
  - keyword: "allowed_tools"
  - keyword: "tool registry"
  - intent: "external API"
workspaces: [agent-config-maintainer, engineering]
packs: [meta]
---

# Tool Safety

## Core principle

Tools are permissions, not abilities. Every tool access must be declared and reviewable.

**Least Agency** — grant the narrowest set of tools, scopes, and consequential actions the task actually needs; fewer capabilities on any path means a smaller blast radius when something (a prompt injection, a confused-deputy step, a bug) goes wrong. This is the agent-tool application of least-privilege and maps to OWASP's Agentic Security Initiative (ASI) excessive-agency / permission-management risks. When in doubt, deny and ask, don't grant and hope.

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

## See also

- [`lethal-trifecta-guard`](lethal-trifecta-guard.md) — an over-broad tool grant is the standing egress leg of the lethal trifecta (OWASP ASI). Least Agency here breaks that leg by construction.
- [`supply-chain-intake`](../skills/supply-chain-intake/SKILL.md) — the MCP-server intake gate applies this rule's Least-Agency tool-grant review before a new server is connected.
- [`untrusted-input-defense`](untrusted-input-defense.md) — the least-agency + human-approval controls (OWASP LLM06 / ASI excessive-agency) that bound an untrusted-content path.
