---
name: quality-fix
description: "Run quality pipeline on changed files and fix issues"
disable-model-invocation: true
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

Inside PHP container. `artisan` → artisan commands. Otherwise → composer.

### Step 1: PHPStan → fix all errors in code. No baseline/ignore additions. Repeat until 0.

### Step 2: Rector with `--fix`. May introduce new PHPStan errors. Repeat until no changes.

### Step 3: PHPStan again. Errors → fix → back to Step 2. Done when 0 errors + no Rector changes.

---

## JS/TS Pipeline

### Prerequisites — check `package.json` for tools/scripts. Host or Node container.

### Step 4: Biome fix (`npm run biome:fix`). No Biome → ESLint+Prettier.

### Step 5: TypeScript (`npm run tscheck`). Fix in code, no `@ts-ignore`. Re-run Biome after fixes.

### Step 6: Tests (`npm test`). Failures → fix → re-run Steps 4-5.

---

## Rules

- No commit/push. No baseline/config changes. Inline ignores = last resort. `php -l` for structural changes.
