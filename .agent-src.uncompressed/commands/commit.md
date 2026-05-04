---
name: commit
cluster: commit
skills: [git-workflow]
description: Stage and commit all uncommitted changes — splits into logical commits following Conventional Commits
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "commit my changes, save this to git, create commits for these changes"
  trigger_context: "git status shows uncommitted changes"
---

# /commit

Top-level entry point for the `/commit` family. Bare `/commit` runs the
interactive split-and-confirm flow described below. The `:in-chunks`
sub-command runs the same split logic without the confirmation prompt.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/commit` (bare) | this file (`## Default flow`) | Interactive — split, present plan, wait for approval, commit |
| `/commit:in-chunks` | `commands/commit/in-chunks.md` | Autonomous — split and commit without confirmation |

## Dispatch

1. Parse the user's argument: `/commit[:<sub>] [args]`.
2. Bare `/commit` → run the `## Default flow` below verbatim.
3. `/commit:in-chunks` → load `commands/commit/in-chunks.md` and follow
   its `## Instructions` section verbatim.
4. Unknown sub-command → print the table above and ask which one.

## Migration

Replaces the standalone `/commit-in-chunks` command (deprecated in
`1.17.0`, removed in next minor). Use `/commit:in-chunks` instead.

## Default flow

### 1. Detect uncommitted changes

Run:
```bash
git status --short
git diff --stat
git diff --cached --stat
```

If there are no uncommitted changes (staged or unstaged), report "Nothing to commit." and stop.

### 2. Determine the ticket number

- Extract the ticket ID from the current branch name (e.g. `feat/DEV-1234/...` → `DEV-1234`).
- If no ticket ID is found in the branch name, ask the user:
  ```
  > No Jira ticket found in branch name. Do you want to include one?
  >
  > 1. Yes — I'll provide the ticket number
  > 2. No — skip ticket number
  ```
- If the user provides a ticket number, use it as the scope in all commit messages.
- If skipped, omit the scope entirely — write `chore: ...` not `chore(): ...`.

### 3. Analyze the changes

- Run `git diff HEAD` (and `git diff --cached` for already staged changes) to understand the full diff.
- Group changed files into **logical units** — files that belong together because they:
  - Implement the same feature or fix
  - Are a migration + its corresponding model/seeder
  - Are a test file and the class it tests
  - Are purely stylistic/formatting changes (separate from logic changes)
  - Are unrelated to the main change (e.g. config fix, unrelated typo)

### 4. Plan the commits

For each logical group, determine the commit message following the commit conventions rule
(see `.augment/rules/commit-conventions.md`).

Rules for splitting:
- **Do NOT split arbitrarily** — only split when the changes are logically independent.
- **Prefer fewer, coherent commits** over many tiny ones.
- **Tests always go with the code they test** unless there are many test-only changes.
- **Style-only changes** (ECS/Rector formatting) may get their own `style:` or `chore:` commit
  if they are large and mixed with logic changes.

### 5. Present the commit plan

Show the proposed commits as a numbered list, including which files go into each:

```
Proposed commits:

1. feat(DEV-1234): add absence type filter to working time report
   → app/Services/WorkingTimeService.php
   → app/Http/Controllers/WorkingTimeController.php
   → app/Http/Resources/WorkingTimeResource.php

2. test(DEV-1234): add component test for working time controller
   → tests/Component/WorkingTime/WorkingTimeControllerTest.php

3. chore: apply Rector formatting
   → app/Models/Absence.php
```

Then ask:
```
> 1. Looks good — commit
> 2. Adjust — I'll tell you what to change
> 3. Cancel
```

Wait for the user's response before doing anything.

### 6. Commit

Only after the user confirms (option 1):

For each planned commit in order:
1. Stage only the files for that commit: `git add {files...}`
2. Commit: `git commit -m "{message}"`

### 7. Report

Show a summary:
- Number of commits created
- Commit messages (one per line)

## Rules

- **Never commit before the user confirms** the plan.
- **Never push** — pushing is left to the user.
- **Never modify files** — only stage and commit existing changes.
- **Do NOT add untracked files** unless they are clearly part of the change (check with `git status`).
- **Follow commit conventions** as defined in `.augment/rules/commit-conventions.md`.

## Optional: wrap in `/do-and-judge`

If the user invoked `/commit` under `/do-and-judge` (or explicitly asked
for judged commits), treat the planned commit list from step 5 as the
implementer artifact:

- Hand the commit plan + diff to the judge before step 6.
- Judge verdict `apply` → proceed with step 6 unchanged.
- Judge verdict `revise` → adjust grouping or messages per the issue
  list, re-present the updated plan to the user, then re-judge.
- Judge verdict `reject` → stop, report, do not commit.

Two-revision ceiling applies per [`/do-and-judge`](do-and-judge.md).
Outside the wrapper this section is a no-op.
