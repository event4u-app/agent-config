---
name: optimize
description: Optimize orchestrator — routes to skills, agents, augmentignore, rtk-filters
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "optimize my skills, audit agents, tune augmentignore, optimize rtk filters"
  trigger_context: "maintainer auditing or trimming agent infrastructure"
---

# /optimize

Top-level orchestrator for the `/optimize` family. Replaces 4 standalone
commands with a single entry point + sub-command dispatch.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/optimize skills` | `optimize-skills.md` | Audit skills — measure baseline, find duplicates, run linter |
| `/optimize agents` | `optimize-agents.md` | Audit agent infrastructure — token overhead, rule triggers, AGENTS.md |
| `/optimize augmentignore` | `optimize-augmentignore.md` | Create or refine `.augmentignore` based on actual stack |
| `/optimize rtk-filters` | `optimize-rtk-filters.md` | Create or refine project-local rtk filters |

## Dispatch

1. Parse the user's argument: `/optimize <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the corresponding `commands/optimize-<sub>.md` file and
   follow its `## Steps` (or `## Instructions`) section verbatim.
4. If the sub-command is unknown or missing, print the menu and ask:

   > 1. skills — audit skills (find duplicates, run linter)
   > 2. agents — audit agent infrastructure (token overhead, rule triggers)
   > 3. augmentignore — create or refine `.augmentignore`
   > 4. rtk-filters — create or refine project-local rtk filters

## Migration

The 4 standalone `/optimize-*` commands continue to work for one release
cycle as deprecation shims. They emit a notice and route to the same
content. New invocations should use `/optimize <sub>`.

## Rules

- **Suggest only — never auto-apply.** All `/optimize` sub-commands are
  audit-grade: they report and propose, but the user approves every change.
- **Do NOT chain sub-commands.** One `/optimize <sub>` per turn.
- If the user invokes `/optimize` with no argument, **show the menu** — do
  not guess which sub-command they meant.
