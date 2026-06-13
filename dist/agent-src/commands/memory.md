---
model_tier: medium
name: memory
disable-model-invocation: true
pack: memory
intent: "Manage the agent memory layer — add, load, promote, propose"
routes_to: [memory-add, memory-load, memory-promote, memory-propose]
replaces: []
tier: 1
visibility: advanced
description: Memory orchestrator — routes to add, load, mine-session, promote, propose
cluster: memory
type: orchestrator
suggestion:
  eligible: true
  trigger_description: "add a memory entry, load all memories, promote a signal, propose a finding"
  trigger_context: "user wants to write to or curate engineering memory"
workspaces:
  - agent-config-maintainer
packs:
  - memory
---

# /memory

Top-level orchestrator for the `/memory` family. Replaces 4 standalone
commands with a single entry point + sub-command dispatch.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/memory add` | `commands/memory/add.md` | Interactively add a validated entry to a memory file |
| `/memory load` | `commands/memory/load.md` | Load ALL curated entries of a given memory type into context |
| `/memory mine-session` | `commands/memory/mine-session.md` | Mine the active session transcript for memory signals (preview-by-default) |
| `/memory promote` | `commands/memory/promote.md` | Promote an intake signal to a curated memory entry |
| `/memory propose` | `commands/memory/propose.md` | Append a provisional signal to the intake stream |

Sub-command names match the locked contract in
[`docs/contracts/command-clusters.md`](../docs/contracts/command-clusters.md).

## Dispatch

1. Parse the user's argument: `/memory <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the routed file and follow its `## Instructions` section
   verbatim with the remaining args.
4. If the sub-command is unknown or missing, print the table above and ask:

   > 1. add — write a curated entry interactively
   > 2. load — load ALL entries of a type for deep analysis
   > 3. mine-session — preview signals from the active session transcript
   > 4. promote — promote an intake signal to a curated entry
   > 5. propose — drop a provisional signal into the intake stream

## Rules

- **Do NOT commit, push, or open a PR** unless the sub-command explicitly
  authorizes it.
- **Do NOT chain sub-commands.** One `/memory <sub>` per turn.
- If the user invokes `/memory` with no argument, **show the menu** — do
  not guess which sub-command they meant.
