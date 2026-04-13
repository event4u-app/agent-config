---
name: quality-tools
description: "Use when running code quality checks — \"run PHPStan\", \"fix code style\", \"run Rector\". Knows all commands, parameters, execution rules, and language detection for PHP and JS/TS."
---

# quality-tools

## When to use

Use this skill whenever running or configuring code quality tools:

- **PHP**: PHPStan (static analysis), Rector (automated refactoring), ECS (coding standards)
- **JS/TS**: Biome (linting + formatting), TypeScript compiler (type checking), Jest/Vitest (tests)

## Language detection

Detect which tools to run based on **what files were changed**:

```bash
# Check changed file extensions (diff against base branch)
git diff --name-only origin/main..HEAD | grep -E '\.(php)$'       # → PHP tools
git diff --name-only origin/main..HEAD | grep -E '\.(js|ts|tsx)$'  # → JS/TS tools
```

If both PHP and JS/TS files changed → run **both** pipelines.

## Related rules and guidelines

- `quality-workflow` rule — enforced workflow, baseline policy, execution rules (auto-loaded)
- `php-coding` rule → PHPStan section — inline ignores, PHPDoc rules
- `verify-before-complete` rule — must run quality checks before claiming work is done

---

# PHP Quality Tools

## Prerequisite

All commands require the `galawork/php-quality` Composer package.
Check `composer.json` for `galawork/php-quality` in `require` or `require-dev`.
If the package is **not installed**, these commands do not exist — do not attempt to run them.

## How it works

The `galawork/php-quality` package provides a CLI wrapper (`galawork-quality`) that:

1. **Detects changed files** via Git (only checks files changed since last commit by default)
2. **Resolves config paths** automatically from `config-dev/php-quality/`
3. **Manages caching** to speed up repeated runs
4. **Regenerates baselines** automatically after successful PHPStan runs
5. **Handles memory limits** and other runtime settings

The wrapper is exposed via Composer scripts or Laravel Artisan commands.
**NEVER** call the underlying tools directly (`vendor/bin/phpstan`, `vendor/bin/ecs`, etc.).

## Execution — ONLY via Composer or Artisan

Detect the project type and use the correct wrapper:

- **Laravel** (`artisan` exists): `php artisan quality:*`
- **Composer** (no `artisan`): `composer quality:*`

All commands run **inside the Docker container** (`make console` or `docker compose exec`).

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

1. `composer quality:phpstan` — fix all errors in code
2. `composer quality:refactor -- --fix` — auto-fix style + refactoring
3. `composer quality:phpstan` — verify Rector/ECS didn't introduce new issues

If step 3 finds errors → fix and repeat from step 2.

## Configuration

All config files live in `config-dev/php-quality/`. Do NOT modify without explicit user permission.

### Config file overview

| File                            | Tool    | Purpose                                                      |
|---------------------------------|---------|--------------------------------------------------------------|
| `phpstan.neon`                  | PHPStan | Level, paths, extensions, `ignoreErrors`, disallowed calls   |
| `phpstan-baseline.neon`         | PHPStan | Baseline for existing errors (auto-managed, do NOT edit)     |
| `phpstan-baseline-package.neon` | PHPStan | Package baseline (auto-managed, do NOT edit)                 |
| `phpstan-rector.neon`           | PHPStan | Separate config used by Rector's PHPStan integration         |
| `phpstan.php`                   | PHPStan | Bootstrap file for constants, autoloading                    |
| `main.php`                      | Shared  | Shared bootstrap for PHP quality tools (loads common config) |
| `ecs.php`                       | ECS     | Code style: rule sets, configured rules, skip list           |
| `rector.php`                    | Rector  | Refactoring: rule sets, PHP version sets, skip list          |

### PHPStan config (`phpstan.neon`)

- **Level 9** (strictest) with `checkMissingCallableSignature: true`
- Includes baselines, PHPUnit extensions, disallowed-calls extension, ergebnis rules
- `ignoreErrors` contains patterns for known legacy issues (mysqli, legacy classes, etc.)
- `disallowedFunctionCalls` bans `var_dump()`, `print_r()`, `dd()`
- `treatPhpDocTypesAsCertain: false` — PHPDoc types are not treated as certain

### ECS config (`ecs.php`)

Returns a settings array with sections:

- `with-spacing` — indentation (spaces), line endings
- `with-php-cs-fixer-sets` — PHP-CS-Fixer rule sets (PSR-1, PSR-2, PSR-12, PHP migration sets)
- `with-prepared-sets` — PSR-12, common rules
- `with-rules` — individual rules (TrailingCommaInMultiline, LineEnding)
- `with-configured-rules` — rules with custom config (CastSpaces, PhpdocLineSpan, YodaStyle)
- `with-skip-rules` — disabled rules (ClassAttributesSeparation, PhpdocToComment, etc.)

### Rector config (`rector.php`)

Returns a settings array with sections:

- `with-php-sets` — PHP version migration sets (auto-detected from Dockerfile/composer.json)
- `with-prepared-sets` — naming (enabled), others disabled by default
- `with-rules` / `with-configured-rules` — custom rules
- `with-skip-rules` — disabled rules (risky renames, etc.)

## Baseline policy

- **NEVER** edit `phpstan-baseline.neon` or `phpstan-baseline-package.neon` by hand.
- **NEVER** add errors, update counts, or regenerate manually.
- The wrapper automatically regenerates the baseline after a clean PHPStan run.

