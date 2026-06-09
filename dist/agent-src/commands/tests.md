---
model_tier: medium
name: tests
disable-model-invocation: true
pack: engineering-base
tier: 2
description: Tests orchestrator — routes to create, execute
cluster: tests
type: orchestrator
auto_detect: true
suggestion:
  eligible: true
  trigger_description: "write tests for these changes, run the test suite"
  trigger_context: "user wants to author or run tests for the current branch"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /tests

Top-level orchestrator for the `/tests` family. Replaces 2 standalone
commands with a single entry point + sub-command dispatch.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/tests create` | `commands/tests/create.md` | Write meaningful tests for the changes in the current branch (stack-adaptive) |
| `/tests execute` | `commands/tests/execute.md` | Run the project's test suite — stack-adaptive (pest / phpunit / vitest / jest / pytest / …) |

Sub-command names match the locked contract in
[`docs/contracts/command-clusters.md`](../docs/contracts/command-clusters.md).
Both sub-commands resolve the runner via the
[`toolchain-resolver`](../contexts/execution/toolchain-resolver.md) — they
adapt to the consumer's stack instead of assuming one.

## Non-interactive & auto-detection

`/tests` honors the [`non-interactive-contract`](../contexts/execution/non-interactive-contract.md)
(surface detection, confidence tiers, `--yes`/`--json`, abort schemas,
the `auto_detect` kill-switch, rollback). Detection table:

| Basis (signal) | Sub-command | Confidence |
|---|---|---|
| Explicit sub given (`/tests create`) | that one | — (detection skipped) |
| "write/author tests", changed source files lack matching tests | `tests/create` | MEDIUM |
| "run/execute the suite", a test command/run is the intent | `tests/execute` | HIGH |
| No clear create-vs-run signal | — | LOW → menu (interactive) / `ambiguous_routing` (CI) |

create-vs-run is the only disambiguation: prefer `execute` when the
intent is to run an existing suite; `create` when authoring new tests.
Neither is destructive past the normal test-run side effects.

## Dispatch

1. Parse the user's argument: `/tests <sub-command> [args]`.
2. **Explicit sub** → look it up and route. Otherwise run the detection
   table above per the non-interactive-contract.
3. Load the body of the routed file and follow its `## Instructions` section
   verbatim with the remaining args.
4. On **LOW** confidence (or `--no-auto-detect`): interactive → print the
   table and ask; non-interactive → emit `ambiguous_routing` and stop.

   > 1. create — author tests for current-branch changes
   > 2. execute — run the test suite in Docker

## Rules

- **Do NOT commit, push, or open a PR** unless the sub-command explicitly
  authorizes it.
- **Do NOT chain sub-commands.** One `/tests <sub>` per turn.
- Auto-detection emits the structured pre-routing block before routing; on
  LOW confidence it shows the menu (interactive) or aborts (CI) — it
  **never** guesses past LOW.
