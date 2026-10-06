---
model_tier: medium
name: git-commit
disable-model-invocation: true
argument-hint: "[in-chunks] [args]"
pack: git
intent: "Stage and commit changes in logical chunks with a Conventional Commits message"
routes_to: [git-workflow, conventional-commits-writing]
replaces: [commit]
visibility: visible
cluster: git-commit
skills: [git-workflow]
description: Stage and commit all uncommitted changes — splits into logical commits following Conventional Commits
suggestion:
  eligible: true
  trigger_description: "commit my changes, save this to git, create commits for these changes"
  trigger_context: "git status shows uncommitted changes"
workspaces:
  - agent-config-maintainer
packs:
  - git
---

# /git-commit

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

- Extract the ticket ID from the current branch name — the first token matching
  `[A-Z][A-Z0-9]+-[0-9]+`, wherever it sits (`feat/DEV-1234/...`,
  `DEV-1234-device-export`, `fix/DEV-1234-quantity` → `DEV-1234`). The match
  never depends on `git.branch_pattern`, so a branch named before the pattern
  was set still yields its ticket. A token whose prefix is `UTF`, `ISO`, `SHA`
  or `RFC` (`UTF-8`, `ISO-8601`, `SHA-256`) is a standard name, not a ticket —
  skip it and take the next match.
- Establish the convention in force once, per the conventional-commits-writing
  skill § Establish the house convention: a repository config (commitlint, a
  `commit-msg` hook) first, then a declared `git.commit_format: ticket-prefix`,
  then an approved measured convention. `git.commit_format` decides where the
  ticket goes only where nothing above it applies.
- If no ticket ID is found in the branch name, ask the user:
  ```
  > No Jira ticket found in branch name. Do you want to include one?
  >
  > 1. Yes — I'll provide the ticket number
  > 2. No — skip ticket number
  ```
- If the user provides a ticket number, place it per `git.commit_format` in all
  commit messages: `ticket-scope` (default) → as the scope, `feat(DEV-1234): …`;
  `ticket-prefix` → before the type, `DEV-1234 feat(<area>): …`, and the ticket
  is never the scope.
- If skipped, omit the ticket entirely — under `ticket-scope` write `chore: ...`
  not `chore(): ...`; under `ticket-prefix` keep any area scope.

### 3. Analyze the changes

- Run `git diff HEAD` (and `git diff --cached` for already staged changes) to understand the full diff.
- Group changed files into **logical units** — files that belong together because they:
  - Implement the same feature or fix
  - Are a migration + its corresponding model/seeder
  - Are a test file and the class it tests
  - Are purely stylistic/formatting changes (separate from logic changes)
  - Are unrelated to the main change (e.g. config fix, unrelated typo)

### 3b. Secret-leak pre-flight

Before planning any commit, scan the changed set for credentials:

```
./scripts-run src/scripts/check_secret_leak
```

If it exits non-zero (a high-confidence secret in the diff or an untracked file),
**STOP** — do not stage or commit. Hand control to the
`.augment/rules/secret-vcs-guard.md` rule: show the match, ask via numbered
options, and offer the tiered alternative (see
`.augment/skills/secrets-management/SKILL.md`). Only proceed
once the user resolves it (move to a store, or add an audited
`# secret-allow` / `.secret-allow` entry for a confirmed false positive). Never
silently commit a secret; never silently strip one.

### 4. Plan the commits

For each logical group, determine the commit message following the commit conventions rule
(see `.augment/rules/commit-conventions.md`).

Rules for splitting:
- **Do NOT split arbitrarily** — only split when the changes are logically independent.
- **Prefer fewer, coherent commits** over many tiny ones.
- **Tests always go with the code they test** unless there are many test-only changes.
- **Style-only changes** (formatter / auto-refactor output — ECS, Prettier, Ruff) may get their own `style:` or `chore:` commit
  if they are large and mixed with logic changes.

### 5. Present the commit plan (verbosity-gated)

Read `verbosity.preview_artifacts` and `verbosity.routine_confirmations`
from `.agent-settings.yml`. Both default to `false`.

**Terse path** — `preview_artifacts: false` AND `routine_confirmations: false`:

1. Validate every generated commit message against the regex for the
   convention in force (step 2); a repository config's own rule replaces these:
   - `ticket-scope` (default):
     `^(feat|fix|chore|docs|refactor|test|perf|style|build|ci|revert)(\([^)]+\))?!?: .+`
   - `ticket-prefix`:
     `^([A-Z][A-Z0-9]+-[0-9]+ )?(feat|fix|chore|docs|refactor|test|perf|style|build|ci|revert)(?!\([A-Z][A-Z0-9]+-[0-9]+\))(\([^)]+\))?!?: .+`
     — the lookahead rejects a ticket id standing in the scope.
2. **All messages valid** → skip the preview block and the confirmation
   prompt. Print one line summarising the plan and proceed to step 6:

   ```
   → 3 commits planned: feat, test, chore (ticket: DEV-1234)
   ```

3. **Any message invalid** → `preview-on-error` safety net fires:
   force the full preview block below + the numbered confirm prompt,
   regardless of the two flags. The user must approve before step 6.
4. **Hard-Floor diff** (bulk deletion ≥5 unrelated files, infra changes
   touching Terraform / Pulumi / k8s / Ansible / cloud-config) →
   ALWAYS preview + confirm regardless of flags, per
   [`non-destructive-by-default`](../rules/non-destructive-by-default.md).

**Preview path** — `preview_artifacts: true` OR `routine_confirmations: true`
(or `preview-on-error` triggered):

Show the proposed commits as a numbered list, including which files go into each:

```
Proposed commits:

(Laravel-project example, `git.commit_format: ticket-scope`; under
`ticket-prefix` the first subject reads
`DEV-1234 feat(working-time): add absence type filter to working time report`)
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

**Override:** the user may force the preview at any time with
*"show me the commit plan first"* / *"preview commits"* — treat as a
one-shot `preview_artifacts: true` for this invocation.

### 6. Commit

On the **terse path** proceed directly. On the **preview path** only after
the user confirms (option 1).

For each planned commit in order:
1. Stage only the files for that commit: `git add {files...}`
2. Commit: `git commit -m "{message}"`

### 7. Report (verbosity-gated)

Read `verbosity.post_action_reports` from `.agent-settings.yml` (default
`minimal`).

- `off` → emit nothing.
- `minimal` (default) → one line:

  ```
  → 3 commits created
  ```

- `full` → multi-line summary: number of commits + commit messages
  (one per line).

## Rules

- **Preview path: never commit before the user confirms the plan — once, for the whole plan.** On the terse path (`preview_artifacts: false` AND `routine_confirmations: false`) the `/commit` invocation itself is the confirmation (`commit-policy` exception 3); proceed without a prompt.
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
