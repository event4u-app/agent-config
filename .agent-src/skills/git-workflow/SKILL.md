---
model_tier: inherit
name: git-workflow
description: "Use when working with Git — branch naming, commit messages, PR creation, rebasing, or the code review process — even when the user says 'push this' or 'merge the branch' without naming Git."
domain: process
execution:
  type: assisted
  handler: internal
  allowed_tools: ["github"]
workspaces:
  - engineering
packs:
  - engineering-base
---

# git-workflow

## When to use

Use when preparing PRs, finishing branches, or following the team's Git workflow.

Do NOT use when:
- Code writing or review (use `php-coder` or `code-review` skill)
- CI/CD pipeline changes (use `github-ci` skill)

## Conventions

→ See guideline `docs/guidelines/php/git.md` for branch naming, commit messages, PR conventions.
→ See `commit-conventions` rule for commit format, types, and scope rules.
→ Use `conventional-commits-writing` skill for generating/reviewing commit messages.

## Procedure: Before opening a PR

1. Run the project's quality pipeline (see `quality-tools` skill) — typically: type-checker → auto-fixer → linter → type-checker.
2. Run the project's test command — detect from manifest: `php artisan test` / `vendor/bin/phpunit` (PHP), `npm test` / `pnpm test` / `vitest` / `jest` (JS-TS), `pytest` (Python), `cargo test` (Rust), `go test ./...` (Go).
3. Rebase onto `main`.
4. Fill in PR template completely.

## Procedure: Finish a branch

When implementation is complete and all tests pass:

```
Work complete. What would you like to do?

1. Push and create a Pull Request
2. Keep the branch as-is (I'll handle it later)
3. Discard this work
```

### Option 1: Push and create PR

1. Run quality pipeline + tests.
2. `git push -u origin <branch>`.
3. `gh pr create` using PR template.

### Option 2: Keep as-is

Report: "Branch `<name>` preserved locally." — do nothing.

### Option 3: Discard

**Confirm first** — list branch name and commit count.
Wait for explicit confirmation. Then:
```bash
git checkout main
git branch -D <feature-branch>
```

## PR template

The project uses `.github/pull_request_template.md`:
1. Jira ticket link (badge)
2. Description — what and why
3. Type of change
4. Checklist (docs, rebase, quality, review, tests, QA)
5. Links + screenshots

## Default branch

- `main` is default/production branch.
- Merge strategy: merge commits (not squash).

## Procedure: Safe squash-after-push

Use ONLY when the user explicitly authorized a squash on a branch that
is already on origin. The whole sequence runs in **one turn** — never
end the session between rewrite and push.

Trigger context: `git-history-discipline` rule routed here.

### 1. Snapshot before touching anything

```bash
BRANCH=$(git branch --show-current)
DATE=$(date +%F)
git fetch origin
git tag "safe-squash-pre/${BRANCH}/${DATE}" HEAD
git tag "safe-squash-origin/${BRANCH}/${DATE}" "@{u}"
```

Two tags = two recoveries (local tip + origin tip). Do not skip the
tags — `git reflog` is TTL-bounded and unreliable across sessions.

### 2. Verify aligned starting state

```bash
git rev-list --left-right --count HEAD...@{u}
```

- `0  0` → aligned, proceed.
- `N  0` (local ahead) → unpushed work, proceed.
- `0  N` (origin ahead) → `git pull --ff-only` first, then re-check.
- `M  N` (both non-zero) → **divergent**. Abandon the squash and run
  § Divergent-State Recovery below.

### 3. Perform the squash

Default — soft-reset path (single token-cheap rewrite):

```bash
git reset --soft "$(git merge-base HEAD <base>)"
git commit -m "<conventional commit message>"
```

Interactive rebase only when the user wants per-commit control — it
replays derived files (`.condensation-hashes.json`, router projections)
per commit and conflicts on every replay.

### 4. Re-push in the SAME turn

```bash
FETCHED_SHA=$(git rev-parse "@{u}")
git push --force-with-lease="${BRANCH}:${FETCHED_SHA}" origin "${BRANCH}"
git fetch origin
[ "$(git rev-parse HEAD)" = "$(git rev-parse @{u})" ] \
  && echo "OK: origin matches HEAD" \
  || echo "MISMATCH — do not end session"
```

If the push fails (pre-push hook, network, token budget):
- Fix the underlying cause **now**.
- Re-push immediately.
- Do not commit new work on top of the squashed-but-unpushed tip.
- Do not end the session until `HEAD == @{u}`.

### 5. Hand off only with verified parity

Report exactly:
- pre-squash tip SHA (from step 1)
- pre-squash tag name (for recovery)
- post-squash tip SHA == origin SHA (verified in step 4)
- PR number, if any, and confirm it picked up the new tip

## Procedure: Divergent-State Recovery

Fires when `git rev-list --left-right --count HEAD...@{u}` shows
**both** sides non-zero on the current branch.

### 1. Stop. Do not pull.

A blind `git pull --rebase` here replays remote commits on top of a
local history that may already represent the same work in a different
shape — guaranteed conflict storm in derived files, possible
double-application of the same change. This is the documented failure
mode behind `git-history-discipline`.

### 2. Tag both sides immediately

```bash
TS=$(date +%FT%H%M)
git tag "diverged-local/${TS}" HEAD
git tag "diverged-origin/${TS}" "@{u}"
```

### 3. Diagnose: which side is the correct future?

```bash
git log --oneline @{u}..HEAD   # local-only commits
git log --oneline HEAD..@{u}   # origin-only commits
git diff @{u}..HEAD --stat     # shape of local-ahead work
```

Decision matrix:

| Pattern | Future | Action |
|---|---|---|
| Local has the same logical work as origin, just reshaped (squash/rebase) | **Local** | After PR-review check (step 4), `git push --force-with-lease=<branch>:<origin-sha>` |
| Origin has commits local does not reflect (another contributor pushed) | **Origin** | Tag any local-ahead work for cherry-pick, then `git reset --hard @{u}` |
| Both sides have genuine independent work | **ask user** | Never decide silently — surface the two commit lists and let the user pick |

### 4. PR review-comment check (mandatory before any force-push)

If a PR is open on this branch:
```bash
gh pr view --json reviews,comments
# or via GitHub API: /repos/<owner>/<repo>/pulls/<num>/{reviews,comments}
```

If review comments are anchored to commits that the force-push will
erase → STOP, ask the user how to preserve them. A force-push that
destroys live review feedback is unrecoverable from the agent side.

### 5. Recover or proceed

Use the tags from step 2 to restore either side if step 4 surfaces a
problem. After resolution, verify `HEAD == @{u}` and report both
SHAs plus the tags created.

## Hard prohibitions on a pushed branch

- No `git pull --rebase` after detecting divergent state.
- No `git push --force` without `--force-with-lease=<branch>:<sha>`.
- No squash-then-end-session — the push must complete in the same turn.
- No reflog-only recovery — always tag the state explicitly first.

## Output format

1. Commits following conventional commit format
2. PR description with structured sections (if creating PR)

## Gotcha

- Never commit/push/merge without explicit user permission.
- Keep subject line under 72 chars.
- Don't rebase shared branches.
- `git stash` can lose work — prefer WIP commits.

## Do NOT

- Do NOT commit directly to `main`.
- Do NOT push without running quality tools first.
- Do NOT force-push to shared branches.

## Auto-trigger keywords

- Git workflow
- branch naming
- commit message
- PR convention
