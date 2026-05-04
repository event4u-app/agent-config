---
name: override
description: Override orchestrator — routes to create, manage
cluster: override
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "create an override, manage existing overrides, refactor an override"
  trigger_context: "user wants to add or curate project-level overrides under agents/overrides/"
---

# /override

Top-level orchestrator for the `/override` family. Replaces 2 standalone
commands with a single entry point + sub-command dispatch.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/override create` | `commands/override/create.md` | Create a project-level override for a shared skill, rule, or command |
| `/override manage` | `commands/override/manage.md` | Review, update, and refactor existing overrides |

Sub-command names match the locked contract in
[`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md).

## Dispatch

1. Parse the user's argument: `/override <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the routed file and follow its `## Instructions` section
   verbatim with the remaining args.
4. If the sub-command is unknown or missing, print the table above and ask:

   > 1. create — author a new project-level override
   > 2. manage — review, update, refactor existing overrides

## Migration

The flat `/override-*` commands have been removed. Use `/override <sub>` instead.

## Rules

- **Do NOT commit, push, or open a PR** unless the sub-command explicitly
  authorizes it.
- **Do NOT chain sub-commands.** One `/override <sub>` per turn.
- If the user invokes `/override` with no argument, **show the menu** — do
  not guess which sub-command they meant.
