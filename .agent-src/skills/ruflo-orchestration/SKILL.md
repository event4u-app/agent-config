---
name: ruflo-orchestration
description: "Use when ruflo (ruvnet/ruflo) is installed and a task needs multi-agent orchestration, swarms, or its MCP tools/memory — delegate to ruflo. NOT for in-session fan-out (use subagent-orchestration)."
source: package
domain: devops
workspaces:
  - engineering
packs:
  - ruflo-bridge
lifecycle: active
trust:
  level: experimental
  confidence: medium
  human_review_required: false
install:
  default: false
  removable: true
---

# ruflo-orchestration

Delegate multi-agent orchestration to [`ruvnet/ruflo`](https://github.com/ruvnet/ruflo) when installed, instead of improvising in-session. ruflo = external orchestration runtime (swarms, persistent memory/RAG, MCP server, hooks, background workers). agent-config coexists via plugin-scope hooks ([`ruflo-coexistence`](../../../../docs/contracts/ruflo-coexistence.md)) and routes orchestration-shaped work to it.

## When to use

Both must hold:

1. ruflo detected (`claude-flow.config.json`, `ruflo-core@ruflo` in `enabledPlugins`, a `claude-flow` MCP server, or ruflo's `.claude/helpers/` scripts — same signals as `install.detect_ruflo`).
2. Task is orchestration-shaped: "spin up a swarm", "run agents in parallel", "coordinate agents", "use swarm memory", "search past patterns", or names a ruflo command / MCP tool.

Do NOT use when:

- ruflo absent → [`subagent-orchestration`](../subagent-orchestration/SKILL.md) (in-session fan-out, no network, no spend).
- Single-file edit / bug fix / review → matching language/review skill.
- Generic MCP wiring → [`mcp`](../mcp/SKILL.md).

## How ruflo and agent-config divide responsibility

> "ruflo coordinates, Claude Code creates." ruflo's MCP tools coordinate (topology, spawning, memory); Claude Code does the file work.

| Concern | Owner |
|---|---|
| Swarm topology, agent spawning, task routing | ruflo (MCP + hooks) |
| Cross-session memory / RAG / pattern search | ruflo (AgentDB) |
| File edits, code generation, command execution | Claude Code |
| Safety floors on the **main** agent (scope-control, non-destructive) | agent-config rules |
| Lifecycle observability hooks (chat-history, roadmap-progress, …) | agent-config (plugin scope) |

## ruflo MCP-tool surface (coordination only)

On ruflo's MCP server (`claude-flow`); they coordinate + return plans/handles — Claude Code executes.

| Tool | Purpose |
|---|---|
| `swarm_init` | Topology (hierarchical / mesh / adaptive) + max agents |
| `agent_spawn` | Launch a typed agent (see map) |
| `memory_store` / `memory_search_unified` | Write / semantic-search swarm memory |
| `memory_import_claude` | Bridge `~/.claude/projects/*/memory/*.md` into AgentDB |
| `memory_bridge_status` | Memory-bridge health |

Counts vary by version — verify against installed `claude-flow.config.json` / `npx ruflo@latest mcp ...`, not a fixed number.

## Persona → ruflo agent-type map

Map agent-config lenses to ruflo's `subagent_type`:

| agent-config role / persona | ruflo agent type |
|---|---|
| `developer` | `coder` |
| `reviewer` | `reviewer` |
| `tester` | `tester` |
| `planner` | `planner` |
| `senior-engineer` / architecture lens | `architect` / `hierarchical-coordinator` |
| security lens | `security-auditor` |

Advisory — roster is version-dependent; confirm before assuming a type exists.

## Procedure

1. **Analyze the existing ruflo setup before spawning.** Read `claude-flow.config.json` (topology, max agents, strategy), probe live state (`memory_bridge_status`) — never assume a topology / `subagent_type`. ruflo not detected → stop, use `subagent-orchestration`. Never delegate to an un-inspected runtime.
2. **Check the mode.** `integrations.ruflo.mode: skip` → developer opted out of agent-config hooks; orchestration still routes to ruflo, but don't assume agent-config observability runs.
3. **Coordinate first, then create.** Call the ruflo MCP tool (`swarm_init` / `agent_spawn`); Claude Code does the file work the spawned agents request.
4. **Surface the governance limit** (below) whenever the swarm acts autonomously on the repo.

## Governance scope — the honest limit

```
agent-config's safety floors bind the MAIN Claude Code agent (rule-context).
They do NOT bind ruflo's autonomously spawned swarm subagents.
```

scope-control, non-destructive-by-default, commit-policy = rules in the **main** agent's context. ruflo's swarm subagents run outside it, don't inherit them. Before authorizing an autonomous swarm that writes to the repo, say so: main-agent gates don't cover the swarm. Enforcement surviving this gap = git-layer pre-commit gate (road-to-ruflo-bridge Phase 7, gated).

## Output format

When delegating to ruflo, the response MUST, in order:

1. Name the **detection signal** that confirmed ruflo (audit why coexistence engaged).
2. Name the **ruflo MCP tool(s)** called + **agent type(s)** spawned (per map).
3. State which work **Claude Code performs** vs. what **ruflo coordinates**.
4. Surface the **governance-scope caveat** when the swarm acts autonomously.

Never claim the swarm ran without naming the coordination tool that launched it.

## Gotchas

- **Assuming an agent type exists.** Roster is version-dependent; `agent_spawn` with an unknown `subagent_type` mis-routes / fails silently. Confirm against the live setup.
- **Hard-coding tool/agent counts.** Docs differ per version; a stale count breaks on upgrade. Read `claude-flow.config.json` / live MCP surface.
- **Governance theatre.** Believing agent-config floors gate the swarm — they gate the **main** agent only; subagents run uninstrumented. Say so before autonomous repo writes.
- **Improvising in-session despite ruflo present.** Wastes the runtime, splits memory across two systems.
- **Writing hooks into `.claude/settings.json` to "coordinate".** Re-introduces the shared-array collision; agent-config hooks ship via plugin scope (see `ruflo-coexistence`).

## Do NOT

- Do NOT delegate to ruflo without first inspecting its config (Procedure step 1).
- Do NOT claim agent-config governs ruflo's swarm subagents — it governs the **main** agent only.
- Do NOT write agent-config hooks into `.claude/settings.json` — they ship via plugin scope.
- Do NOT use this skill when ruflo is absent — use `subagent-orchestration` instead.

## See also

- [`ruflo-coexistence`](../../../../docs/contracts/ruflo-coexistence.md) — hook/MCP/memory coexistence contract.
- [`subagent-orchestration`](../subagent-orchestration/SKILL.md) — in-session (no network) alternative.
- [`mcp`](../mcp/SKILL.md) — generic MCP server wiring.
