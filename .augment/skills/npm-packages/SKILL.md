---
name: npm-packages
description: "Use when developing or maintaining npm packages — versioning, publishing, TypeScript declarations, or package.json configuration."
---

# npm-packages

## When to use

Use this skill when creating, maintaining, or publishing npm packages — including TypeScript libraries, shared utilities, or internal packages.

## Before making changes

1. Check `package.json` for the current package configuration.
2. Check if the package uses TypeScript (`tsconfig.json`).
3. Check the publishing target (npm registry, GitHub Packages, private registry).
4. Read the package's `README.md` and `CHANGELOG.md`.

## Package structure

```
my-package/
├── src/                    # Source code
│   └── index.ts            # Main entry point
├── dist/                   # Built output (gitignored)
├── package.json            # Package manifest
├── tsconfig.json           # TypeScript config
├── biome.json              # Linting/formatting
├── README.md               # Documentation
├── CHANGELOG.md            # Version history
└── LICENSE                 # License file
```

## package.json essentials

### Required fields

```json
{
  "name": "@scope/package-name",
  "version": "1.0.0",
  "description": "Clear, concise description",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "engines": { "node": ">=18" }
}
```

### Entry points (modern)

```json
{
  "main": "dist/index.cjs",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  }
}
```

## Versioning

Follow **Semantic Versioning** (SemVer):

| Change | Version bump | Example |
|---|---|---|
| Bug fix, no API change | Patch | `1.0.0` → `1.0.1` |
| New feature, backward compatible | Minor | `1.0.0` → `1.1.0` |
| Breaking change | Major | `1.0.0` → `2.0.0` |

```bash
npm version patch   # 1.0.0 → 1.0.1
npm version minor   # 1.0.0 → 1.1.0
npm version major   # 1.0.0 → 2.0.0
```

## TypeScript packages

- Always generate `.d.ts` declaration files.
- Set `"declaration": true` and `"declarationMap": true` in `tsconfig.json`.
- Export types explicitly: `export type { MyType } from './types'`.
- Use `strict: true` in tsconfig.

## Publishing

### npm registry

```bash
npm login
npm publish              # Public package
npm publish --access public  # Scoped public package
```

### GitHub Packages

```bash
npm publish --registry=https://npm.pkg.github.com
```

Configure in `.npmrc`:
```
@scope:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

## Conventions

- Use `files` array in `package.json` to whitelist published files (not `.npmignore`).
- Include `LICENSE`, `README.md`, and `CHANGELOG.md` in published package.
- Use `prepublishOnly` script for build verification.
- Use `np` or `release-it` for automated release workflows.


## Auto-trigger keywords

- npm package
- package publishing
- TypeScript declarations

## Gotcha

- Don't include `node_modules` in the published package — check `.npmignore` or `files` in package.json.
- The model forgets to generate TypeScript declarations (`d.ts` files) — consumers need them.
- Semantic versioning is strict — breaking changes require a major version bump, no exceptions.

## Do NOT

- Do NOT publish `node_modules/`, `src/`, or test files.
- Do NOT use `*` version ranges in dependencies.
- Do NOT publish without running tests first.
- Do NOT forget to update `CHANGELOG.md` before publishing.
- Do NOT publish packages with `private: true` in `package.json`.
