---
name: context
description: Context orchestrator — routes to create, refactor
cluster: context
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "create a context document, update an existing context, refactor a context file"
  trigger_context: "user wants to author or restructure a context document"
---

# /context

Top-level orchestrator for the `/context` family. Replaces 2 standalone
commands with a single entry point + sub-command dispatch.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/context create` | `context-create.md` | Analyze a codebase area and create a structured context document |
| `/context refactor` | `context-refactor.md` | Analyze, update, and extend an existing context document |

Sub-command names match the locked contract in
[`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md).

## Dispatch

1. Parse the user's argument: `/context <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the routed file and follow its `## Instructions` section
   verbatim with the remaining args.
4. If the sub-command is unknown or missing, print the table above and ask:

   > 1. create — author a new context document
   > 2. refactor — update an existing context document

## Migration

The 2 standalone `/context-*` commands continue to work for one release
cycle as deprecation shims. New invocations should use `/context <sub>`.

## Rules

- **Do NOT commit, push, or open a PR** unless the sub-command explicitly
  authorizes it.
- **Do NOT chain sub-commands.** One `/context <sub>` per turn.
- If the user invokes `/context` with no argument, **show the menu** — do
  not guess which sub-command they meant.
