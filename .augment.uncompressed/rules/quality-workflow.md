---
type: "auto"
description: "Quality workflow for running PHPStan, Rector, and ECS code quality checks"
---

# Quality Workflow

**Run quality tools ONCE at the very end of all work** — not after each edit.
See `verify-before-complete` rule for the full timing policy.

For full command reference, all parameters, and config details → see the `quality-tools` skill.
For PHPStan inline ignores and PHPDoc rules → see `php-coding` rule.

## Language detection

Detect which pipeline to run based on **changed file extensions**:

| Files changed | Pipeline |
|---|---|
| `.php` | PHP pipeline (PHPStan → Rector → PHPStan) |
| `.js`, `.ts`, `.tsx`, `.jsx` | JS/TS pipeline (Biome → TSC → Tests) |
| Both | Run **both** pipelines |

```bash
# Quick detection (replace {default} with your default branch, e.g. main)
git diff --name-only origin/{default}..HEAD | grep -E '\.(php)$'       # → PHP tools needed
git diff --name-only origin/{default}..HEAD | grep -E '\.(js|ts|tsx)$'  # → JS/TS tools needed
```

---

## PHP Pipeline

### Prerequisite

Check `composer.json` for available quality tools. At minimum one of:
`phpstan/phpstan`, `larastan/larastan`, `rector/rector`, `symplify/easy-coding-standard`, or `galawork/php-quality`.

See `quality-tools` skill for full detection logic and exact commands.

### Execution

Detect commands from project (see `quality-tools` skill → Tool Detection):

```bash
# Native (default):
vendor/bin/phpstan analyse             # PHPStan
vendor/bin/rector process              # Rector (auto-fix)
vendor/bin/ecs check --fix             # ECS (auto-fix)

# With galawork/php-quality wrapper (if installed):
php artisan quality:phpstan            # PHPStan
php artisan quality:rector --fix       # Rector
php artisan quality:ecs --fix          # ECS
php artisan quality:finalize           # Full pipeline
```

All commands run **inside the Docker container** if Docker is used.

### Workflow

1. Run PHPStan — fix all type errors in code.
2. Run Rector + ECS with auto-fix — auto-fix style + refactoring.
3. Run PHPStan again — verify step 2 didn't introduce new issues.

If step 3 finds errors → fix and repeat from step 2.

### Baseline — NEVER touch manually

- **NEVER** edit `phpstan-baseline.neon` by hand.
- **NEVER** add errors, update counts, or regenerate the baseline manually.
- The baseline is **automatically regenerated** after a successful PHPStan run (0 new errors).

### Error handling — fix the root cause

- Always fix the actual code — do NOT suppress, ignore, or baseline errors.
- Only as **absolute last resort** (confirmed false positive), use inline ignore with reason:
  `// @phpstan-ignore-next-line — false positive: reason here`
- See also: `php-coding` rule → PHPStan section.

### Config files

Config files live in the **project root**:

| File | Tool | Purpose |
|---|---|---|
| `phpstan.neon` | PHPStan | Level, paths, extensions, ignoreErrors |
| `phpstan-baseline.neon` | PHPStan | Baseline (auto-managed, do NOT edit) |
| `ecs.php` | ECS | Code style rules and skip list |
| `rector.php` | Rector | Refactoring rules, PHP version sets, skip list |

- **Baseline file** — NEVER edit manually. It is auto-managed.
- **`phpstan.neon` `ignoreErrors`** — allowed for structural toolchain limitations (e.g., Pest runtime bindings that PHPStan can't resolve). NOT for individual code issues. **If unsure → ask the user.**
- **Other config files** — do NOT modify without explicit user permission.

### Git-aware execution

By default, all tools only check files changed since the last commit.
- `--ignore-git` → check all files (cache still applies)
- `--clear-cache` → force full re-check
- Both combined → complete fresh run

---

## JS/TS Pipeline

### Prerequisite

Check `package.json` for available tools:
- `@biomejs/biome` → Biome (linting + formatting)
- `typescript` → TypeScript type checking
- `jest` or `vitest` → Test runner

If no linting tool is installed, skip the linting step.

### Execution

Check `package.json` scripts first — prefer npm scripts over raw `npx`:

```bash
# Via npm scripts (preferred)
npm run biome:fix      # Auto-fix formatting + linting
npm run tscheck        # Type check
npm test               # Tests

# Via npx (fallback if no scripts defined)
npx biome check --write .
npx tsc --noEmit
npx jest
```

JS/TS tools run on the **host** or in a **Node container** — check `Makefile` / `docker-compose.yml`.

### Workflow

1. `npm run biome:fix` — Auto-fix formatting, linting, import sorting.
2. `npm run tscheck` — Verify type safety (fix errors in code, not with `@ts-ignore`).
3. `npm test` — Run test suite.

If step 2 finds errors → fix them, then re-run step 1 (Biome may reformat).

### Error handling

- Always fix type errors in code. Do NOT use `@ts-ignore` or `@ts-expect-error` without a reason.
- Biome errors should be fixed, not disabled via `biome-ignore` unless confirmed false positive.
- Config files (`biome.json`, `tsconfig.json`) — do NOT modify without explicit user permission.
