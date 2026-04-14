---
skills: [composer, npm]
description: /package-test
---

# package-test

Link a local package for testing via Composer or npm.

## Instructions

### 1. Detect or ask for package manager

Check project root for `composer.json` and `package.json`.

- **Both** → ask:

```
Which package manager?

1. Composer (PHP)
2. npm (JavaScript/TypeScript)
```

- **Only one** → use automatically, confirm: `Detected: {manager}. Proceeding.`
- **Neither** → abort: `❌  No composer.json or package.json found.`

### 2. Ask for local package path

```
Where is the local package located?

Absolute or relative path. Example: ../my-package
```

Validate: path exists, is directory, contains `composer.json` (Composer) or `package.json` (npm). Invalid → error + ask again.

### 3. Read package name

- **Composer:** `name` from package's `composer.json`
- **npm:** `name` from package's `package.json`

```
📦 Found package: {package-name}
   Path: {resolved-absolute-path}

1. Link it
2. Different package — re-enter
3. Cancel
```

### 4. Link the package

#### Composer

Add to project's `composer.json` → `repositories`:

```json
{
    "type": "path",
    "url": "{absolute-path}",
    "options": { "symlink": true }
}
```

Then:
- Package already required → `composer update {package-name}`
- New package → `composer require {package-name}:@dev`

#### npm

```bash
npm link {absolute-path}
```

Or with overrides in `package.json`:

```json
"overrides": { "{package-name}": "file:{path}" }
```

Then: `npm install`

### 5. Verify

Check `vendor/{package-name}` or `node_modules/{package-name}` is symlink → local path.

```
✅  {package-name} linked successfully.
   vendor/{package-name} → {local-path}

To remove: run /package-reset
```

### 6. Warn about .gitignore

```
⚠️  Local package link added to {file}. Don't commit this change.
```

## Error Handling

If install/link fails:

```
1. Retry
2. Show full error
3. Cancel — fix manually
```

## Notes

- Composer path repos with `symlink: true` → symlink in `vendor/`, changes reflected immediately
- npm link → symlink in `node_modules/`
- Multiple packages can be linked simultaneously
- `/package-reset` reverses these changes
