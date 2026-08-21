# quality-tools — JS/TS quality tools

> Mode body of the [`quality-tools`](../SKILL.md) skill (router-head
> retrofit, 2026-08-20). Content moved VERBATIM from SKILL.md — load this
> file when the mode table in SKILL.md routes here.

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
