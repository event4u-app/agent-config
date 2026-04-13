---
name: quality-tools
description: "Use when running code quality checks — \"run PHPStan\", \"fix code style\", \"run Rector\". Knows all commands, parameters, execution rules, and language detection for PHP and JS/TS."
---

# quality-tools

## When to use

Running/configuring code quality tools:
- **PHP**: PHPStan, Rector, ECS
- **JS/TS**: Biome, TypeScript, Jest/Vitest

## Language detection

Detect by changed file extensions:

```bash
git diff --name-only origin/main..HEAD | grep -E '\.(php)$'       # → PHP tools
git diff --name-only origin/main..HEAD | grep -E '\.(js|ts|tsx)$'  # → JS/TS tools
```

Both changed → run both pipelines.

## Related: `quality-workflow` rule, `php-coding` rule (PHPStan), `verify-before-complete` rule

---

# PHP Quality Tools

## Tool Detection

Check `composer.json` for installed tools. Use first matching command style:

| `composer.json` contains | Command style | Example |
|---|---|---|
| `galawork/php-quality` | `php artisan quality:*` or `composer quality:*` | `php artisan quality:phpstan` |
| `phpstan/phpstan` or `larastan/larastan` | `vendor/bin/phpstan` | `vendor/bin/phpstan analyse` |
| `rector/rector` | `vendor/bin/rector` | `vendor/bin/rector process` |
| `symplify/easy-coding-standard` | `vendor/bin/ecs` | `vendor/bin/ecs check --fix` |

**Priority:** `galawork/php-quality` wrapper wins if installed (adds git-aware execution, caching, baseline mgmt).

None installed → skip quality checks, inform user. All commands inside Docker if used.

## Commands

### PHPStan — Static Analysis

```bash
# Native:
vendor/bin/phpstan analyse
vendor/bin/phpstan analyse --memory-limit=512M

# Wrapper (galawork/php-quality):
php artisan quality:phpstan          # Laravel
composer quality:phpstan             # Composer
```

**Native flags:** `--memory-limit=SIZE`, `--debug`, `--error-format=FORMAT`, `--pro`
**Wrapper-only flags:** `--baseline`, `--ignore-git`, `--xdebug`

### ECS — Easy Coding Standard

```bash
# Native:
vendor/bin/ecs check                 # Dry-run
vendor/bin/ecs check --fix           # Auto-fix

# Wrapper (galawork/php-quality):
php artisan quality:ecs --fix        # Laravel
composer quality:ecs -- --fix        # Composer
```

**Native flags:** `--fix`, `--clear-cache`
**Wrapper-only flags:** `--ignore-git`, `--paths-to-scan`, `--source-branch`, `--target-branch`

### Rector — Automated Refactoring

```bash
# Native:
vendor/bin/rector process            # Auto-fix
vendor/bin/rector process --dry-run  # Preview

# Wrapper (galawork/php-quality):
php artisan quality:rector --fix     # Laravel
composer quality:rector -- --fix     # Composer
```

**Native flags:** `--dry-run`, `--clear-cache`
**Wrapper-only flags:** `--ignore-git`, `--paths-to-scan`, `--source-branch`, `--target-branch`

### Combined Commands

No native single command. Run in sequence:

```bash
# Native:
vendor/bin/rector process && vendor/bin/ecs check --fix && vendor/bin/phpstan analyse

# Wrapper:
php artisan quality:finalize         # Rector + ECS + PHPStan
```

## Workflow after code changes

1. Run PHPStan → fix errors
2. Run Rector + ECS with auto-fix
3. Run PHPStan again → verify no new issues. Errors → repeat from 2.

Detect commands from project (see Tool Detection above).

## Configuration

Configs typically in project root. Do NOT modify without user permission.
Detect: check root for `phpstan.neon`, `ecs.php`, `rector.php`.

| File | Tool | Purpose |
|---|---|---|
| `phpstan.neon` | PHPStan | Level, paths, extensions, ignoreErrors, disallowed calls |
| `phpstan-baseline.neon` | PHPStan | Baseline (auto-managed, do NOT edit) |
| `ecs.php` | ECS | Rule sets, configured rules, skip list |
| `rector.php` | Rector | Rule sets, PHP version sets, skip list |

Read actual config files for active rules. Common patterns: PHPStan at high levels (8-9) with disallowed calls, ECS with PSR-12, Rector with PHP version sets.

## Baseline policy

**NEVER** edit baseline files by hand. If a wrapper tool is installed, it may auto-regenerate after clean run.

## PHPStan error handling

Priority: 1. Fix code → 2. Add type hints/PHPDoc → 3. Inline ignore (last resort, confirmed false positives only):
```php
// @phpstan-ignore-next-line — false positive: reason here
```

`ignoreErrors` in `phpstan.neon` allowed ONLY for structural toolchain limitations (broad patterns, not individual files). Unsure → ask user.

**NEVER:** add to baselines, ignore individual issues, omit reason comment.

## Testing: Always Pest (not PHPUnit). `tests/Unit/` auto-uses `UnitTestCase`.

## Git-aware execution

| Flag | Effect |
|---|---|
| (default) | Only changed files |
| `--ignore-git` | All files (cache applies) |
| `--clear-cache` | Changed files, no cache |
| `--ignore-git --clear-cache` | Complete fresh run |

---

# JS/TS Quality Tools

## Detection

Check `package.json` devDependencies: `@biomejs/biome` (Biome), `typescript` (TS), `jest`/`vitest` (tests), `eslint`/`prettier` (legacy — check if Biome replaces).

## Biome — Linting + Formatting (replaces ESLint + Prettier)

Config: `biome.json` / `biome.jsonc` — formatter, linter rules, import sorting.

### Commands

```bash
# Check (dry-run) — shows errors without fixing
npx biome check .

# Fix — auto-fix all fixable issues (formatting + linting + imports)
npx biome check --write .

# Format only
npx biome format --write .

# Lint only
npx biome lint .
```

Prefer npm scripts (`npm run biome`, `npm run biome:fix`) over raw `npx` when they exist.

## TypeScript — `npx tsc --noEmit` or `npm run tscheck`. Config: `tsconfig.json`, `strict: true`.

## Jest/Vitest — `npm test`, `npx jest path/to/test.spec.ts`, `--coverage`, `--watch`.

## JS/TS Workflow

1. `npx biome check --write .` → auto-fix
2. `npx tsc --noEmit` → type check
3. `npm test` → tests. Type errors → fix, re-run step 1.

## Execution: PHP inside Docker. JS/TS on host or Node container (check Makefile/Taskfile/docker-compose).

## Do NOT

- Run `vendor/bin/phpstan`/`vendor/bin/ecs` directly — use wrapper
- Edit `phpstan-baseline.neon` — auto-managed
- Skip `tsc --noEmit` for TS projects
- Run Biome without `--write` when fixing
- Mix ESLint + Biome in same project
