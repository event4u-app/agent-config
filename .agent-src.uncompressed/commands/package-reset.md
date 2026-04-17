---
name: package-reset
skills: [composer, npm]
description: /package-reset
disable-model-invocation: true
---

# package-reset

Remove local package links created by `/package-test` and restore normal dependency resolution.

## Instructions

### 1. Detect linked packages

Scan the project for locally linked packages:

#### Composer

Read `composer.json` → `repositories` array. Find entries with `"type": "path"`:

```json
{
    "type": "path",
    "url": "/some/local/path",
    "options": { "symlink": true }
}
```

For each, extract the package name from the local path's `composer.json`.

#### npm

Check for:
- Symlinks in `node_modules/` pointing outside the project (via `npm link`)
- `overrides` in `package.json` with `file:` protocol

### 2. Present findings

**No linked packages found:**

```
✅  No locally linked packages found. Nothing to reset.
```

**One linked package:**

```
Found 1 locally linked package:

📦 {package-name} → {local-path}

1. Remove it
2. Cancel
```

**Multiple linked packages:**

```
Found {N} locally linked packages:

1. {package-name-1} → {local-path-1}
2. {package-name-2} → {local-path-2}
...
{N+1}. Remove all
{N+2}. Cancel

Which packages to remove? (comma-separated numbers or "all")
```

### 3. Remove the link

#### Composer

1. Remove the `"type": "path"` entry from `repositories` array in `composer.json`
2. If `repositories` array is now empty, remove the entire `repositories` key
3. Run:

```bash
composer update {package-name}
```

This resolves the package from Packagist (or other configured repos) again.

If the package was added only for local testing (not in the project before):

```bash
composer remove {package-name}
```

Ask which case applies:

```
Was {package-name} already a dependency before local testing?

1. Yes — update to restore the Packagist version
2. No — remove it entirely
```

#### npm

1. Run:

```bash
npm unlink {package-name}
```

2. Remove any `overrides` entry from `package.json`
3. Run `npm install` to restore the published version

If the package was added only for local testing:

```bash
npm uninstall {package-name}
```

Same question as Composer — was it a dependency before?

### 4. Verify

- **Composer:** Check `vendor/{package-name}` is NOT a symlink anymore
- **npm:** Check `node_modules/{package-name}` is NOT a symlink anymore

```
✅  {package-name} restored to published version.
   vendor/{package-name} → normal directory (not symlink)
```

Or if removed:

```
✅  {package-name} removed completely.
```

### 5. Summary

After all selected packages are processed:

```
═══════════════════════════════════════════════
Package Reset Summary
═══════════════════════════════════════════════

| # | Package | Action |
|---|---|---|
| 1 | {name} | Restored to Packagist |
| 2 | {name} | Removed |
```

## Notes

- Always verify `composer.json` / `package.json` changes look correct before running install/update.
- If `composer update` fails (e.g., version constraint mismatch), suggest adjusting the version constraint.
- This command is the counterpart to `/package-test`.
