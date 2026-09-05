---
model_tier: medium
name: worktree-lifecycle
description: "Use when governing a worktree across its whole life — scope-lock declaration, merge-readiness status, scoped verification, and safe cleanup that refuses while unique unmerged commits exist."
domain: process
workspaces:
  - engineering
packs:
  - engineering-base
---

# worktree-lifecycle

Governance layer for worktrees that already exist (or are about to).
Creation mechanics — directory convention, ignore-safety, clean
baseline — live in [`using-git-worktrees`](../using-git-worktrees/SKILL.md)
and are **referenced, never restated** here. This skill owns everything
after the spawn: what the worktree is allowed to touch, when it is
merge-ready, and when it may be removed.

## When to use

* Deciding whether a task should be isolated in a worktree at all
* Declaring **which paths a worktree owns** so parallel agents stay disjoint
* Answering "is this worktree merge-ready?" — status, dirty state,
  ahead/behind, verification evidence
* Running the scoped verification for a worktree's declared change
* Removing a finished worktree without losing commits

Do NOT use when:

* Creating the worktree — that is [`using-git-worktrees`](../using-git-worktrees/SKILL.md)
  (Iron Law: no worktree without verified ignore + clean baseline)
* Plain branch work (switch, rebase, PR) without worktree isolation —
  [`git-workflow`](../git-workflow/SKILL.md)
* Picking a subagent-orchestration mode — `subagent-orchestration`
  selects the mode; this skill governs the worktrees a chosen mode uses

## The Iron Law

```
EVERY GOVERNED WORKTREE DECLARES ITS SCOPE. NO REMOVAL WHILE
UNIQUE UNMERGED COMMITS EXIST. INHERITED COMMITS ARE NEVER DROPPED.
```

## Procedure

### 1. Decide isolation

Isolate when **any** holds; otherwise stay on the current branch
(per the Do-NOT list in `using-git-worktrees`):

* Parallel agents/sessions must not share a working directory
* The current branch is mid-work and a stash/switch would risk state
* The change is exploratory and may be thrown away whole
* A long-running build/test occupies the current worktree

Then create via [`using-git-worktrees`](../using-git-worktrees/SKILL.md)
(or the host primitive — § Host-native mapping below), declare the
scope lock (§ 2), keep status honest (§ 3), and gate removal (§ 4).

### 2. Scope lock

At worktree start, write a `.worktree-scope.md` note at the worktree
root and keep it untracked via `.git/info/exclude` (shared exclude —
one line `.worktree-scope.md`, no commit needed):

    ## Scope lock
    - branch: <branch-name>
    - owns: <path or glob list — the ONLY paths this worktree edits>
    - task: <one-line task statement>
    - created: <ISO date>

The lock is the disjointness contract between parallel worktrees. A
diff that leaves the owned paths is scope creep — stop and surface,
per `scope-control`. Check mechanically:

```bash
git diff --name-only "$(git merge-base HEAD <base>)"..HEAD
# every path must match an `owns:` entry
```

### 3. Status / merge-ready checklist

A worktree is **merge-ready** only when ALL hold:

1. **Clean tree** — `git status --porcelain` is empty.
2. **Scope lock respected** — changed files ⊆ `owns:` paths (command above).
3. **Verification evidence attached** — the scoped probe for the
   declared change ran fresh and passed (per `verify-before-complete`);
   record command + result tail in the status report. No fresh
   evidence → not merge-ready, regardless of how the diff looks.
