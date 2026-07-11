---
model_tier: medium
name: worktree-status
pack: engineering-base
tier: 2
visibility: internal
cluster: worktree
sub: status
skills: [worktree-lifecycle, git-workflow]
description: List active worktrees — ownership (scope lock), dirty state, ahead/behind, merge-readiness incl. verification evidence
suggestion:
  eligible: true
  trigger_description: "which worktrees are active, is this worktree merge-ready, worktree overview"
  trigger_context: "git worktree list shows more than the main working tree"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /worktree status
## Instructions

Read-only report — never mutates a worktree, a branch, or the remote.

### 1. Enumerate

```bash
git worktree list --porcelain
```

One report block per worktree (skip the main working tree unless asked).

### 2. Per worktree, gather

- **Ownership** — read `.worktree-scope.md` (`owns:` + task line);
  missing note → report "no scope lock" as a finding, per
  [`worktree-lifecycle § Scope lock`](../../../skills/worktree-lifecycle/SKILL.md#2-scope-lock).
- **Dirty state** — `git status --porcelain` in that worktree.
- **Ahead/behind** — `git fetch origin --quiet` once, then
  `git rev-list --left-right --count <branch>...origin/<base>` (live
  values only, per [`git-workflow`](../../../skills/git-workflow/SKILL.md)
  § Live remote state first). Divergent → name it and point to
  git-workflow § Divergent-State Recovery; do not resolve here.
- **Verification evidence** — present/absent per the run's `/worktree
  verify` record; absent → "none attached", never inferred.

After the per-worktree blocks, run the cross-worktree overlap scan once:

```bash
./scripts-run src/scripts/worktree_cleanup_check scope-overlap
```

Exit `1` → two live scope locks own overlapping paths (e.g.
`src/middleware/**` × `src/middleware/stack.ts`). Surface the pairs as a
hazard: neither worktree is merge-ready while the same path is owned by
both — the user decides (split ownership, sequence the tasks, or re-cut
scope). Never let both silently edit the shared file.

### 3. Merge-readiness verdict

Apply the five-point checklist from
[`worktree-lifecycle § Status / merge-ready checklist`](../../../skills/worktree-lifecycle/SKILL.md#3-status--merge-ready-checklist)
and name the first failing item for every not-ready worktree.

### 4. Report

Use the [`worktree-lifecycle § Output format`](../../../skills/worktree-lifecycle/SKILL.md#output-format)
per worktree, then one summary line: `<N> worktrees — <M> merge-ready`.

### Rules

- **Do NOT commit, push, merge, or remove anything.** Status is read-only.
- Never report merge-ready without attached verification evidence
  (checklist item 3) — "diff looks fine" is not evidence.
