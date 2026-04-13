---
skills: [quality-tools]
description: Run quality pipeline (PHP and/or JS/TS) and fix all errors — auto-detects language from changed files
---

# quality-fix

## Step 0: Detect language

Check which files were changed to determine which pipeline(s) to run:

```bash
git diff --name-only origin/{default}..HEAD
```

| Changed files | Pipeline |
|---|---|
| `.php` files | → Run **PHP pipeline** (Steps 1–3) |
| `.js`, `.ts`, `.tsx`, `.jsx` files | → Run **JS/TS pipeline** (Steps 4–6) |
| Both | → Run **both** pipelines |

---

## PHP Pipeline

### Prerequisites

- All commands run **inside the PHP container** (e.g. `docker compose exec -T <service> ...`).
- Detect the project type:
  - `galawork/php-quality` installed → `php artisan quality:phpstan` / `php artisan quality:rector --fix`
  - `phpstan/phpstan` installed → `vendor/bin/phpstan analyse`
  - `rector/rector` installed → `vendor/bin/rector process`
  - `symplify/easy-coding-standard` installed → `vendor/bin/ecs check --fix`

### Step 1: PHPStan — fix all errors

1. Run PHPStan and capture the full output.
2. For each error, **fix it in code**. Resolve the root cause.
3. **Do NOT add errors to the baseline or phpstan.neon ignore lists.**
4. If truly impossible (confirmed false positive), use inline ignore with reason.
5. After fixing, run PHPStan again.
6. Repeat until **0 errors**.

### Step 2: Rector — apply automated refactoring

1. Run Rector with the fix flag.
2. Review what Rector changed — it may introduce new PHPStan errors.
3. Run Rector again to verify no further changes are applied.
4. Repeat until Rector produces no more changes.

### Step 3: Final PHPStan verification

1. Run PHPStan one more time.
2. If new errors appeared (e.g. from Rector changes), fix them as in Step 1.
3. If fixes were needed, go back to Step 2.
4. Done when PHPStan reports **0 errors** and Rector has **no changes**.

---

## JS/TS Pipeline

### Prerequisites

- Check `package.json` for available tools and scripts.
- Determine execution environment: host, Node container, or Makefile targets.

### Step 4: Biome — auto-fix formatting + linting

1. Run Biome with auto-fix (prefer npm script if available):
   ```bash
   npm run biome:fix          # or: npx biome check --write .
   ```
2. Review what changed — especially import reordering and formatting.
3. If no Biome is installed, check for ESLint + Prettier and use those instead.

### Step 5: TypeScript — fix type errors

1. Run the type checker:
   ```bash
   npm run tscheck            # or: npx tsc --noEmit
   ```
2. For each error, **fix it in code**. Do NOT use `@ts-ignore`.
3. If truly impossible, use `@ts-expect-error` with a reason comment.
4. After fixing, re-run Biome (Step 4) — fixes may need reformatting.
5. Repeat until **0 type errors**.

### Step 6: Tests — verify nothing is broken

1. Run the test suite:
   ```bash
   npm test
   ```
2. If tests fail, fix the failing tests or the code that broke them.
3. After fixing, re-run Steps 4–5 to ensure quality is maintained.

---

## Rules

- **Do NOT commit or push.** Only apply local changes.
- **Do NOT modify baseline files** (`phpstan-baseline.neon`) or config files (`biome.json`, `tsconfig.json`).
- **Do NOT add entries to `ignoreErrors`** in `phpstan.neon`.
- Inline ignores (`@phpstan-ignore`, `@ts-expect-error`, `biome-ignore`) are a last resort.
- Run `php -l` on modified PHP files if you made significant structural changes.

