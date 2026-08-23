---
model_tier: medium
name: using-git-worktrees
description: "When starting parallel work in isolation from the current branch — spawn a git worktree with ignore-safety checks and a clean test baseline — even when the user says 'try this on the side'."
domain: process
workspaces:
  - engineering
packs:
  - engineering-base
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
* `subagent-orchestration` mode 6 (`do-in-worktrees`) was selected for a cross-wing chain — this skill is the executor that creates the per-step isolated worktrees the chain expects

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

### 0. Pre-flight — instruction-only, no setting to read

```
NEVER CREATE A WORKTREE THE USER DID NOT ASK FOR.
THERE IS NO SETTING. THE ONLY TRIGGER IS THE USER SAYING SO IN THE CHAT.
```

There is nothing to read: `worktrees.mode` was deleted (ADR-229). Creation
is instruction-only and hardcoded, so the decision is never the agent's.

| Situation | Behaviour |
|---|---|
| The user asked for a worktree **in the chat** — "do this in a worktree", "use mode 6", "spawn a worktree for X", or the same in another language | Continue to step 1. No permission question: the request **is** the permission. |
| Anything else, however well the shape would fit | **Do not create one.** Continue in place. |

**No explicit request** → do not ask, do not offer, do not mention it. Use
the in-place path (`subagent-orchestration` mode 3 `do-in-steps`, or just
stay on the current branch) and say nothing about worktrees. Proposing one
unprompted is the failure this rule exists to stop — it puts a decision the
user did not raise in front of them, and the answer is nearly always no.

This suppresses **unprompted** usage only. The tool stays fully available
the moment the user wants it, with no confirmation loop in the way: an
explicit request goes straight to step 1.

The Iron-Law gates below are unchanged and still run on every
explicitly-requested worktree — ignore-safety check (step 3) and clean
baseline (step 5). Instruction-only removes the *choice*, never the checks.

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
> 3. `~/.event4u/agent-config/worktrees/<project>/` — global

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

### 4b. Seed the worktree — allow / deny list

`git worktree add` checks out **tracked files only**. Everything
gitignored — dependencies, generated projections, build output, local
config — is absent. Seeding the wrong subset is the recurring
worktree-trap family: a gate then fails (or falsely passes) for a
reason the change did not cause.

| Artefact | Action | Why |
|---|---|---|
| The dependency tree the § 5 install would produce (`vendor/`, `node_modules/`, `.venv/`, `target/`, …) | **symlink** from the primary checkout, or run the § 5 install | Absent ⇒ every gate that shells to a local binary dies on its first import. A **partial** tree (only the binary shim directory) is worse than none — it produces a scatter of spurious failures. Symlink or install fully; never half. |
| Generated agent projections (`.augment/`, other tool trees) | **copy** from the primary checkout, or regenerate before running gates | Several gates read the projection tree. Absent ⇒ the gate reports "produced by regeneration but absent before" — red for a reason the contributor did not cause. |
| Build output (`dist/`, compiled artefacts) | **regenerate**, never copy a stale tree | A stale copy makes a byte-identity check report generator drift that does not exist. |
| Local settings (`.agent-settings.yml`, `.agent-settings.local.yml`) | **NEVER copy** | Gitignored, machine-local, and deliberately absent in CI. **Absent IS the CI shape** — copying it makes local gate results diverge from the gate that actually decides. A worktree that carries it is testing a configuration no pipeline runs. |
| Secrets, `.env`, credential files | **NEVER copy** | Same reasoning, plus leak surface. |

The list is encoded here, in the flow, on purpose: a separate committed
manifest is warranted only when a **flow-external** tool needs to read
it. Tools that seed their own throwaway worktrees already handle their
own dependency link inline and need no manifest.

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

**Optional `env-bootstrap` entry — stand-up beyond deps.** Some projects
need more than package install to stand up (start services, seed fixtures,
generate config). A project MAY declare a single bootstrap entry — an
`env-bootstrap` target in its runner file (`Taskfile.yml` / `Makefile` /
`package.json` `scripts`) or a documented equivalent. When one exists,
**surface it as the suggested next action** after the baseline — suggest,
never auto-execute (no new autonomous surface). Long-running work then reads
one deterministic stand-up entry instead of re-deriving it each session. If
none exists, deps + baseline is the whole stand-up.

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
* **Copying local settings in** — the worktree then passes gates the
  pipeline fails (§ 4b deny list). Absent is correct.
* **Partial dependency tree** — a `.bin`-only symlink yields a scatter
  of spurious failures; bisect in a clean scratch worktree instead.

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
