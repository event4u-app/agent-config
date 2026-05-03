---
name: tests
description: Tests orchestrator — routes to create, execute
cluster: tests
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "write tests for these changes, run the test suite"
  trigger_context: "user wants to author or run tests for the current branch"
---

# /tests

Top-level orchestrator for the `/tests` family. Replaces 2 standalone
commands with a single entry point + sub-command dispatch.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/tests create` | `tests-create.md` | Write meaningful tests for the changes in the current branch |
| `/tests execute` | `tests-execute.md` | Run PHP tests inside the Docker container |

Sub-command names match the locked contract in
[`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md).

## Dispatch

1. Parse the user's argument: `/tests <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the routed file and follow its `## Instructions` section
   verbatim with the remaining args.
4. If the sub-command is unknown or missing, print the table above and ask:

   > 1. create — author tests for current-branch changes
   > 2. execute — run the test suite in Docker

## Migration

The 2 standalone `/tests-*` commands continue to work for one release
cycle as deprecation shims. New invocations should use `/tests <sub>`.

## Rules

- **Do NOT commit, push, or open a PR** unless the sub-command explicitly
  authorizes it.
- **Do NOT chain sub-commands.** One `/tests <sub>` per turn.
- If the user invokes `/tests` with no argument, **show the menu** — do
  not guess which sub-command they meant.
