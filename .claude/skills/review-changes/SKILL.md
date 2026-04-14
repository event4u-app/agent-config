---
name: review-changes
description: "Review uncommitted and committed-not-pushed changes"
disable-model-invocation: true
---

# review-changes

## Instructions

Review uncommitted + committed-not-pushed changes vs `main`.

### 1. Gather diff — `git diff origin/main..HEAD` + `git diff` (unstaged)

### 2. PHP syntax — `php -l` on changed `.php` files

### 3. PHPDoc — duplicate tags, split docblocks, wrong order, conflicting types, `@phpstan-ignore` in strings

### 4. Code quality — hardcoded values, `Math` helper, `strict_types`, type hints, logic bugs, duplication

### 5. Report table (file, line, issue, severity 🔴/🟡/🟢). Fix 🔴 auto, ask for 🟡.

### 6. Quality tools (optional)

After the review, ask the user:

```
> 1. Yes — run quality tools (PHPStan + Rector)
> 2. No — done with review
```

If yes → execute the `quality-fix` command workflow (see `.augment/commands/quality-fix.md`).

### Rules — No commit/push. No drive-by refactoring.
