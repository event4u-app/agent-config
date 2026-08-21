---
model_tier: inherit
name: merge-conflicts
description: "Use when the user has merge conflicts or says \"resolve conflicts\". Understands conflict markers, resolution strategies, and verification workflow."
domain: process
workspaces:
  - engineering
packs:
  - engineering-base
triggers:
  - phrase: "merge conflict"
  - phrase: "rebase conflict"
  - phrase: "resolve conflicts"
---

# merge-conflicts

## When to use

Use this skill when:
- A merge or rebase produces conflicts
- The user asks to "resolve conflicts", "fix merge", or "update branch"
- CI fails because the branch is behind main
- The `prepare-for-review` command encounters conflicts

## Procedure: Resolve merge conflicts

### 0. Classify before resolving — and never start in the GitHub web editor

A `CONFLICTING` PR is not a signal to open the web editor. **The web editor
cannot tell generated from authored**, so it presents a mechanical regeneration
and a real human decision as the same three-way merge — which is how a
generated file gets hand-merged into a state matching neither branch. Run the
classifier first, locally:

```bash
./scripts-run src/scripts/sync_pr_branch          # add --dry-run to look first
```

It resolves the base from the open PR, merges it in when the branch is behind,
and on a conflict STOPS and splits the paths into three classes, because the
correct resolution differs per class and only the first is mechanical:

| Class | Resolution |
|---|---|
| **generated** | regenerate — never mix hunks. A clean auto-merge of a generated file is still wrong |
| **remeasured** | re-run the measurement on the merged tree. A ratchet baseline records what a tree measured; picking a side is how the ratchet silently loosens, and the tool deliberately never re-measures for you |
| **authored** | a human decision — read both sides. This is the rest of this skill |

Adoption of this step is not measurable without telemetry this repository has
ruled out; it is a checklist item, not a gate
(road-to-merge-hotspot-drawdown 4.3).

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

### 2b. Merge Resolution Plan — mandatory before touching a conflict

After reading both sides, write the plan; under `autonomous-execution` the
approval gate applies (a standing mandate states the plan and proceeds; an
interactive session surfaces it and waits):

```
## Merge Resolution Plan
- Conflicts: {N files / M hunks}
- Execution order: {dependency leaves first — a file nothing else imports
  resolves before the files that import it}
| file | strategy | rationale |
|---|---|---|
- Decisions needed from the user: {semantic/deleted-modified items, or none}
- Validation: {targeted checks to run after resolution}
```

**Backup before resolution:** every deleted-modified file is copied to a
temp path (`$TMPDIR/merge-backup-<ts>/<file>`) and the path noted in the
plan BEFORE any resolution touches it.

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
| Import-block conflicts (both sides added imports) | **Keep both** — union the imports, drop duplicates, let the linter order them |
| Binary files (images, archives, compiled assets) | **Pick one side whole** — never splice; regenerate from source if generated, else ask which side wins |

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

### 5b. Resolution log — one line per conflict

Every resolved conflict gets a one-line explanation ("kept both — additive
imports"; "took theirs — lockfile regenerated") collected into the final
summary: the auditable log the reviewer reads instead of re-deriving each
hunk decision.

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
