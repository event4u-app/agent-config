---
skills: [coder]
description: Fix and reply to all open review comments (bots + human reviewers) on a GitHub PR
---

# fix-pr-comments

Runs `fix-pr-bot-comments` + `fix-pr-developer-comments` in sequence.

## Input

PR URL or auto-detect. Never reuse old PR numbers.

## Mode selection

Ask: `1. Interactive` / `2. Automatic`. Mode applies to both phases.

## Execution

### Phase 1: Bot comments → `fix-pr-bot-comments` (same PR + mode)
### Phase 2: Developer comments → `fix-pr-developer-comments` (same PR + mode)

### After both: `php -l` on modified files. Summary. Do NOT commit/push.