4. **Ahead/behind known** — `git fetch origin --quiet` then
   `git rev-list --left-right --count HEAD...origin/<base>`. Behind →
   flag; divergent (both sides non-zero on a pushed branch) → route to
   [`git-workflow § Divergent-State Recovery`](../git-workflow/SKILL.md#procedure-divergent-state-recovery).
5. **No inherited-commit drops** — commits on the branch that this
   session did not author stay on the branch; never rebase-out,
   reset-away, or exclude them (rule `git-history-discipline`,
   shared-branch Iron Law).

### 4. Cleanup discipline

Removal is gated by the deterministic helper (edge-case-tested: detached
HEAD, branch without remote, tag-only reachability, deleted remote
branch, untracked files, paths with spaces):

```bash
npx tsx node_modules/@event4u/agent-config/src/scripts/worktree_cleanup_check.ts check <worktree-path>
```

Exit `0` → removal allowed; exit `1` → refuse, gates in order:

1. **Detached HEAD** — no branch to judge reachability for; resolve
   manually first.
2. **Unsaved work** — `git status --porcelain` non-empty, untracked
   files included (never answer with `--force`).
3. **Unique-commit check** — commits reachable from the worktree branch
   but from **no other ref** (branches, remotes, AND tags — a tag counts
   as reachability). Non-empty → **refuse removal**; the branch holds
   work that exists nowhere else. Surface the commit list and hand
   back — merging or preserving them is the user's call
   (`git-history-discipline`).

Then: **remove, never delete** — `git worktree remove <path>`, then
`git worktree prune`. Branch deletion is a separate, permission-gated
step (`scope-control`); never force-delete (`-D`) as part of cleanup.
Cross-worktree scope-lock overlaps are scanned via
`worktree_cleanup_check scope-overlap` (surfaced by `/worktree status`).

**Whole-checkout sweeps.** Worktrees accumulate one per branch and are never
removed on merge; `git worktree prune` only clears registrations whose
directory is already gone, so it does nothing for the live ones. Classify the
whole set in one pass rather than gate-checking by hand:

```bash
npx tsx node_modules/@event4u/agent-config/src/scripts/worktree_cleanup_check.ts inventory [repo] [--json|--plan]
```

`safe` requires all of: on a branch, merged into the trunk, clean, inside a
conventional worktree root (`.claude/worktrees/` or `.worktrees/`), and no git
activity for 48 h. `review` keeps its disqualifying reason so the next sweep
starts from a shorter list; `live` means another session may hold it. A
worktree outside the conventional roots is never `safe` — sitting beside the
repo it can be mistaken for a sibling package, so its removal stays a
judgement call. It is also the placement that loses the persistent shell
cwd on a host with a working-directory boundary — see
[`using-git-worktrees`](../using-git-worktrees/SKILL.md) § 2.

The mode reports only. `--plan` prints `git worktree remove` plus
`git branch -d` (never `-D`) for the safe set; **running it is a bulk deletion
needing the user's explicit this-turn approval**
(`non-destructive-by-default`), which a single earlier approval never covers.

## Host-native mapping

| Host capability | Use |
|---|---|
| Claude Code `EnterWorktree` / `ExitWorktree` | Enter/leave a governed worktree in-session; scope lock is written right after enter |
| Claude Code subagent `isolation: "worktree"` | Dispatch a slice into its own auto-managed worktree; unchanged worktrees are auto-cleaned by the host — the unique-commit gate still applies to any it leaves behind |
| No worktree primitive (other hosts) | Degrade to plain `git worktree add` per [`using-git-worktrees`](../using-git-worktrees/SKILL.md) § Procedure — same scope lock, same gates |

The mapping changes only who creates the directory. Scope lock,
merge-ready checklist, and cleanup gates are host-independent.

## Gotcha

* **`git log <branch> --not --all` is always empty** — `--all` includes
  the branch itself, so the naive check never fires. The
  `--exclude="refs/heads/<branch>" --all` variant is also unreliable
  when combined with `--not` (observed on git 2.39). Use the
  `for-each-ref` expansion above — it enumerates every ref except the
  branch explicitly.
* **Scope note committed by accident** — `.worktree-scope.md` must be
  in `.git/info/exclude`; `.gitignore` would be a tracked change
  outside the scope lock.
* **"Unchanged worktree" ≠ "no unique commits"** — a host auto-clean
  only covers worktrees with no changes; a worktree with committed but
  unmerged work still needs the unique-commit gate.
* **Stale ahead/behind** — always `git fetch` before the
  `rev-list --left-right` count; a cached view reports merge-ready on
  a diverged branch.

## Output format

1. **Worktree** — path + branch, and the scope-lock `owns:` list
2. **State** — clean/dirty, ahead/behind vs base, merge-ready verdict
   with the failing checklist item named when not ready
3. **Evidence** — verification command(s) run + result tail, or
   "none attached" stated explicitly
4. **Next step** — merge path, missing verification, or cleanup verdict
   (allowed / refused with the unique-commit list)

## Do NOT

* NEVER remove a worktree whose branch has commits on no other ref
* NEVER `git worktree remove --force` past a dirty tree
* NEVER drop, rebase-out, or reset-away inherited commits (rule
  `git-history-discipline`)
* NEVER report merge-ready without fresh verification evidence
* NEVER edit outside the scope-lock `owns:` paths without surfacing it

## Handover

| Task | Skill / command |
|---|---|
| Creating the worktree (ignore-safety, baseline) | [`using-git-worktrees`](../using-git-worktrees/SKILL.md) |
| Divergence recovery, safe squash, PR flow | [`git-workflow`](../git-workflow/SKILL.md) |
| Finishing the branch | `finishing-a-development-branch` |
| Day-to-day operations | `/worktree create` · `status` · `verify` · `cleanup` |
