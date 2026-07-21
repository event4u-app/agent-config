---
model_tier: medium
name: worktree-create
pack: engineering-base
tier: 2
visibility: internal
cluster: worktree
sub: create
skills: [worktree-lifecycle, using-git-worktrees]
description: Create a governed worktree and write its scope-lock note — propose-once branch naming, host-native primitive preferred
argument-hint: "[task] [branch-name]"
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /worktree create
## Instructions

Thin orchestration — mechanics live in the skills; do not restate them.

### 1. Gate + create

Run [`using-git-worktrees`](../../../skills/using-git-worktrees/SKILL.md)
in full: `worktrees.mode` pre-flight, existing-worktree inspection,
directory convention, ignore-safety check, worktree creation,
dependency install + clean baseline. Its Iron Law (no worktree without
verified ignore + clean baseline) is the creation gate.

Prefer the host-native primitive when available (Claude Code
`EnterWorktree`; subagent `isolation: "worktree"` for delegated
slices) — see
[`worktree-lifecycle § Host-native mapping`](../../../skills/worktree-lifecycle/SKILL.md#host-native-mapping).
Without a primitive, the skill's plain `git worktree add` path applies.

### 2. Branch naming — propose once

Derive ONE branch name from the task (`<type>/<short-slug>` per the
`commit-conventions` rule), state it, and proceed. Do not present a
naming menu; the user can override by naming a branch in the same turn.

### 3. Write the scope-lock note

Write `.worktree-scope.md` at the new worktree root per
[`worktree-lifecycle § Scope lock`](../../../skills/worktree-lifecycle/SKILL.md#2-scope-lock)
(branch, `owns:` paths, task line, date) and ensure
`.git/info/exclude` carries the `.worktree-scope.md` line.

### 4. Report

Use the [`worktree-lifecycle § Output format`](../../../skills/worktree-lifecycle/SKILL.md#output-format):
worktree path + branch + `owns:` list, baseline state, next step. If the project
declares an `env-bootstrap` entry (see [`using-git-worktrees § 5`](../../../skills/using-git-worktrees/SKILL.md)),
name it as the suggested next action — suggest, never auto-run.

### Rules

- **Do NOT commit or push.**
- Worktree creation stays permission-gated per `scope-control` unless
  `worktrees.mode: on` grants standing permission (skill § 0).
