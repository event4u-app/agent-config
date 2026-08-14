---
model_tier: medium
name: optimize
disable-model-invocation: true
argument-hint: "[skills|agents-dir|augmentignore|rtk|project|prompt|deep] [args]"
pack: meta
intent: "Optimization dispatcher — skills, rtk, augmentignore, agents-dir, project sweep, prompt, deep autonomous loop"
routes_to: [optimize-skills, optimize-rtk, optimize-augmentignore, optimize-agents-dir, optimize-project, optimize-prompt, optimize-deep]
replaces: []
visibility: advanced
description: Optimize orchestrator — routes to skills, agents-dir, augmentignore, rtk-filters, project (project-wide sweep), prompt (AI-prompt polish), deep (autonomous deep-refactoring loop)
cluster: optimize
type: orchestrator
suggestion:
  eligible: true
  trigger_description: "optimize my skills, manage agents directory, tune augmentignore, optimize rtk filters, optimize this project, optimize this prompt, run a deep optimization pass"
  trigger_context: "maintainer auditing/trimming the agent layer, running a project-wide optimization sweep, or polishing an AI prompt (NOT AGENTS.md — that's /agents)"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /optimize

Top-level orchestrator for the `/optimize` family — spanning three scopes:
the **agent layer** (skills, agents-dir, augmentignore, rtk), the **project**
(`project` — challenge-and-roadmap sweep over roadmaps/ADRs/decisions), and a
**single prompt** (`prompt`).

> Looking for `AGENTS.md` operations (init, refactor, audit)? Those
> live under [`/agents`](agents.md) (`init / optimize / audit`).

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/optimize skills` | `commands/optimize/skills.md` | Audit skills — measure baseline, find duplicates, run linter |
| `/optimize agents-dir` | `commands/optimize/agents-dir.md` | Manage the `agents/` directory — `--scaffold` / `--audit` / `--fix` (interactive wizard if no flag) |
| `/optimize augmentignore` | `commands/optimize/augmentignore.md` | Create or refine `.augmentignore` based on actual stack |
| `/optimize rtk` | `commands/optimize/rtk.md` | Create or refine project-local rtk filters |
| `/optimize project` | `commands/optimize/project.md` | Project-wide optimization sweep — inventory roadmaps/ADRs/agent folders, challenge stale decisions, emit new roadmap(s) |
| `/optimize prompt` | `commands/optimize/prompt.md` | Optimize a raw prompt for ChatGPT/Claude/Gemini via the 4-D methodology |
| `/optimize deep` | `commands/optimize/deep.md` | Autonomous deep-refactoring loop — subagent analysis, council, central + sub-roadmaps, PR, N refinement loops (default 3) |

Sub-command names match the locked contract in
[`docs/contracts/command-clusters.md`](../docs/contracts/command-clusters.md).

## Dispatch

1. Parse the user's argument: `/optimize <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the corresponding `commands/optimize/<sub>.md` file and
   follow its `## Steps` (or `## Instructions`) section verbatim.
4. If the sub-command is unknown or missing, print the menu and ask:

   > 1. skills — audit skills (find duplicates, run linter)
   > 2. agents-dir — scaffold / audit / fix the `agents/` tree
   > 3. augmentignore — create or refine `.augmentignore`
   > 4. rtk — create or refine project-local rtk filters
   > 5. project — project-wide sweep (roadmaps, ADRs, decisions → new roadmaps)
   > 6. prompt — polish a raw AI prompt (4-D methodology)
   > 7. deep — autonomous deep-refactoring loop (analysis → council → roadmaps → PR → refine ×N)

## Rules

- **Suggest only — never auto-apply.** All `/optimize` sub-commands are
  audit-grade: they report and propose, but the user approves every change.
  Exception: `deep` is the explicitly autonomous variant — invoking it IS the
  approval for its worktree/branch/roadmap/PR flow; the Hard Floor
  (merge/deploy/prod/bulk-delete) still gates inside it.
- **Scope check before routing.** Agent-layer subs (1–4) never touch project
  code or roadmaps; `project` never rewrites the agent layer; `prompt` only
  returns a rewritten prompt; `deep` writes roadmaps + a PR branch but never
  merges.
- **Do NOT chain sub-commands.** One `/optimize <sub>` per turn.
- If the user invokes `/optimize` with no argument, **show the menu** — do
  not guess which sub-command they meant.