## PHPStan error handling

Priority order for dealing with PHPStan errors:

1. **Fix the code** — always the first choice. Fix the actual type issue.
2. **Add type hints / PHPDoc** — if the code is correct but PHPStan can't infer the type.
3. **Inline ignore (last resort)** — only for confirmed false positives:
   ```php
   // @phpstan-ignore-next-line — false positive: reason here
   ```

### When `phpstan.neon` changes ARE allowed

Adding `ignoreErrors` entries to `phpstan.neon` is allowed when:

- The error is a **structural limitation** of the toolchain (e.g., Pest tests bind `$this` at runtime, PHPStan can't resolve `artisan()`,
  `get()`, etc. on `PHPUnit\Framework\TestCase`)
- The pattern applies **broadly** to a category of files (e.g., all test files), not just one specific line
- The fix would require abandoning the project's conventions (e.g., rewriting Pest tests as PHPUnit classes)

**If unsure whether a `phpstan.neon` change is appropriate → ask the user before making the change.**

### NEVER do these

- Add entries to baseline files (`phpstan-baseline.neon`, `phpstan-baseline-package.neon`)
- Add `ignoreErrors` for individual files or specific code issues that should be fixed
- Use `@phpstan-ignore-next-line` without a reason comment

See also: `php-coding` rule → PHPStan section.

## Testing framework

- **Always write tests in Pest**, not PHPUnit class syntax — unless the user explicitly asks for PHPUnit.
- Pest tests in `tests/Unit/` automatically use `UnitTestCase` as the base class (configured in `tests/Pest.php`).
- PHPStan cannot fully resolve Pest's runtime bindings — this is handled via `ignoreErrors` patterns in `phpstan.neon`.

## Git-aware execution

By default, all tools only check files changed since the last commit.

| Flag                         | Effect                                        |
|------------------------------|-----------------------------------------------|
| (default)                    | Only changed files (fast, for iterative work) |
| `--ignore-git`               | All files (cache still applies)               |
| `--clear-cache`              | Changed files, but ignore cache               |
| `--ignore-git --clear-cache` | Complete fresh run of all files               |

---

# JS/TS Quality Tools

## Detection

Check `package.json` for available tools:

| Indicator                             | Tool                                                          |
|---------------------------------------|---------------------------------------------------------------|
| `@biomejs/biome` in devDependencies   | **Biome** — linting + formatting                              |
| `typescript` in devDependencies       | **TypeScript** — type checking                                |
| `jest` or `vitest` in devDependencies | **Test runner**                                               |
| `eslint` in devDependencies           | **ESLint** — legacy linting (check if Biome replaces it)      |
| `prettier` in devDependencies         | **Prettier** — legacy formatting (check if Biome replaces it) |

## Biome — Linting + Formatting

Biome replaces ESLint + Prettier in one tool.

### Config

- Config file: `biome.json` or `biome.jsonc`
- Includes formatter settings (indent style, line width, trailing commas)
- Includes linter rules (recommended + custom overrides)
- Includes import sorting (via `assist.actions.source.organizeImports`)

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

### Via npm scripts (preferred)

Check `package.json` scripts — projects typically define:

```bash
npm run biome          # Check (dry-run)
npm run biome:fix      # Auto-fix
```

Always prefer npm scripts over raw `npx` commands when they exist.

## TypeScript — Type Checking

### Commands

```bash
# Type check without emitting files
npx tsc --noEmit

# Via npm script (preferred)
npm run tscheck
```

### Config

- Config file: `tsconfig.json` (may have `tsconfig.app.json`, `tsconfig.node.json` for different targets)
- `strict: true` should be enabled in all projects
- Check `compilerOptions.paths` for import aliases

## Jest / Vitest — Testing

### Commands

```bash
# Run all tests
npm test

# Run specific test file
npx jest path/to/test.spec.ts

# Run with coverage
npx jest --coverage

# Watch mode
npx jest --watch
```

## JS/TS Quality Workflow

After JS/TS code changes, run this sequence:

```
1. npx biome check --write .     → Auto-fix formatting + linting
2. npx tsc --noEmit              → Verify type safety
3. npm test                      → Run test suite
```

Or via npm scripts:

```
1. npm run biome:fix             → Auto-fix
2. npm run tscheck               → Type check
3. npm test                      → Tests
```

If step 2 finds type errors → fix them in code, then re-run step 1 (Biome may reformat).

## Execution environment

### PHP tools

All PHP commands run **inside the Docker container** (`make console` or `docker compose exec`).

### JS/TS tools

JS/TS commands run on the **host** or in a **Node container**, depending on the project setup:

1. Check if a `Makefile` / `Taskfile.yml` has targets for linting/testing.
2. Check if `docker-compose.yml` has a Node service.
3. If neither → run on the host directly.

## Auto-trigger keywords

- quality check
- quality fix
- PHPStan
- Rector
- ECS
- code style
- lint
- Biome
- type check
- tscheck

## Do NOT

- Do NOT run `vendor/bin/phpstan` or `vendor/bin/ecs` directly — use the wrapper.
- Do NOT manually edit `phpstan-baseline.neon` — it's auto-managed.
- Do NOT skip type checking (`tsc --noEmit`) for TypeScript projects.
- Do NOT run Biome without `--write` if the intent is to fix (otherwise it's dry-run only).
- Do NOT mix ESLint + Biome in the same project — check which one is active.
