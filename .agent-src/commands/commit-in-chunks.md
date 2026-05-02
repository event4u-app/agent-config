---
name: commit-in-chunks
skills: [git-workflow]
description: Stage and commit all uncommitted changes in logical chunks WITHOUT confirmation — sibling of /commit for autonomous flows
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "commit everything autonomously, split and commit without confirmation"
  trigger_context: "autonomous mode active and uncommitted changes present"
---

# commit-in-chunks

Auto-split and commit all local changes in one go. Use this when you
want commits made without being asked to confirm each batch. Sibling
of [`/commit`](commit.md), which presents the plan and waits for
approval. This command skips the approval step.

Per [`autonomous-execution`](../rules/autonomous-execution.md), the
agent does **not** commit on its own initiative — invoking this
command is the user's explicit consent to commit.

## Instructions

### 1. Detect uncommitted changes

```bash
git status --short
git diff --stat
git diff --cached --stat
```

If there are no uncommitted changes (staged or unstaged), report
"Nothing to commit." and stop.

### 2. Determine the ticket number

- Extract the ticket ID from the current branch name (e.g. `feat/DEV-1234/...`
  → `DEV-1234`).
- If no ticket ID is found, omit the scope from the messages — write
  `chore: ...` not `chore(): ...`. Do **not** ask the user for one.

### 3. Analyze and split

Group changed files into logical units following [`/commit`](commit.md)
step 3 grouping rules:

- Same feature / fix → one commit.
- Migration + corresponding model/seeder → one commit.
- Test + the class under test → one commit.
- Style-only changes (ECS/Rector/formatter) → separate `style:` /
  `chore:` commit when mixed with logic changes.
- Truly unrelated change → its own commit.

Splitting rules:
- **Do NOT split arbitrarily** — only when the changes are logically
  independent.
- **Prefer fewer, coherent commits** over many tiny ones.
- **Tests go with the code they test** unless test-only changes are
  large and noisy.

Generate commit messages per [`commit-conventions`](../rules/commit-conventions.md).

### 4. Commit immediately

For each planned commit in order:

```bash
git add {files...}
git commit -m "{message}"
```

No "looks good?" prompt. No confirmation step. The user invoked this
command knowing the plan would be executed.

### 5. Report

Show a summary:

```
Created N commits:
1. {sha1}  feat(DEV-1234): {summary}
2. {sha2}  test(DEV-1234): {summary}
3. {sha3}  chore: {summary}
```

Include `git log --oneline -N` output for verification.

## Rules

- **Never push** — pushing remains explicit per [`scope-control`](../rules/scope-control.md#git-operations--permission-gated).
- **Never modify files** — only stage and commit existing changes.
- **Do NOT add untracked files** unless they are clearly part of the
  change (check with `git status` first).
- **Follow commit conventions** as defined in [`commit-conventions`](../rules/commit-conventions.md).
- **Stop on first failure** — if `git commit` fails (hook rejection,
  pre-commit lint error), stop, report the error, and do not continue
  with the remaining planned commits. Leave staged files for the user
  to inspect.
- **No interactive prompts** — fail fast over hanging waiting for
  input.

## When NOT to use

- The user has not seen the diff yet and would benefit from review →
  use [`/commit`](commit.md) instead.
- The diff includes large unrelated changes the user might want to
  reorganise → use [`/commit`](commit.md).
- The repo has a pre-commit hook that requires manual response → fix
  the hook or use `/commit`.

## See also

- [`/commit`](commit.md) — split + present plan + wait for approval
- [`autonomous-execution`](../rules/autonomous-execution.md) — the
  rule that defines the no-ask commit default this command opts out of
- [`commit-conventions`](../rules/commit-conventions.md) — message
  format
