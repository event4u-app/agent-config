---
name: module
description: Module orchestrator — routes to create, explore
cluster: module
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "create a new module, explore an existing module"
  trigger_context: "user wants to scaffold or load a module's docs and structure"
---

# /module

Top-level orchestrator for the `/module` family. Replaces 2 standalone
commands with a single entry point + sub-command dispatch.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/module create` | `module-create.md` | Create a new module from `.module-template` |
| `/module explore` | `module-explore.md` | Load a module's structure, docs, and context into the conversation |

Sub-command names match the locked contract in
[`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md).

## Dispatch

1. Parse the user's argument: `/module <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the routed file and follow its `## Instructions` section
   verbatim with the remaining args.
4. If the sub-command is unknown or missing, print the table above and ask:

   > 1. create — scaffold a new module from the template
   > 2. explore — load a module's docs and structure

## Migration

The 2 standalone `/module-*` commands continue to work for one release
cycle as deprecation shims. New invocations should use `/module <sub>`.

## Rules

- **Do NOT commit, push, or open a PR** unless the sub-command explicitly
  authorizes it.
- **Do NOT chain sub-commands.** One `/module <sub>` per turn.
- If the user invokes `/module` with no argument, **show the menu** — do
  not guess which sub-command they meant.
