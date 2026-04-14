---
type: "auto"
alwaysApply: false
description: "Quality workflow for running PHPStan, Rector, and ECS code quality checks"
---

# Quality Workflow

Run quality tools **ONCE at the end** — not after each edit.
See `verify-before-complete` rule for timing. Full command reference → `quality-tools` skill.

## Language detection

| Files changed | Pipeline |
|---|---|
| `.php` | PHP (PHPStan → Rector → PHPStan) |
| `.js`, `.ts`, `.tsx`, `.jsx` | JS/TS (Biome → TSC → Tests) |
| Both | Run **both** |

```bash
git diff --name-only origin/{default}..HEAD | grep -E '\.(php)$'
git diff --name-only origin/{default}..HEAD | grep -E '\.(js|ts|tsx)$'
```

---

## PHP Pipeline

### Prerequisite

Check `composer.json` for quality tools. See `quality-tools` skill for detection and commands.

### Execution

```bash
# Native (default):
vendor/bin/phpstan analyse             # PHPStan
vendor/bin/rector process              # Rector (auto-fix)
vendor/bin/ecs check --fix             # ECS (auto-fix)

# With galawork/php-quality wrapper (if installed):
php artisan quality:phpstan            # PHPStan
php artisan quality:finalize           # Full pipeline
```

All inside Docker container if used.

### Workflow

1. Run PHPStan — fix type errors
2. Run Rector + ECS with auto-fix
3. Run PHPStan again — verify no new issues

Step 3 errors → fix, repeat from step 2.

### Baseline — NEVER touch

- NEVER edit `phpstan-baseline.neon` manually
- Auto-regenerated after successful PHPStan run (0 new errors)

### Error handling

- Fix actual code — don't suppress/ignore/baseline
- Last resort: `// @phpstan-ignore-next-line — false positive: reason here`

### Config files

| File | Tool | Purpose |
|---|---|---|
| `phpstan.neon` | PHPStan | Level, paths, extensions, ignoreErrors |
| `phpstan-baseline.neon` | PHPStan | Baseline (auto-managed, do NOT edit) |
| `ecs.php` | ECS | Code style rules and skip list |
| `rector.php` | Rector | Refactoring rules, PHP version sets, skip list |

- `ignoreErrors`: structural toolchain limitations only. **Unsure → ask.**
- Config files: don't modify without permission.

### Git-aware execution

Default: only changed files. `--ignore-git` = all files. `--clear-cache` = fresh. Both = complete re-check.

---

## JS/TS Pipeline

### Prerequisite

Check `package.json`: `@biomejs/biome`, `typescript`, `jest`/`vitest`.

### Execution

```bash
npm run biome:fix      # Auto-fix formatting + linting
npm run tscheck        # Type check
npm test               # Tests

# Fallback
npx biome check --write .
npx tsc --noEmit
npx jest
```

Host or Node container — check `Makefile` / `docker-compose.yml`.

### Workflow

1. `npm run biome:fix` — formatting, linting, imports
2. `npm run tscheck` — type safety
3. `npm test`

Step 2 errors → fix, re-run step 1.

### Error handling

- Fix type errors in code. No `@ts-ignore`/`@ts-expect-error` without reason.
- Fix Biome errors, don't `biome-ignore` unless confirmed false positive.
- Don't modify config files without permission.
