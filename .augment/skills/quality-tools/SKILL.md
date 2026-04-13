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

## Prerequisite

Requires `galawork/php-quality` in `composer.json`. Not installed → commands don't exist.

## How it works

CLI wrapper (`galawork-quality`): detects changed files via Git, resolves configs from `config-dev/php-quality/`, manages caching, auto-regenerates baselines, handles memory.

**NEVER** call tools directly (`vendor/bin/phpstan`, etc.).

## Execution — ONLY via Composer or Artisan

- **Laravel** (`artisan` exists): `php artisan quality:*`
- **Composer** (no `artisan`): `composer quality:*`

All commands inside Docker container.

## Commands

### PHPStan — Static Analysis

```bash
php artisan quality:phpstan          # Laravel
composer quality:phpstan             # Composer
```

| Flag                      | Description                                                   |
|---------------------------|---------------------------------------------------------------|
| `--baseline`              | Generate and update the phpstan baseline file                 |
| `--debug`                 | Activate debug mode                                           |
| `--xdebug`                | Activate xdebug mode (must be installed)                      |
| `--ignore-git`            | Skip Git check, analyse all files (cache still applies)       |
| `--error-format[=FORMAT]` | Set error format: `table` (default), `github`, `gitlab`, etc. |
| `--switch-pro`            | Toggle PHPStan Pro for this execution                         |

### ECS — Easy Coding Standard

```bash
php artisan quality:ecs              # Laravel (dry-run)
php artisan quality:ecs --fix        # Laravel (fix)
composer quality:ecs                 # Composer (dry-run)
composer quality:ecs -- --fix        # Composer (fix)
```

| Flag                       | Description                                           |
|----------------------------|-------------------------------------------------------|
| `--fix`                    | Fix errors automatically                              |
| `--no-auto-fix`            | Do not fix errors automatically                       |
| `--debug`                  | Activate debug mode                                   |
| `--xdebug`                 | Activate xdebug mode (must be installed)              |
| `--clear-cache`            | Clear the ECS cache                                   |
| `--ignore-git`             | Skip Git check, check all files (cache still applies) |
| `--paths-to-scan[=PATHS]`  | Custom paths, e.g. `--paths-to-scan='["./core"]'`     |
| `--source-branch[=BRANCH]` | Source branch (default: HEAD)                         |
| `--target-branch[=BRANCH]` | Target branch to compare against                      |

### Rector — Automated Refactoring

```bash
php artisan quality:rector --fix     # Laravel
composer quality:rector -- --fix     # Composer
```

| Flag                       | Description                                           |
|----------------------------|-------------------------------------------------------|
| `--fix`                    | Apply refactorings (without this flag: dry-run only)  |
| `--no-auto-fix`            | Do not fix errors automatically                       |
| `--debug`                  | Activate debug mode                                   |
| `--xdebug`                 | Activate xdebug mode (must be installed)              |
| `--clear-cache`            | Clear the Rector cache                                |
| `--ignore-git`             | Skip Git check, check all files (cache still applies) |
| `--paths-to-scan[=PATHS]`  | Custom paths, e.g. `--paths-to-scan='["./core"]'`     |
| `--source-branch[=BRANCH]` | Source branch (default: HEAD)                         |
| `--target-branch[=BRANCH]` | Target branch to compare against                      |

### Combined Commands

```bash
# Refactor = Rector + ECS (fix mode)
php artisan quality:refactor --fix   # Laravel
composer quality:refactor -- --fix   # Composer

# Finalize = Rector + ECS + PHPStan (full pipeline)
php artisan quality:finalize         # Laravel
composer quality:finalize            # Composer
```

### Passing extra flags (Composer)

With Composer, use `--` to separate composer args from tool args:

```bash
composer quality:ecs -- --fix --clear-cache
composer quality:phpstan -- --debug
composer quality:refactor -- --fix --ignore-git
```

## Workflow after code changes

1. `composer quality:phpstan` → fix errors
2. `composer quality:refactor -- --fix` → auto-fix
3. `composer quality:phpstan` → verify no new issues. Errors → repeat from 2.

## Configuration

All configs in `config-dev/php-quality/`. Do NOT modify without user permission.

| File | Tool | Purpose |
|---|---|---|
| `phpstan.neon` | PHPStan | Level, paths, extensions, ignoreErrors, disallowed calls |
| `phpstan-baseline.neon` | PHPStan | Baseline (auto-managed, do NOT edit) |
| `phpstan-baseline-package.neon` | PHPStan | Package baseline (auto-managed, do NOT edit) |
| `phpstan-rector.neon` | PHPStan | Rector's PHPStan integration config |
| `phpstan.php` | PHPStan | Bootstrap (constants, autoloading) |
| `main.php` | Shared | Common config bootstrap |
| `ecs.php` | ECS | Rule sets, configured rules, skip list |
| `rector.php` | Rector | Rule sets, PHP version sets, skip list |

**PHPStan:** Level 9, `checkMissingCallableSignature: true`, baselines, disallowed calls (`var_dump`, `dd`), `treatPhpDocTypesAsCertain: false`.

**ECS:** PSR-1/2/12 sets, PHP migration sets, YodaStyle, skip list.

**Rector:** PHP version migration sets, naming enabled, skip risky renames.

## Baseline policy

**NEVER** edit baseline files by hand. Wrapper auto-regenerates after clean run.

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
