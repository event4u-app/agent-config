---
name: copilot-agents
description: Copilot agents-doc orchestrator — routes to init, optimize
cluster: copilot-agents
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "create AGENTS.md, optimize copilot-instructions.md, scaffold copilot agent docs"
  trigger_context: "user wants to author or tune AGENTS.md / copilot-instructions.md"
---

# /copilot-agents

Top-level orchestrator for the `/copilot-agents` family. Replaces 2
standalone commands with a single entry point + sub-command dispatch.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/copilot-agents init` | `copilot-agents-init.md` | Create AGENTS.md and `.github/copilot-instructions.md` from scratch |
| `/copilot-agents optimize` | `copilot-agents-optimize.md` | Refactor existing AGENTS.md and copilot-instructions.md for line budgets |

Sub-command names match the locked contract in
[`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md).

## Dispatch

1. Parse the user's argument: `/copilot-agents <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the routed file and follow its `## Instructions` section
   verbatim with the remaining args.
4. If the sub-command is unknown or missing, print the table above and ask:

   > 1. init — scaffold AGENTS.md + copilot-instructions.md from scratch
   > 2. optimize — refactor existing files for budget and audience

## Migration

The 2 standalone `/copilot-agents-*` commands continue to work for one
release cycle as deprecation shims. New invocations should use
`/copilot-agents <sub>`.

## Rules

- **Do NOT commit, push, or open a PR** unless the sub-command explicitly
  authorizes it.
- **Do NOT chain sub-commands.** One `/copilot-agents <sub>` per turn.
- If the user invokes `/copilot-agents` with no argument, **show the
  menu** — do not guess which sub-command they meant.
