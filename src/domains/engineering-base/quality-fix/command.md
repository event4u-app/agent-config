---
model_tier: medium
name: quality-fix
pack: engineering-base
tier: 2
skills: [quality-tools]
description: Run quality pipeline (PHP and/or JS/TS) and fix all errors — auto-detects language from changed files
suggestion:
  eligible: true
  trigger_description: "fix the quality errors — run the project's type-checker / linter / formatter and resolve every issue (PHPStan / tsc / mypy / golangci-lint / clippy / …)"
  trigger_context: "type-checker / linter / formatter output in recent tool results (PHPStan, Rector, ECS, tsc, eslint, prettier, ruff, mypy, golangci-lint, clippy)"
workspaces:
  - agent-config-maintainer
packs:
  - meta
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
- Detect the project's quality toolchain **before** doing anything else. Pick the first match:
  1. Project ships a wrapper script — prefer the wrapper over invoking tools directly:
     - PHP: `php artisan quality:*` (Laravel), `composer run quality`, `composer run lint`
     - JS / TS: `npm run lint`, `npm run typecheck`, `pnpm lint`, `pnpm typecheck`, `yarn lint`, `yarn typecheck`
     - Python: `make lint`, `nox -s lint`, `tox -e lint`
     - Polyglot: `Taskfile.yml`, `Makefile`, or `justfile` with a `quality` / `lint` / `check` target
  2. No wrapper — invoke tools directly based on which are installed:
     - PHP: `vendor/bin/phpstan analyse`, `vendor/bin/rector process`, `vendor/bin/ecs check --fix`
     - JS / TS: `npx tsc --noEmit`, `npx eslint . --fix`, `npx prettier . --write`, `npx biome check --apply`
     - Python: `ruff check . --fix`, `ruff format .`, `mypy .`, `pyright`
     - Go: `golangci-lint run --fix`, `go vet ./...`, `gofmt -w .`
     - Rust: `cargo clippy --fix --allow-dirty`, `cargo fmt`
  3. Nothing detected → ask the user which command runs the project's quality pipeline. Do not invent one.

### Step 1: Type-checker — fix all errors

Run the project's type-checker (chosen in the detection step):
- PHP → PHPStan
- JS / TS → `tsc --noEmit`
- Python → mypy / pyright
- Go → `go vet` + `go build`
- Rust → `cargo check`

1. Run the type-checker and capture the full output.
2. For each error, **fix it in code**. Resolve the root cause.
3. **Do NOT add errors to the baseline or ignore list** (`phpstan-baseline.neon`, `tsconfig.json` `exclude`, `# type: ignore`, `// @ts-ignore`, `#[allow(...)]`, `//nolint`).
4. If truly impossible (confirmed false positive), use the language-native inline ignore with a one-line reason: `@phpstan-ignore`, `// @ts-expect-error: <reason>`, `# type: ignore[<code>]  # <reason>`, `//nolint:<linter> // <reason>`, `#[allow(<lint>)] // <reason>`.
5. After fixing, re-run the type-checker.
6. Repeat until **0 errors**.

### Step 2: Auto-fixer / refactoring tool — apply transforms

Run the project's auto-fixer / refactoring tool (skip the step entirely if the project does not ship one):
- PHP → `vendor/bin/rector process`
- JS / TS → `npx eslint . --fix` (rule auto-fixes), `npx biome check --apply-unsafe` (safe transforms only)
- Python → `ruff check . --fix` (lint auto-fixes), `ruff check . --fix --unsafe-fixes` (broader)
- Go → `golangci-lint run --fix`, `gofmt -w .`, `goimports -w .`
- Rust → `cargo clippy --fix --allow-dirty --allow-staged`, `cargo fmt`

1. Run the auto-fixer with the apply / fix flag.
2. Review the diff — auto-fixes may introduce new type-checker errors or change semantics on edge cases.
3. Re-run the auto-fixer to verify it produces no further changes.
4. Repeat until the auto-fixer is idempotent.

### Step 3: Final type-checker verification

1. Run the type-checker (from Step 1) one more time.
2. If new errors appeared (e.g. from auto-fixer changes), fix them as in Step 1.
3. If fixes were needed, go back to Step 2.
4. Done when the type-checker reports **0 errors** **and** the auto-fixer is idempotent. Also run the formatter once at the very end (`vendor/bin/ecs check --fix` / `prettier --write` / `ruff format` / `cargo fmt`) to normalise whitespace.

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
- **Do NOT modify baseline files** (`phpstan-baseline.neon`, `tsconfig.json` `exclude`, `.mypy.ini` ignore list, `.eslintrc` `ignorePatterns`, `clippy.toml` `allow` list).
- **Do NOT widen ignore lists** in the config (`ignoreErrors`, `exclude`, `# type: ignore` blanket, `eslint-disable` file-wide).
- Inline ignores (`@phpstan-ignore`, `@ts-expect-error`, `# type: ignore[code]`, `biome-ignore`, `eslint-disable-next-line`, `//nolint:`, `#[allow(...)]`) are a last resort and must carry a one-line reason.
- After significant structural changes, run a language-level syntax check (`php -l <file>`, `node --check <file>`, `python -m py_compile <file>`, `go build ./...`, `cargo check`) before claiming the file is fixed.
