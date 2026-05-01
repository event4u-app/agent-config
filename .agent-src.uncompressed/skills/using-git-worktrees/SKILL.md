---
name: using-git-worktrees
description: "Use when starting parallel work in isolation from the current branch — spawn a git worktree with ignore-safety checks and a clean test baseline — even when the user says 'try this on the side'."
source: package
---

# using-git-worktrees

## When to use

* Starting new work while the current branch is mid-work and you don't
  want to stash or switch
* Running two agents (Augment Code, Claude Code, Cursor) on the same
  repo in parallel — each needs its own working directory
* Experimenting with a refactor that may be thrown away — a throwaway
  worktree is cheaper than a throwaway commit
* A long-running build or test suite is busy in the current worktree

Do NOT use when:

* A small fix fits in one commit on the current branch — worktree
  overhead is not worth it
* The task is linear ("just finish this PR") — a single branch is simpler
* The repo is tiny and branch-switching is instant — setup cost outweighs
  isolation benefit
* You are unsure which branch you want — pick the branch first

## Goal

Land in an **isolated, ignored, test-clean** worktree ready for
implementation, without polluting the parent repo's working tree.

## The Iron Law

```
NO WORKTREE WITHOUT VERIFIED IGNORE + CLEAN BASELINE.
```

An un-ignored worktree directory will get committed accidentally. A
worktree with a failing baseline mixes pre-existing failures into new
work and makes it impossible to tell what you broke.

## Procedure

### 1. Inspect current state

Before creating anything, check existing conventions — do not assume:

```bash
git worktree list                              # already-active worktrees
ls -d .worktrees worktrees 2>/dev/null         # project-local convention
grep -i "worktree.*director" AGENTS.md CLAUDE.md 2>/dev/null
```

If a worktree on the target branch already exists, **reuse it**. Git
refuses to check out a branch that is already live elsewhere.

### 2. Pick directory convention

Stop at the first match — do not ask if discovered:

| Found                    | Use                                        |
|--------------------------|--------------------------------------------|
| `.worktrees/` exists     | `.worktrees/<branch-name>`                 |
| `worktrees/` exists      | `worktrees/<branch-name>`                  |
| `AGENTS.md` preference   | follow it                                  |
| nothing found            | ask user (numbered options)                |

Ask format:

> 1. `.worktrees/` — project-local, hidden
> 2. `worktrees/` — project-local, visible
> 3. `~/.config/agent-config/worktrees/<project>/` — global

**Recommendation: 1 — `.worktrees/`** — project-local keeps the worktree next to the repo (easy cleanup), and the leading dot keeps it out of `ls`. Caveat: pick 3 if multiple repos must share a single worktree root.

### 3. Verify ignore-safety (project-local only)

```bash
git check-ignore -q .worktrees || git check-ignore -q worktrees
```

**If exit ≠ 0:** add the path to `.gitignore`, commit that change
**before** creating the worktree. Do not proceed until the check
passes. For the global location, skip — path is outside the repo.

### 4. Create the worktree

```bash
git worktree add .worktrees/<branch-name> -b <branch-name>
cd .worktrees/<branch-name>
```

Branch names must match the project convention — see
`commit-conventions` rule.

### 5. Install dependencies + verify baseline

Auto-detect from manifest files:

| File              | Command                                 |
|-------------------|-----------------------------------------|
| `composer.json`   | `composer install`                      |
| `package.json`    | `npm ci` / `pnpm install` / `yarn`      |
| `pyproject.toml`  | `poetry install` or `pip install -e .`  |
| `Cargo.toml`      | `cargo build`                           |
| `go.mod`          | `go mod download`                       |

Run the project's fastest test target. If the baseline **fails**, stop
and report — ask whether to fix main first or proceed. Never silently
continue with a red baseline.

## Multi-tool parallel work

Agents share the same `.git/` but get their own working directory. One
worktree per agent session; branch name encodes agent/task
(`feat/augment-auth`, `feat/claude-refactor`). Merge or discard before
starting a new worktree on the same branch.

## Gotcha

* **Un-ignored directory** — contents end up tracked; `git status`
  noise across the whole repo. Verify first.
* **Two worktrees on same branch** — git refuses; pick a new branch.
* **Hardcoded `npm install`** on a PHP project fails silently. Detect
  from manifest files.
* **Skipping baseline** — failing tests pre-existed; later blamed on
  your own changes.

## Output format

1. **Location** — full path to the worktree
2. **Branch** — created branch name
3. **Baseline** — `<N> tests passing` or explicit failure report
4. **Next step** — suggested skill or command for the actual work

## Do NOT

* NEVER create a worktree before the ignore check passes
* NEVER skip the baseline test run
* NEVER reuse a directory name that already holds a worktree
* NEVER `rm -rf` a worktree — use `git worktree remove`

## Handover

| Task                       | Skill / command                   |
|----------------------------|-----------------------------------|
| Finishing the branch       | `finishing-a-development-branch`  |
| Opening the PR             | `/create-pr`                      |
| Verifying completeness     | `verify-before-complete`          |
