---
name: memory
description: Memory orchestrator — routes to add, load, promote, propose
cluster: memory
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "add a memory entry, load all memories, promote a signal, propose a finding"
  trigger_context: "user wants to write to or curate engineering memory"
---

# /memory

Top-level orchestrator for the `/memory` family. Replaces 4 standalone
commands with a single entry point + sub-command dispatch.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/memory add` | `memory-add.md` | Interactively add a validated entry to a memory file |
| `/memory load` | `memory-full.md` | Load ALL curated entries of a given memory type into context |
| `/memory promote` | `memory-promote.md` | Promote an intake signal to a curated memory entry |
| `/memory propose` | `propose-memory.md` | Append a provisional signal to the intake stream |

Sub-command names match the locked contract in
[`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md).

## Dispatch

1. Parse the user's argument: `/memory <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the routed file and follow its `## Instructions` section
   verbatim with the remaining args.
4. If the sub-command is unknown or missing, print the table above and ask:

   > 1. add — write a curated entry interactively
   > 2. load — load ALL entries of a type for deep analysis
   > 3. promote — promote an intake signal to a curated entry
   > 4. propose — drop a provisional signal into the intake stream

## Migration

The 4 standalone commands (`/memory-add`, `/memory-full`,
`/memory-promote`, `/propose-memory`) continue to work for one release
cycle as deprecation shims. New invocations should use `/memory <sub>`.

## Rules

- **Do NOT commit, push, or open a PR** unless the sub-command explicitly
  authorizes it.
- **Do NOT chain sub-commands.** One `/memory <sub>` per turn.
- If the user invokes `/memory` with no argument, **show the menu** — do
  not guess which sub-command they meant.
