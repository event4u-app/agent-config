---
model_tier: medium
name: tests
disable-model-invocation: true
argument-hint: "[create|execute|e2e-plan|e2e-heal] [args]"
pack: engineering-base
tier: 2
visibility: internal
description: Tests orchestrator — routes to create, execute, e2e-plan, e2e-heal
cluster: tests
routes_to: [tests-create, tests-execute, tests-e2e-plan, tests-e2e-heal]
type: orchestrator
auto_detect: true
suggestion:
  eligible: true
  trigger_description: "write tests for these changes, run the test suite, plan E2E coverage, fix failing playwright tests"
  trigger_context: "user wants to author or run tests for the current branch, or plan/heal Playwright E2E coverage"
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
| `/tests e2e-plan` | `commands/tests/e2e-plan.md` | Explore the application and create a structured E2E test plan in Markdown |
| `/tests e2e-heal` | `commands/tests/e2e-heal.md` | Find, debug, and fix failing Playwright E2E tests |

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
| "plan E2E coverage", new feature/page without `tests/e2e/` coverage | `tests/e2e-plan` | HIGH |
| Failing Playwright output in context, "fix the E2E tests" | `tests/e2e-heal` | HIGH |
| No clear signal | — | LOW → menu (interactive) / `ambiguous_routing` (CI) |

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
   > 3. e2e-plan — explore the app and write a structured E2E test plan
   > 4. e2e-heal — find, debug, and fix failing Playwright tests

## Rules

- **Do NOT commit, push, or open a PR** unless the sub-command explicitly
  authorizes it.
- **Do NOT chain sub-commands.** One `/tests <sub>` per turn.
- Auto-detection emits the structured pre-routing block before routing; on
  LOW confidence it shows the menu (interactive) or aborts (CI) — it
  **never** guesses past LOW.
