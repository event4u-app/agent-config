---
model_tier: medium
name: project
disable-model-invocation: true
argument-hint: "[analyze|health]"
pack: engineering-base
intent: "Project dispatcher — full analysis or quick health check"
routes_to: [project-analyze, project-health]
replaces: []
tier: 2
visibility: internal
description: Project orchestrator — routes to analyze (full audit) and health (read-only status check)
cluster: project
type: orchestrator
suggestion:
  eligible: true
  trigger_description: "analyze this project, check the project state, how healthy is this repo"
  trigger_context: "user asks about the project as a whole without picking full-audit vs quick-check"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /project

Top-level orchestrator for the `/project` family — project-wide inspection.

> Looking for a **project-wide optimization sweep** (challenge roadmaps,
> ADRs, decisions, emit new roadmaps)? That is
> [`/optimize project`](optimize/project.md).

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/project analyze` | `commands/project/analyze.md` | Full project analysis — detect stack, inventory modules, audit docs, create missing contexts |
| `/project health` | `commands/project/health.md` | Quick health check — status of docs, modules, contexts, roadmaps; creates nothing |

Sub-command names match the locked contract in
[`docs/contracts/command-clusters.md`](../docs/contracts/command-clusters.md).

## Dispatch

1. Parse the user's argument: `/project <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the corresponding `commands/project/<sub>.md` file and
   follow its `## Instructions` (or `## Steps`) section verbatim.
4. If the sub-command is unknown or missing, print the menu and ask — do not
   guess:

   > 1. analyze — full project audit (writes missing contexts)
   > 2. health — read-only status check (creates nothing)

## Rules

- **`health` is read-only.** It never creates or modifies files; `analyze`
  may create missing context docs and says so before writing.
- **Do NOT chain sub-commands.** One `/project <sub>` per turn.
- If the user invokes `/project` with no argument, **show the menu** — do not
  guess which sub-command they meant.
