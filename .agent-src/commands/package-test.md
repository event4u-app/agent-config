---
name: package-test
skills: [composer, npm]
description: /package-test
disable-model-invocation: true
---

# package-test

Test a local package in the current project by linking it via Composer or npm.

## Instructions

### 1. Detect or ask for package manager

Check the project root for `composer.json` and `package.json`.

- **Both exist** → ask:

```
Which package manager?

1. Composer (PHP)
2. npm (JavaScript/TypeScript)
```

- **Only one exists** → use that one automatically, confirm:

```
Detected: {manager}. Proceeding.
```

- **Neither exists** → abort:

```
❌  No composer.json or package.json found in project root. Cannot link a local package.
```

### 2. Ask for the local package path

```
Where is the local package located?

Provide the absolute or relative path to the package directory.
Example: ../my-package or /Users/me/projects/my-package
```

Validate:
- Path exists and is a directory
- For Composer: directory contains `composer.json`
- For npm: directory contains `package.json`

If invalid, show error and ask again.

### 3. Read the package name

- **Composer:** Read `name` from the package's `composer.json`
- **npm:** Read `name` from the package's `package.json`

Confirm:

```
📦 Found package: {package-name}
   Path: {resolved-absolute-path}

1. Link it
2. Different package — let me re-enter
3. Cancel
```

### 4. Link the package

#### Composer

Add or update `repositories` array in the **project's** `composer.json`:

```json
{
    "type": "path",
    "url": "{absolute-path-to-package}",
    "options": {
        "symlink": true
    }
}
```

Then run:

```bash
composer require {package-name}:@dev
```

If the package is already required, run instead:

```bash
composer update {package-name}
```

#### npm

Run:

```bash
npm link {absolute-path-to-package}
```

Or for workspaces, add to `package.json`:

```json
"overrides": {
    "{package-name}": "file:{relative-or-absolute-path}"
}
```

Then: `npm install`

### 5. Verify

- **Composer:** Check that `vendor/{package-name}` is a symlink → the local path
- **npm:** Check that `node_modules/{package-name}` is a symlink → the local path

Report result:

```
✅  {package-name} linked successfully.
   vendor/{package-name} → {local-path}

To remove: run /package-reset
```

### 6. Remind about .gitignore

If the `repositories` entry (Composer) or `overrides` (npm) was added:

```
⚠️  Local package link added to {file}. Don't commit this change to the repository.
```

## Error Handling

- If `composer require` or `npm link` fails, show the error output and suggest:

```
1. Retry
2. Show me the full error
3. Cancel — I'll fix manually
```

## Notes

- Composer path repositories with `symlink: true` create a symlink in `vendor/` pointing to the local directory. Changes in the local package are immediately reflected.
- npm link creates a symlink in `node_modules/`.
- Multiple local packages can be linked simultaneously. Each `/package-test` invocation adds one.
- The `/package-reset` command reverses these changes.
