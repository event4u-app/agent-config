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

1. **Analyze the existing ruflo setup before spawning anything.** Read
   `claude-flow.config.json` (topology, max agents, strategy) and probe the
   live swarm/memory state (`memory_bridge_status`) — never assume a topology
   or `subagent_type` exists. If ruflo is not detected at all, stop and use
   `subagent-orchestration` instead. Do not delegate to a runtime you have not
   inspected.
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

## Output format

When delegating to ruflo, the response MUST, in order:

1. Name the **detection signal** that confirmed ruflo (so the user can audit why coexistence engaged).
2. Name the **ruflo MCP tool(s)** called and the **agent type(s)** spawned (per the map above).
3. State which work **Claude Code performs** vs. what **ruflo coordinates**.
4. Surface the **governance-scope caveat** whenever the swarm will act autonomously on the repo.

Never claim the swarm ran without naming the coordination tool that launched it.

## Gotchas

- **Assuming an agent type exists.** ruflo's roster is version-dependent; `agent_spawn` with an unknown `subagent_type` mis-routes or fails silently. Confirm the type against the live setup before spawning.
- **Hard-coding tool/agent counts.** The docs claim differing numbers per version; baking a stale count into a plan breaks on upgrade. Read `claude-flow.config.json` / the live MCP surface instead.
- **Governance theatre.** Believing agent-config's safety floors gate the swarm — they gate the **main** agent only; swarm subagents run uninstrumented. Say so before authorizing autonomous repo writes.
- **Improvising in-session despite ruflo present.** Reaching for `subagent-orchestration` when ruflo is installed wastes the runtime and splits memory across two systems.
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
