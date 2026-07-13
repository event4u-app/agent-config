---
model_tier: medium
name: worktree
disable-model-invocation: true
argument-hint: "[create|status|verify|cleanup] [args]"
pack: engineering-base
tier: 2
visibility: internal
description: Worktree orchestrator — routes to create, status, verify, cleanup
cluster: worktree
type: orchestrator
auto_detect: true
suggestion:
  eligible: true
  trigger_description: "isolate this in a worktree, which worktrees are active, is the worktree merge-ready, clean up finished worktrees"
  trigger_context: "parallel work needs an isolated working directory, or existing worktrees need status/verification/removal"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /worktree

Top-level orchestrator for the governed-worktree family — a THIN layer
over host-native primitives (Claude Code `EnterWorktree`/`ExitWorktree`,
subagent `isolation: "worktree"`) and plain `git worktree` elsewhere.
Explicitly OUT of scope: auto-merge, daemons, background watchers,
dispatch beyond the existing subagent worktree isolation.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/worktree create` | `commands/worktree/create.md` | Create a governed worktree + write the scope-lock note (propose-once branch naming) |
| `/worktree status` | `commands/worktree/status.md` | List active worktrees — ownership, dirty state, ahead/behind, merge-readiness incl. verification evidence |
| `/worktree verify` | `commands/worktree/verify.md` | Run the scoped verification for the worktree's declared change — narrow probes, not full CI |
| `/worktree cleanup` | `commands/worktree/cleanup.md` | Safe removal gate — refuses while the branch has commits on no other ref |

All four route through the
[`worktree-lifecycle`](../../skills/worktree-lifecycle/SKILL.md) skill;
creation mechanics live in
[`using-git-worktrees`](../../skills/using-git-worktrees/SKILL.md).

## Non-interactive & auto-detection

`/worktree` honors the [`non-interactive-contract`](../contexts/execution/non-interactive-contract.md)
(surface detection, confidence tiers, `--yes`/`--json`, abort schemas,
the `auto_detect` kill-switch). Detection table:

| Basis (signal) | Sub-command | Confidence |
|---|---|---|
| Explicit sub given (`/worktree status`) | that one | — (detection skipped) |
| "isolate / do this on the side / new worktree for X" | `worktree/create` | HIGH |
| "which worktrees / what's active / merge-ready?" | `worktree/status` | HIGH |
| "verify the worktree change", scoped probe intent | `worktree/verify` | MEDIUM |
| "remove / clean up the worktree(s)" | `worktree/cleanup` | HIGH |
| No clear signal | — | LOW → menu (interactive) / `ambiguous_routing` (CI) |

`cleanup` is the only destructive sub-command — on MEDIUM-or-lower
confidence it is never auto-selected; show the menu instead.

## Dispatch

1. Parse the user's argument: `/worktree <sub-command> [args]`.
2. **Explicit sub** → look it up and route. Otherwise run the detection
   table above per the non-interactive-contract.
3. Load the body of the routed file and follow its `## Instructions`
   section verbatim with the remaining args.
4. On **LOW** confidence (or `--no-auto-detect`): interactive → print
   the menu and ask; non-interactive → emit `ambiguous_routing` and stop.

   > 1. create — new governed worktree + scope-lock note
   > 2. status — list worktrees with merge-readiness
   > 3. verify — run the scoped verification for a worktree
   > 4. cleanup — safely remove finished worktrees

## Rules

- **Do NOT commit, push, or open a PR** unless the sub-command
  explicitly authorizes it.
- **Do NOT chain sub-commands.** One `/worktree <sub>` per turn.
- **No auto-merge, no watchers.** The cluster reports and gates; the
  user (or an explicitly invoked command) merges.
- Auto-detection never guesses past LOW, and never auto-selects
  `cleanup` below HIGH confidence.
