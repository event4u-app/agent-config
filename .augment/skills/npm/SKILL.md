---
name: npm
description: "Use when managing npm packages, scripts, or frontend build tooling — webpack, Vite, Biome, TypeScript, or Tailwind CSS."
---

# npm

## When to use

npm packages, scripts, frontend build tooling. NOT for: Composer (`composer`), publishing (`npm-packages`). Before: `package.json`, detect manager from lock file (npm/yarn/pnpm/bun), existing scripts.

## Package management

### Always use the CLI

```bash
# Install a dependency
npm install <package>

# Install a dev dependency
npm install --save-dev <package>

# Remove a dependency
npm uninstall <package>

# Install all dependencies
npm install
```

**Never manually edit `package.json`** for adding/removing dependencies — use the CLI.

### When to edit `package.json` manually

Only for:
- Adding or modifying **scripts**
- Changing **configuration** sections (e.g., `browserslist`, `engines`)
- Modifying **workspaces** setup

## Common scripts across projects

| Script | Purpose |
|---|---|
| `npm run build` | Production build (webpack/Vite) |
| `npm run dev` | Development server with HMR |
| `npm run biome` | Code quality check (Biome) |
| `npm run biome:fix` | Auto-fix code quality issues |
| `npm run tscheck` | TypeScript type checking (`tsc --noEmit`) |
| `npm run test` | Run tests (Jest/Vitest) |

## Build tools

### Detection

Check `package.json` devDependencies:
- `webpack` → Webpack project
- `vite` → Vite project
- `@biomejs/biome` → Biome for linting/formatting (replaces ESLint + Prettier)
- `typescript` → TypeScript enabled

### Biome

Projects use **Biome** instead of ESLint + Prettier:
- Config: `biome.json` or `biome.jsonc`
- Check: `npx biome check .`
- Fix: `npx biome check --write .`

### Tailwind CSS

Some projects use Tailwind CSS:
- Build: `npx @tailwindcss/cli -i input.css -o output.css --minify`
- Config: `tailwind.config.js` or `tailwind.config.ts`

## Conventions

### Version pinning

- Use **exact versions** for critical dependencies when stability matters.
- Use **caret ranges** (`^`) for general dependencies (npm default).
- Always commit the lock file.

### Node.js version

- Check `.nvmrc`, `.node-version`, or `engines` in `package.json` for the required version.
- If none exists, check the Dockerfile or CI workflow for the Node version.

### Scripts naming

- Use `kebab-case` for script names: `build-storybook`, `biome:fix`.
- Use `:` as namespace separator: `biome:fix`, `tailwind:build`.

## Gotcha: use commands not manual edits, `npm ci` in CI, `npx` over `-g`.

## Do NOT: mix package managers, commit node_modules, remove lock file.
