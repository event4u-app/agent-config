---
name: ruflo-orchestration
description: "Use when a project has ruflo (ruvnet/ruflo) installed and the task needs multi-agent orchestration, swarms, background agents, or ruflo's MCP tools / memory — delegate to ruflo's runtime instead of improvising in-session. NOT for in-session implementer/judge fan-out (use subagent-orchestration)."
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

Delegate multi-agent orchestration to [`ruvnet/ruflo`](https://github.com/ruvnet/ruflo)
when it is installed, instead of improvising an in-session fan-out. ruflo is an
external orchestration **runtime** (swarms, persistent memory/RAG, an MCP server,
a hooks system, background workers). agent-config coexists with it (plugin-scope
hooks, see [`ruflo-coexistence`](../../../../docs/contracts/ruflo-coexistence.md))
and routes orchestration-shaped work to it.

## When to use

Use this skill when **both** hold:

1. ruflo is detected in the project (`claude-flow.config.json`,
   `ruflo-core@ruflo` in `enabledPlugins`, a `claude-flow` MCP server, or
   ruflo's `.claude/helpers/` scripts — same signals as
   `install.detect_ruflo`).
2. The task is orchestration-shaped: "spin up a swarm", "run these agents in
   parallel", "coordinate multiple agents", "use the swarm memory", "search
   past patterns", or it explicitly names a ruflo command / MCP tool.

Do **NOT** use when:

- ruflo is absent → use [`subagent-orchestration`](../subagent-orchestration/SKILL.md)
  (in-session implementer/judge fan-out, no network, no spend).
- The ask is a single-file edit, a bug fix, or a review → use the matching
  language/review skill directly.
- The user only wants MCP wiring in general → use [`mcp`](../mcp/SKILL.md).

## How ruflo and agent-config divide responsibility

> "ruflo coordinates, Claude Code creates." ruflo's MCP tools **coordinate**
> (topology, spawning, memory); Claude Code does the actual file work.

| Concern | Owner |
|---|---|
| Swarm topology, agent spawning, task routing | ruflo (MCP + hooks) |
| Cross-session memory / RAG / pattern search | ruflo (AgentDB) |
| File edits, code generation, command execution | Claude Code |
| Safety floors on the **main** agent (scope-control, non-destructive) | agent-config rules |
| Lifecycle observability hooks (chat-history, roadmap-progress, …) | agent-config (plugin scope) |

## ruflo MCP-tool surface (coordination only)

Call these on ruflo's MCP server (registered as `claude-flow`); they coordinate
and return plans/handles — Claude Code executes the resulting work.

| Tool | Purpose |
|---|---|
| `swarm_init` | Set topology (hierarchical / mesh / adaptive) + max agents |
| `agent_spawn` | Launch a typed agent (see persona map below) |
| `memory_store` / `memory_search_unified` | Write / semantic-search swarm memory |
| `memory_import_claude` | Bridge `~/.claude/projects/*/memory/*.md` into AgentDB |
| `memory_bridge_status` | Check the memory bridge health |

ruflo's docs claim the tool/agent counts vary by version — verify against the
installed `claude-flow.config.json` and `npx ruflo@latest mcp ...` rather than a
fixed number.

## Persona → ruflo agent-type map

When delegating, map agent-config's review lenses to ruflo's `subagent_type`:

| agent-config role / persona | ruflo agent type |
|---|---|
| `developer` | `coder` |
| `reviewer` | `reviewer` |
| `tester` | `tester` |
| `planner` | `planner` |
| `senior-engineer` / architecture lens | `architect` / `hierarchical-coordinator` |
| security lens | `security-auditor` |

The map is advisory — ruflo's exact agent roster is version-dependent; confirm
with ruflo before assuming a type exists.

## Procedure

1. **Confirm detection.** If ruflo is not detected, stop and use
   `subagent-orchestration` instead.
2. **Check the mode.** If `integrations.ruflo.mode: skip` is set, the developer
   opted out of agent-config's hooks — orchestration still routes to ruflo, but
   do not assume agent-config observability is running.
3. **Coordinate first, then create.** Call the ruflo MCP coordination tool
   (`swarm_init` / `agent_spawn`) and let Claude Code perform the file work the
   spawned agents request.
4. **Surface the governance limit** (below) whenever the swarm will act
   autonomously on the repo.

## Governance scope — the honest limit

```
agent-config's safety floors bind the MAIN Claude Code agent (rule-context).
They do NOT bind ruflo's autonomously spawned swarm subagents.
```

scope-control, non-destructive-by-default, and commit-policy are rules loaded
into the **main** agent's context. ruflo's swarm subagents run outside that
context and do not inherit those rules. Before authorizing an autonomous swarm
that writes to the repo, say so plainly: the main-agent gates do not cover the
swarm. For enforcement that survives this gap, a git-layer pre-commit gate is
the option under evaluation (road-to-ruflo-bridge Phase 7, gated).

## Do NOT

- Do NOT improvise an in-session swarm when ruflo is present — that defeats the
  point of the installed runtime.
- Do NOT claim agent-config governs ruflo's swarm agents. It governs the main
  agent only.
- Do NOT hard-code ruflo's tool/agent counts — they are version-dependent.
- Do NOT write agent-config hooks into `.claude/settings.json` to "coordinate"
  with ruflo — hooks ship via plugin scope; see `ruflo-coexistence`.

## See also

- [`ruflo-coexistence`](../../../../docs/contracts/ruflo-coexistence.md) — hook/MCP/memory coexistence contract.
- [`subagent-orchestration`](../subagent-orchestration/SKILL.md) — in-session (no network) alternative.
- [`mcp`](../mcp/SKILL.md) — generic MCP server wiring.
