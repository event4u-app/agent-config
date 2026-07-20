---
model_tier: medium
name: worktree-cleanup
pack: engineering-base
tier: 2
visibility: internal
cluster: worktree
sub: cleanup
skills: [worktree-lifecycle, git-workflow]
description: Safe worktree removal gate — refuses while the branch holds commits on no other ref; never force-deletes
argument-hint: "[worktree-path]"
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /worktree cleanup
## Instructions

Safe-removal gate over
[`worktree-lifecycle § Cleanup discipline`](../../../skills/worktree-lifecycle/SKILL.md#4-cleanup-discipline).
Removal only — this command never merges, never deletes branches, and
never force-removes.

### 1. Candidates

`git worktree list --porcelain` — target the worktree(s) named by the
user, or every non-main worktree when asked to "clean up".

### 2. Per candidate, run the gates IN ORDER

Run the deterministic gate helper (edge-case-tested: detached HEAD,
branch without remote, tag-only reachability, deleted remote branch,
untracked files, paths with spaces — `tests/scripts/worktree_cleanup_check.test.ts`):

```bash
./scripts-run src/scripts/worktree_cleanup_check check <worktree-path>
```

Exit `0` → removal allowed. Exit `1` → **refuse** that candidate; the
output names the exact gate:

1. **Detached HEAD** — no branch to judge reachability for; resolve the
   state manually first.
2. **Unsaved work** — `git status --porcelain` non-empty (untracked
   files count as work). Never `git worktree remove --force`.
3. **Unique commits** — commits reachable from the worktree branch but
   from no other ref (branches, remotes, AND tags — a tag counts as
   reachability). The branch holds work that exists nowhere else:
   surface the commit list and hand the decision back — dropping
   commits the session did not author is forbidden by the
   `git-history-discipline` rule (shared-branch Iron Law); merging or
   preserving them is the user's call.

### 3. Remove the allowed candidates

```bash
git worktree remove <path>
git worktree prune
```

Branch deletion is NOT part of cleanup — it is a separate,
permission-gated git op (`scope-control`); if the user wants it, the
merged-only form (`git branch -d`) applies, never `-D`.

### 4. Report

Use the [`worktree-lifecycle § Output format`](../../../skills/worktree-lifecycle/SKILL.md#output-format):
per candidate — removed, or refused with the exact gate that fired
(dirty files, or the unique-commit list verbatim).

### Rules

- **Refusal is the success path** when a gate fires — never retry with
  `--force`, `-D`, or a reset to make removal "work".
- **Do NOT delete branches, commit, or push.**
- Host-auto-cleaned subagent worktrees (`isolation: "worktree"`) that
  left a branch behind still pass through gate 2 before that branch is
  touched.
