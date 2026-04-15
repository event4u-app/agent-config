---
name: merge-conflicts
description: "Use when the user has merge conflicts or says "resolve conflicts". Understands conflict markers, resolution strategies, and verification workflow."
source: package
---

# merge-conflicts

## When to use

Use this skill when:
- A merge or rebase produces conflicts
- The user asks to "resolve conflicts", "fix merge", or "update branch"
- CI fails because the branch is behind main
- The `prepare-for-review` command encounters conflicts

## Procedure: Resolve merge conflicts

### 1. Understand the situation

Before touching any conflict:

```bash
# What files have conflicts?
git diff --name-only --diff-filter=U

# What branch are we merging from/into?
git log --oneline -1 HEAD
git log --oneline -1 MERGE_HEAD   # or REBASE_HEAD for rebase
```

### 2. Read both sides

For each conflicted file:

1. **Read the full conflict** — not just the markers, but the surrounding context.
2. **Understand "ours"** — what does the current branch intend?
3. **Understand "theirs"** — what does the incoming branch intend?
4. **Check if both changes are needed** — often both sides added different things.

### 3. Resolution strategies

| Situation | Strategy |
|---|---|
| Both sides changed the same line differently | **Ask the user** — this is a semantic conflict |
| Both sides added different code in the same area | **Keep both** — combine the additions in logical order |
| One side deleted, other side modified | **Ask the user** — deletion intent vs modification intent |
| Lock file conflicts (`composer.lock`, `package-lock.json`) | **Regenerate** — accept theirs, then run `composer install` / `npm install` |
| Migration conflicts (same timestamp) | **Rename** — adjust timestamp to avoid collision |
| Auto-generated files (OpenAPI spec, baselines) | **Regenerate** — resolve source, then regenerate the output |
| Formatting-only conflicts | **Accept either** — then run quality tools to normalize |

### 4. File-type specific rules

#### PHP files

- After resolving, check that `use` statements are correct (no duplicates, no missing imports).
- Verify the resolved code compiles: `php -l filename.php`
- Run PHPStan on the file: `vendor/bin/phpstan analyse` (see `quality-tools` skill)

#### Migrations

- Never merge two migrations that modify the same table into one.
- If both branches added migrations, keep both — adjust timestamps if they collide.
- After resolving, run migrations to verify: `php artisan migrate --env=testing`

#### Config files

- `composer.json` — resolve, then run `composer update --lock` to regenerate `composer.lock`.
- `package.json` — resolve, then run `npm install` to regenerate `package-lock.json`.
- `.env.example` — keep all new entries from both sides.

#### Test files

- If both sides added tests to the same file, keep all tests.
- If both sides modified the same test, understand what each test is verifying and combine.

### 5. When to ask the user

**Always ask** when:
- Both sides changed the **same business logic** differently (semantic conflict)
- A deletion conflicts with a modification (intent is unclear)
- The conflict involves **authorization or security** logic
- You're unsure which side is "correct"

**Resolve without asking** when:
- Both sides added different, non-overlapping code
- Lock file / auto-generated file conflicts
- Import statement ordering
- Formatting-only differences

### 6. Verify after resolution

After resolving ALL conflicts:

```bash
# 1. Check no conflict markers remain
grep -rn "<<<<<<< \|======= \|>>>>>>> " --include="*.php" --include="*.js" --include="*.ts" .

# 2. Syntax check PHP files
find . -name "*.php" -newer .git/MERGE_HEAD -exec php -l {} \;

# 3. Run quality tools
vendor/bin/phpstan analyse

# 4. Run tests
php artisan test

# 5. Complete the merge/rebase
git add .
# Don't commit — let the user decide when to commit
```

## Common pitfalls

| Pitfall | Prevention |
|---|---|
| Accepting "ours" blindly | Always read both sides first |
| Missing a conflict marker | Run `grep -rn "<<<<<<< "` after resolving |
| Breaking imports | Check `use` statements after merge |
| Losing new code | Compare the resolved file with both original versions |
| Forgetting to regenerate lock files | Always run package manager after resolving `*.json` |

## Rebase vs Merge

| Approach | When to use |
|---|---|
| `git merge main` | Default — preserves history, safer for shared branches |
| `git rebase main` | Only when explicitly asked — rewrites history, cleaner log |

**Never rebase without explicit permission** (per `no-commit` rule).

## Auto-trigger keywords

- merge conflict
- resolve conflict
- rebase conflict
- conflict markers
- branch behind main
- update branch

## Output format

1. Resolved conflict with both sides' intent preserved
2. Summary of resolution strategy per file

## Gotcha

- Never resolve conflicts by deleting code you don't understand — ask the user.
- The model tends to accept "ours" or "theirs" wholesale instead of merging logic from both sides.
- Always run tests after resolving conflicts — successful merge != correct merge.
- Lock file conflicts (composer.lock, package-lock.json) should be resolved by re-running the package manager.

## Do NOT

- Do NOT rebase or force-push without explicit permission.
- Do NOT leave conflict markers (`<<<<<<<`) in any file.
- Do NOT skip verification (PHPStan + tests) after resolving.
