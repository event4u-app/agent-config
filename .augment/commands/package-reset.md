---
skills: [composer, npm]
description: /package-reset
---

# package-reset

Remove local package links from `/package-test`, restore normal dependency resolution.

## Instructions

### 1. Detect linked packages

#### Composer

Read `composer.json` → `repositories`. Find `"type": "path"` entries. Extract package name from local path's `composer.json`.

#### npm

Check for:
- Symlinks in `node_modules/` pointing outside project
- `overrides` in `package.json` with `file:` protocol

### 2. Present findings

**None found:**

```
✅  No locally linked packages found. Nothing to reset.
```

**One package:**

```
📦 {package-name} → {local-path}

1. Remove it
2. Cancel
```

**Multiple:**

```
Found {N} locally linked packages:

1. {package-name-1} → {local-path-1}
2. {package-name-2} → {local-path-2}
{N+1}. Remove all
{N+2}. Cancel

Which to remove? (comma-separated numbers or "all")
```

### 3. Remove the link

For each selected package, ask:

```
Was {package-name} a dependency before local testing?

1. Yes — restore Packagist/registry version
2. No — remove entirely
```

#### Composer

1. Remove `"type": "path"` entry from `repositories`
2. Empty `repositories` → remove key entirely
3. Option 1: `composer update {package-name}`
4. Option 2: `composer remove {package-name}`

#### npm

1. `npm unlink {package-name}` or remove `overrides` entry
2. Option 1: `npm install`
3. Option 2: `npm uninstall {package-name}`

### 4. Verify

Check `vendor/` or `node_modules/` entry is NOT a symlink.

```
✅  {package-name} restored to published version.
```

Or: `✅  {package-name} removed completely.`

### 5. Summary

```
═══════════════════════════════════════════════
Package Reset Summary
═══════════════════════════════════════════════

| # | Package | Action |
|---|---|---|
| 1 | {name} | Restored |
| 2 | {name} | Removed |
```

## Notes

- Counterpart to `/package-test`
- If `composer update` fails (version constraint mismatch), suggest adjusting constraint
- Verify `composer.json`/`package.json` changes before running install
