# quality-tools — PHP quality tools

> Mode body of the [`quality-tools`](../SKILL.md) skill (router-head
> retrofit, 2026-08-20). Content moved VERBATIM from SKILL.md — load this
> file when the mode table in SKILL.md routes here.

# PHP Quality Tools

## Tool Detection

Check `composer.json` to determine which tools are available and how to run them.
Use the **first matching** command style:

| `composer.json` contains | Command style | Example |
|---|---|---|
| A project-specific quality wrapper (exposes `quality:*` commands) | `php artisan quality:*` or `composer quality:*` | `php artisan quality:phpstan` |
| `phpstan/phpstan` or `larastan/larastan` | `vendor/bin/phpstan` | `vendor/bin/phpstan analyse` |
| `rector/rector` | `vendor/bin/rector` | `vendor/bin/rector process` |
| `symplify/easy-coding-standard` | `vendor/bin/ecs` | `vendor/bin/ecs check --fix` |

**Priority:** If a project ships a `quality:*` wrapper (Artisan or Composer script), always prefer it —
wrappers typically add git-aware execution, caching, automatic baseline regeneration, and memory
management on top of the native tools.

If none of the above is installed → skip quality checks, inform the user.

All commands run **inside the Docker container** if Docker is used (`docker compose exec` or `make console`).

## Commands

### PHPStan — Static Analysis

```bash
# Native:
vendor/bin/phpstan analyse                          # Analyse all configured paths
vendor/bin/phpstan analyse --memory-limit=512M      # With memory limit
vendor/bin/phpstan analyse --error-format=github    # CI-friendly format

# With a project-specific quality wrapper:
php artisan quality:phpstan          # Laravel
composer quality:phpstan             # Composer
```

**Native flags:**

| Flag | Description |
|---|---|
| `--memory-limit=SIZE` | Set memory limit (e.g. `512M`, `1G`) |
| `--debug` | Activate debug mode |
| `--error-format=FORMAT` | Output format: `table` (default), `github`, `gitlab` |
| `--pro` | Toggle PHPStan Pro |

**Wrapper-only flags** (typical of a `quality:*` wrapper — verify in the project):

| Flag | Description |
|---|---|
| `--baseline` | Generate/update phpstan baseline file |
| `--ignore-git` | Skip Git check, analyse all files |
| `--xdebug` | Activate Xdebug mode |

### ECS — Easy Coding Standard

```bash
# Native:
vendor/bin/ecs check                  # Dry-run
vendor/bin/ecs check --fix            # Auto-fix

# With a project-specific quality wrapper:
php artisan quality:ecs --fix         # Laravel
composer quality:ecs -- --fix         # Composer
```

**Native flags:**

| Flag | Description |
|---|---|
| `--fix` | Fix errors automatically |
| `--clear-cache` | Clear the ECS cache |

**Wrapper-only flags** (typical of a `quality:*` wrapper — verify in the project):

| Flag | Description |
|---|---|
| `--ignore-git` | Skip Git check, check all files |
| `--paths-to-scan[=PATHS]` | Custom paths, e.g. `--paths-to-scan='["./core"]'` |
| `--source-branch[=BRANCH]` | Source branch (default: HEAD) |
| `--target-branch[=BRANCH]` | Target branch to compare against |

### Rector — Automated Refactoring

```bash
# Native:
vendor/bin/rector process              # Auto-fix
vendor/bin/rector process --dry-run    # Preview changes

# With a project-specific quality wrapper:
php artisan quality:rector --fix       # Laravel
composer quality:rector -- --fix       # Composer
```

**Native flags:**

| Flag | Description |
|---|---|
| `--dry-run` | Preview changes without applying |
| `--clear-cache` | Clear the Rector cache |

**Wrapper-only flags** (typical of a `quality:*` wrapper — verify in the project):

| Flag | Description |
|---|---|
| `--ignore-git` | Skip Git check, check all files |
| `--paths-to-scan[=PATHS]` | Custom paths |
| `--source-branch[=BRANCH]` | Source branch (default: HEAD) |
| `--target-branch[=BRANCH]` | Target branch to compare against |

### Combined Commands

There is no native single command for running all three tools. Run them in sequence:

```bash
# Full pipeline (native):
vendor/bin/rector process && vendor/bin/ecs check --fix && vendor/bin/phpstan analyse

# With a project-specific quality wrapper (if it ships these combined commands):
php artisan quality:refactor --fix     # Rector + ECS
php artisan quality:finalize           # Rector + ECS + PHPStan (full pipeline)
```

## Procedure: Run quality checks

1. Run PHPStan — fix all errors
2. Run Rector + ECS with auto-fix — fix style + refactoring
3. Run PHPStan again — verify step 2 didn't introduce new issues

If step 3 finds errors → fix and repeat from step 2.

Detect commands from project (see Tool Detection above).

## Configuration

Config files are typically in the **project root**. Do NOT modify without explicit user permission.

Detect config location:
- Check project root first: `phpstan.neon`, `ecs.php`, `rector.php`
- Some projects use `phpstan.neon.dist` instead of `phpstan.neon`

### Standard config files

| File | Tool | Purpose |
|---|---|---|
| `phpstan.neon` | PHPStan | Level, paths, extensions, `ignoreErrors`, disallowed calls |
| `phpstan-baseline.neon` | PHPStan | Baseline for existing errors (auto-managed, do NOT edit) |
| `ecs.php` | ECS | Code style: rule sets, configured rules, skip list |
| `rector.php` | Rector | Refactoring: rule sets, PHP version sets, skip list |

### Understanding the project's config

Read the actual config files to understand what rules are active:

- **phpstan.neon**: Check `level`, `paths`, `ignoreErrors`, `includes` (baselines, extensions)
- **ecs.php**: Check which rule sets are active (PSR-12, PHP-CS-Fixer sets), skip list
- **rector.php**: Check PHP version sets, active rule sets, skip list

Common patterns across projects:
- PHPStan at high levels (8-9) with `disallowedFunctionCalls` banning `var_dump()`, `dd()`
- ECS with PSR-12 base, trailing commas, Yoda style
- Rector with PHP version migration sets and naming conventions

## Baseline policy

- **NEVER** edit `phpstan-baseline.neon` by hand.
- **NEVER** add errors, update counts, or regenerate manually.
- If the project ships a quality wrapper (exposing `quality:*` commands), it may regenerate the baseline automatically.

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

- Add entries to baseline files (`phpstan-baseline.neon`)
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

