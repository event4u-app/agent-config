---
name: commit
description: "commit"
disable-model-invocation: true
---

# commit

## Instructions

### 1. Detect uncommitted changes

Run:
```bash
git status --short
git diff --stat
git diff --cached --stat
```

No changes → "Nothing to commit." → stop.

### 2. Determine ticket number

- Extract ticket from branch (e.g. `feat/DEV-1234/...` → `DEV-1234`).
- Not found → ask:
  ```
  > No Jira ticket found in branch name. Do you want to include one?
  >
  > 1. Yes — I'll provide the ticket number
  > 2. No — skip ticket number
  ```
- Provided → use as scope. Skipped → omit scope (`chore: ...` not `chore(): ...`).

### 3. Analyze changes

`git diff HEAD` + `git diff --cached` → group into logical units (same feature, migration+model, test+code, style-only, unrelated).

### 4. Plan commits

Per group → commit message per `.augment/rules/commit-conventions.md`.
- Split only when logically independent
- Fewer coherent commits > many tiny ones
- Tests go with code unless test-only batch
- Style-only → separate `style:`/`chore:` if large

### 5. Present commit plan

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

Then ask: `1. Looks good — commit` / `2. Adjust` / `3. Cancel`. Wait for response.

### 6. Commit

After confirmation: per commit → `git add {files}` → `git commit -m "{message}"`.

### 7. Report

Summary: commit count + messages.

## Rules

- Never commit before user confirms
- Never push
- Never modify files — only stage + commit
- Follow `.augment/rules/commit-conventions.md`
