---
name: agents
description: Agent-layer orchestrator — routes to init, optimize, audit. Covers AGENTS.md and its multi-tool stubs (CLAUDE.md, GEMINI.md, copilot-instructions.md, .cursorrules).
cluster: agents
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "initialize agent layer, optimize AGENTS.md, audit agent infrastructure, AGENTS.md health-check"
  trigger_context: "user wants to bootstrap, refactor, or health-check the agent layer (AGENTS.md + tool stubs + rules + skills)"
---

# /agents

Top-level orchestrator for the `/agents` family — the **file-family
cluster**: `AGENTS.md`, its multi-tool stubs (`CLAUDE.md`, `GEMINI.md`,
`.github/copilot-instructions.md`, `.cursorrules`), and the surrounding
agent infrastructure (rules, skills, pointers).

> Looking for `agents/` folder operations (scaffold, folder-audit,
> folder-cleanup)? Those live under [`/optimize agents-dir`](optimize/agents-dir.md).

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/agents init` | `commands/agents/init.md` | Bootstrap the agent layer — create `AGENTS.md` + tool stubs from the canonical template |
| `/agents optimize` | `commands/agents/optimize.md` | Refactor `AGENTS.md` to the Thin-Root contract; propagate to multi-tool stubs |
| `/agents audit` | `commands/agents/audit.md` | Read-only health check — token overhead, rule triggers, AGENTS.md health, stale references |

Sub-command names match the locked contract in
[`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md).

## Dispatch

1. Parse the user's argument: `/agents <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the routed file and follow its `## Steps` section
   verbatim with the remaining args.
4. If the sub-command is unknown or missing, print the table above and ask:

   > 1. init — bootstrap AGENTS.md + tool stubs
   > 2. optimize — refactor AGENTS.md to the Thin-Root contract
   > 3. audit — read-only health check on the agent layer

## Rules

- **Do NOT commit, push, or open a PR** unless the sub-command explicitly
  authorizes it.
- **Do NOT chain sub-commands.** One `/agents <sub>` per turn.
- If the user invokes `/agents` with no argument, **show the menu** — do
  not guess which sub-command they meant.
- **Edit `.agent-src.uncompressed/` only.** `.agent-src/` and `.augment/`
  regenerate from source.
