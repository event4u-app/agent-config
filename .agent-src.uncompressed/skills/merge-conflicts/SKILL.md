---
name: merge-conflicts
description: "Use when the user has merge conflicts or says "resolve conflicts". Understands conflict markers, resolution strategies, and verification workflow."
source: package
domain: process
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

### 4. File-type specific rules (stack-aware)

#### Source files (any language)

- After resolving, check that import statements are correct (no duplicates, no missing imports). Applies to PHP `use`, JS/TS `import`, Python `import`, Go `import`, Rust `use`.
- Verify the resolved file parses with the project's type-checker / linter on just the touched file:
  - PHP: `php -l filename.php` then `vendor/bin/phpstan analyse path/to/file.php`
  - TypeScript: `tsc --noEmit` (full project) or `eslint path/to/file.ts`
  - Python: `python -m py_compile path/to/file.py` then `mypy path/to/file.py`
  - Go: `go vet ./path/to/pkg/...`
  - Rust: `cargo check`

#### Database migrations

- Never merge two migrations that modify the same table into one.
- If both branches added migrations, keep both — adjust timestamps / ordering to avoid collision.
- After resolving, run migrations against a disposable database to verify:
  - Laravel: `php artisan migrate --env=testing`
  - Symfony / Doctrine: `php bin/console doctrine:migrations:migrate --env=test --no-interaction`
  - Node / Prisma: `pnpm prisma migrate dev --schema=...`
  - Node / Knex: `pnpm knex migrate:latest --env test`
  - Python / Alembic: `alembic upgrade head` (against a test DB URL)
  - Go / golang-migrate: `migrate -path ./migrations -database "$TEST_DATABASE_URL" up`

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
# 1. Check no conflict markers remain (stack-agnostic — no --include filter)
grep -rn "<<<<<<< \|======= \|>>>>>>> " . \
  --exclude-dir=node_modules --exclude-dir=vendor --exclude-dir=.git
```

```bash
# 2. Syntax-check changed files (stack-dependent — pick the row that matches the project)
# PHP:    find . -name "*.php" -newer .git/MERGE_HEAD -exec php -l {} \;
# TS:     tsc --noEmit
# Python: python -m compileall -q .
# Go:     go build ./...
# Rust:   cargo check
```

```bash
# 3. Run the project's quality tools — resolve via the quality-tools skill, Taskfile,
#    package.json scripts, composer.json scripts, or Makefile. Examples per stack:
# PHP:    vendor/bin/phpstan analyse
# TS:     pnpm lint
# Python: ruff check && mypy
# Go:     golangci-lint run
# Rust:   cargo clippy
```

```bash
# 4. Run tests — full suite, not just the touched files
# PHP:    php artisan test    (or vendor/bin/pest)
# TS:     pnpm test
# Python: pytest
# Go:     go test ./...
# Rust:   cargo test
```

```bash
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

## Output format

1. Resolved conflict with both sides' intent preserved
2. Summary of resolution strategy per file

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
- Do NOT skip verification (project type-checker + tests) after resolving.
