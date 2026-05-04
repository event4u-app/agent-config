---
name: agents
description: Agents-folder orchestrator — routes to audit, cleanup, prepare
cluster: agents
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "audit agents folder, prepare agents structure, clean up agent docs"
  trigger_context: "user wants to inspect, scaffold, or curate the agents/ tree"
---

# /agents

Top-level orchestrator for the `/agents` family. Replaces 3 standalone
commands with a single entry point + sub-command dispatch.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/agents audit` | `commands/agents/audit.md` | Audit `agents/` for outdated docs, duplicates, orphaned overrides |
| `/agents cleanup` | `commands/agents/cleanup.md` | Execute cleanup actions from a prior audit |
| `/agents prepare` | `commands/agents/prepare.md` | Scaffold the `agents/` directory structure |

Sub-command names match the locked contract in
[`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md).

## Dispatch

1. Parse the user's argument: `/agents <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the routed file and follow its `## Instructions` section
   verbatim with the remaining args.
4. If the sub-command is unknown or missing, print the table above and ask:

   > 1. audit — find outdated docs, duplicates, orphaned overrides
   > 2. cleanup — execute actions from a prior audit
   > 3. prepare — scaffold the agents/ tree

## Rules

- **Do NOT commit, push, or open a PR** unless the sub-command explicitly
  authorizes it.
- **Do NOT chain sub-commands.** One `/agents <sub>` per turn.
- If the user invokes `/agents` with no argument, **show the menu** — do
  not guess which sub-command they meant.
