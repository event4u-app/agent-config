---
type: auto
source: package
description: "When a skill uses external tools — enforce allowlist, deny-by-default, and no hidden credential patterns"
---

# Tool Safety

Tools are permissions, not abilities. Every tool access must be declared and reviewable.

## Constraints

- **Deny by default** — no access unless in `allowed_tools`
- **Allowlist only** — names must match tool registry
- **Read-first** — write requires explicit approval
- **No hidden credentials** — no API keys in skill files
- **No arbitrary execution** — adapters have fixed interfaces
- **Audit trail** — tool usage must be observable

## When this applies

- Skills declaring `allowed_tools`
- Skills referencing external APIs (GitHub, Jira)
- Runtime execution accessing external services

## Escalation

1. Do NOT use unregistered tools
2. Flag as registry extension suggestion
3. Tool must be added to registry before use

## Not covered

- Internal agent capabilities (not external tools)
- MCP server configuration (`mcp` skill)
- Credential management (environment config)
