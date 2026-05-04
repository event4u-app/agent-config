---
name: roadmap
description: Roadmap orchestrator — routes to create, execute
cluster: roadmap
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "create a roadmap, execute a roadmap, plan a roadmap interactively"
  trigger_context: "user wants to scaffold or run a roadmap under agents/roadmaps/"
---

# /roadmap

Top-level orchestrator for the `/roadmap` family. Replaces 2 standalone
commands with a single entry point + sub-command dispatch.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/roadmap create` | `commands/roadmap/create.md` | Interactively create a new roadmap in `agents/roadmaps/` |
| `/roadmap execute` | `commands/roadmap/execute.md` | Read and interactively execute a roadmap |

Sub-command names match the locked contract in
[`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md).

## Dispatch

1. Parse the user's argument: `/roadmap <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the routed file and follow its `## Instructions` section
   verbatim with the remaining args.
4. If the sub-command is unknown or missing, print the table above and ask:

   > 1. create — scaffold a new roadmap interactively
   > 2. execute — run an existing roadmap step by step

## Rules

- **Do NOT commit, push, or open a PR** unless the sub-command explicitly
  authorizes it.
- **Do NOT chain sub-commands.** One `/roadmap <sub>` per turn.
- If the user invokes `/roadmap` with no argument, **show the menu** — do
  not guess which sub-command they meant.
