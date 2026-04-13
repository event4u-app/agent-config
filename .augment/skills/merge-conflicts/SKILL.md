---
name: merge-conflicts
description: "Use when the user has merge conflicts or says "resolve conflicts". Understands conflict markers, resolution strategies, and verification workflow."
---

# merge-conflicts

## When to use

Merge/rebase conflicts, "resolve conflicts", CI behind main, `prepare-for-review` conflicts.

## Workflow

1. **Understand:** `git diff --name-only --diff-filter=U`, check HEAD vs MERGE_HEAD/REBASE_HEAD
2. **Read both sides:** full context, understand ours + theirs, check if both needed

### Strategies

| Situation | Strategy |
|---|---|
| Both sides changed the same line differently | **Ask the user** — this is a semantic conflict |
| Both sides added different code in the same area | **Keep both** — combine the additions in logical order |
| One side deleted, other side modified | **Ask the user** — deletion intent vs modification intent |
| Lock file conflicts (`composer.lock`, `package-lock.json`) | **Regenerate** — accept theirs, then run `composer install` / `npm install` |
| Migration conflicts (same timestamp) | **Rename** — adjust timestamp to avoid collision |
| Auto-generated files (OpenAPI spec, baselines) | **Regenerate** — resolve source, then regenerate the output |
| Formatting-only conflicts | **Accept either** — then run quality tools to normalize |

### File types

**PHP:** check `use` statements, `php -l`, PHPStan. **Migrations:** keep both, adjust timestamps. **Config:** resolve then `composer update --lock`/`npm install`. **Tests:** keep all, combine modified.

### Ask user: same business logic changed differently, deletion vs modification, auth/security, unsure. Resolve silently: non-overlapping additions, lock files, imports, formatting.

### Verify: `grep -rn "<<<<<<< "` (no markers left), `php -l`, PHPStan, tests. `git add .` — don't commit.

## Pitfalls: never accept blindly, always grep for markers, check imports, compare with originals, regenerate lock files.

## Merge (default, preserves history) vs Rebase (only when asked). **Never rebase without permission.**

## Auto-trigger keywords

- merge conflict
- resolve conflict
- rebase conflict
- conflict markers
- branch behind main
- update branch

## Gotcha

- Never resolve conflicts by deleting code you don't understand — ask the user.
- The model tends to accept "ours" or "theirs" wholesale instead of merging logic from both sides.
- Always run tests after resolving conflicts — successful merge != correct merge.
- Lock file conflicts (composer.lock, package-lock.json) should be resolved by re-running the package manager.

## Do NOT

- Do NOT rebase or force-push without explicit permission.
- Do NOT leave conflict markers (`<<<<<<<`) in any file.
- Do NOT skip verification (PHPStan + tests) after resolving.
