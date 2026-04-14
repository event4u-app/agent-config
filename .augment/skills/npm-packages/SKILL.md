---
name: npm-packages
description: "Use when developing or maintaining npm packages — versioning, publishing, TypeScript declarations, or package.json configuration."
source: package
---

# npm-packages

## When to use

npm packages (TS libraries, shared utils, internal). Before: `package.json`, TS check, publishing target, README/CHANGELOG.

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

## Conventions: `files` array (not `.npmignore`), include LICENSE/README/CHANGELOG, `prepublishOnly` for verification.

## Gotcha: no node_modules in published, generate `.d.ts`, semver strict (breaking = major).

## Do NOT: publish node_modules/src/tests, `*` version ranges, publish without tests, skip CHANGELOG, publish with `private: true`.
