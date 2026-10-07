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

- Read the ticket from the current branch name:
  `agent-config git:convention ticket --keys "<the ticket_keys line of the approved convention card>"`
  (no card → no `--keys`). The first line is `ticket <ID>` or `ticket none`
  (`feat/DEV-1234/...`, `fix/DEV-1234-quantity` → `DEV-1234`; `fix/CVE-2026-12345-patch` → none).
  A candidate marked `unknown-key` → ask the user whether it is a ticket; a yes
  adds its key to the card's `ticket_keys`. A `proposal` line → offer it for the
  card, never write it unasked.
- If no ticket ID is found in the branch name, ask the user:
  ```
  > No Jira ticket found in branch name. Do you want to include one?
  >
  > 1. Yes — I'll provide the ticket number
  > 2. No — skip ticket number
  ```
- Place the ticket (given or read) in every message per the convention in force —
  [`commit-subject`](../../../skills/git-workflow/references/commit-subject.md) § Placing the ticket;
  skipped → omit it, never `chore(): …`.

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

### 3c. Establish the convention — once per repository

Before any subject is generated, run
`agent-config git:convention show --key commit_format`. It prints
`no convention established — run git:convention measure` only when there is
no declaration, no approved card and no commitlint config; otherwise skip this step.

1. Run `agent-config git:convention measure`. Its `verdict` line is the input to
   the one question below; the thresholds behind it are the `measure` rows of
   [`commit-subject`](../../../skills/git-workflow/references/commit-subject.md) § The grammar.
2. Ask **once**, as numbered options, naming the family, its share, the capped
   total and the author count from the verb's output:
   - `verdict established: <family>` → the established family (recommended) vs
     Conventional Commits;
   - `verdict below the bar` → the two strongest families (each with its share)
     vs Conventional Commits, quoting the verb's reasons.
3. Run `agent-config git:convention measure --family <answer>` (Conventional
   Commits is `--family conventional`) and write its `card` block to
   `agents/memory/curated/conventions/approved/commit-subject.md` — **also when
   the answer is Conventional Commits**, so this question is never asked again in
   this repository. The card is the one file this command writes. Stage it
   explicitly with `git add -- agents/memory/curated/conventions/approved/commit-subject.md`
   and commit it in the first commit of this run — the commit it was approved
   for — so a worktree or a fresh clone reads the same answer instead of asking
   again; name it in the report.
4. When the same output carries a `team file` block, show it: it is the
   ready-to-commit `.git-convention.yml` (`commit_format`, `branch_pattern`,
   never `update_strategy`). The file is class C — a human creates and commits
   it; never write it.

Then generate every subject under the answer: `git:convention subject` reads the
card the moment it exists.

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

1. Pipe every generated subject, one per line, through
   `agent-config git:convention subject` — it resolves the convention in force
   and validates against it. Act on the exit code: `0` valid · `1` the output
   lists each failure and its rule → treat as invalid. A `note:` line naming a
   `commit-msg` hook or a commitlint config means that validator also runs at
   commit and may be stricter; it never changes the exit.
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
`ticket-conventional` the first subject reads
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
- **Never modify files** — only stage and commit existing changes. The one exception is the convention card step 3c writes after the user's answer, committed with the first commit of the run.
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
