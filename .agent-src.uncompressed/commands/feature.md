---
name: feature
description: Feature orchestrator — routes to explore, plan, refactor, roadmap, dev
cluster: feature
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "explore feature idea, plan a feature, refactor feature plan, roadmap a feature, full feature dev"
  trigger_context: "user starting or iterating on a feature workflow"
---

# /feature

Top-level orchestrator for the `/feature` family. Replaces 5 standalone
commands with a single entry point + sub-command dispatch.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/feature explore` | `feature-explore.md` | Brainstorm an idea before committing to a plan |
| `/feature plan` | `feature-plan.md` | Interactively plan a feature, produce a structured plan doc |
| `/feature refactor` | `feature-refactor.md` | Refine and update an existing feature plan |
| `/feature roadmap` | `feature-roadmap.md` | Generate implementation roadmap(s) from a plan |
| `/feature dev` | `feature-dev.md` | Full 7-phase feature development workflow (heavyweight) |

## Workflow ordering

Typical sequence: `explore` → `plan` → `roadmap` → `dev` (or per-step
implementation). Use `refactor` whenever an existing plan needs an update.

## Dispatch

1. Parse the user's argument: `/feature <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the corresponding `commands/feature-<sub>.md` file and
   follow its `## Instructions` (or `## Steps`) section verbatim.
4. If the sub-command is unknown or missing, print the menu and ask:

   > 1. explore — brainstorm a feature idea
   > 2. plan — produce a structured feature plan
   > 3. refactor — update an existing feature plan
   > 4. roadmap — generate roadmap(s) from a plan
   > 5. dev — run the full 7-phase development workflow

## Migration

The 5 standalone `/feature-*` commands continue to work for one release
cycle as deprecation shims. They emit a notice and route to the same
content. New invocations should use `/feature <sub>`.

## Rules

- **Do NOT chain sub-commands.** One `/feature <sub>` per turn — except
  the agent may suggest the next logical sub-command at the end of a step
  (numbered options per `user-interaction`).
- If the user invokes `/feature` with no argument, **show the menu** — do
  not guess which sub-command they meant.
