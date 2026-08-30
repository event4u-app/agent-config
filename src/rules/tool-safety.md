---
type: auto
tier: "2b"
description: "Skill uses external tools — enforce allowlist, deny-by-default, no hidden credential patterns"
triggers:
  - keyword: "allowed_tools"
  - keyword: "tool registry"
self_contained: true
workspaces: [agent-config-maintainer, engineering]
packs: [meta]
enforced_by:
  - "validator:src/scripts/lint_agent_security.ts"
# obligation: line 19
obligation_frequency: "per-edit"
evidence:
  source_type: external-standard
  source_urls: ["https://owasp.org/www-project-top-10-for-large-language-model-applications/"]
  verified_on: 2026-08-30
  normative_level: recommended
---

# Tool Safety

## Core principle

Tools are permissions, not abilities. Every tool access must be declared and reviewable.

**Least Agency** — grant the narrowest set of tools, scopes, and consequential actions the task actually needs; fewer capabilities on any path means a smaller blast radius when something (a prompt injection, a confused-deputy step, a bug) goes wrong. This is the agent-tool application of least-privilege and maps to OWASP's Agentic Security Initiative (ASI) excessive-agency / permission-management risks. When in doubt, deny and ask, don't grant and hope.

## Constraints

- **Deny by default** — no tool access unless explicitly listed in `allowed_tools`
- **Allowlist only** — tool names must match the tool registry. That registry is
  a small static constant and is **not** the same thing as the MCP servers a
  session can reach; `agent-config mcp:available` prints both, kept apart, and
  says plainly that it performs no handshake. Conflating the two is how a skill
  ends up declaring a tool nothing provides.
- **Read-first** — prefer read-only actions; write requires explicit approval
- **No hidden credentials** — tools must not embed API keys or tokens in skill files
- **No arbitrary execution** — tool adapters have fixed interfaces, not free-form calls
- **Audit trail** — tool usage should be observable and logged

## Scoped grants + deny-list (U3, ecosystem harvest 2026-07-13)

- **Prefer scoped-grant syntax over bare tool names** where the host supports
  it: `Bash(npm test:*)` / `Bash(pytest:*)` grants one command family; a bare `Bash` grants a
  shell. The narrowest grant that satisfies the task is the Least-Agency
  default.
- **Optional `disallowed_tools` deny-list** (execution block, schema-backed):
  layered UNDER `allowed_tools` as defense-in-depth — a tool matching the
  deny-list is refused even when a broad allow pattern would admit it
  (e.g. allow `Bash(git:*)` while denying `Bash(git push:*)`).
- **Falsifiable numeric activation thresholds** belong in descriptions where
  they apply — "fires when TLS < v1.2 OR cert expires < 30 days" beats
  "fires on TLS problems": the threshold is testable, the vibe is not.

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
- [`secret-vcs-guard`](secret-vcs-guard.md) — a raw credential in a shipped file is the "no hidden credentials" violation this rule names; that rule blocks it at write/commit time.
