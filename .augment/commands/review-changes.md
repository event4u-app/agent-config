---
skills: [code-review]
description: Self-review local changes before creating a PR
---

# review-changes

## Instructions

Review all uncommitted and committed-but-not-pushed changes against the default branch (`main`).

### 1. Gather the diff

- Run `git diff origin/main..HEAD --stat` to get an overview of changed files.
- Run `git diff origin/main..HEAD` for the full diff.
- Also check `git diff --stat` and `git diff` for any unstaged changes.

### 2. PHP syntax check

- Run `php -l` on every changed `.php` file.
- Report any syntax errors immediately.

### 3. PHPDoc review

Check all changed files for common PHPDoc issues:
- **Duplicate tags** — `@param` or `@return` appearing twice for the same parameter/method.
- **Split docblocks** — multiple `/** */` blocks before a single method. Must be one block.
- **Wrong tag order** — correct order is `@param` before `@return` before `@throws`.
- **Conflicting types** — PHPDoc type contradicts the method signature.
- **`@phpstan-ignore` inside string literals** — this breaks SQL queries. Use PHP tokenizer to detect.

### 4. Code quality review

- Are there any hardcoded values that should be constants or config?
- Is `Math` helper used for all calculations (not raw PHP arithmetic)?
- Are new files missing `declare(strict_types=1)`?
- Are there proper type hints on parameters, return types, and properties?
- Any obvious logic bugs (e.g. variable used before assignment in a branch)?
- Any duplicated code that should be extracted?

### 5. Report

Summarize findings as a table:
- File, line, issue, severity (🔴 must fix / 🟡 should fix / 🟢 suggestion)

Fix 🔴 issues automatically. Ask before fixing 🟡 issues.

### 6. Quality tools (optional)

After the review, ask the user:

```
> 1. Yes — run quality tools (PHPStan + Rector)
> 2. No — done with review
```

If yes → execute the `quality-fix` command workflow (see `.augment/commands/quality-fix.md`).

### Rules

- **Do NOT commit or push.**
- **Do NOT modify files beyond what the review finds.** No drive-by refactoring.

