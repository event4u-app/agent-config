---
skills: []
description: Compress .md files from .augment.uncompressed/ into caveman format and write to .augment/
---

# compress

Compress `.md` files from `.augment.uncompressed/` → token-efficient format → `.augment/`.

## Step 1: Scope

Ask: `1. All` (`make sync-list`) / `2. Changed` (`git diff --name-only .augment.uncompressed/`) / `3. Specific path`

## Step 2: Sync non-.md files first

```bash
make sync
```

This copies non-`.md` files (`.php`, etc.) and deletes stale files.

## Step 3: Compress each .md file

Per `.md` file:

1. Read from `.augment.uncompressed/{path}`
2. Compress prose: remove articles/filler/hedging, shorten phrases, fragments OK, merge redundant bullets
3. **NEVER modify:** code blocks, inline code, URLs, headings, tables, YAML frontmatter, technical terms, dates
4. Write to `.augment/{path}`
5. Show: `{orig} → {comp} words ({saved}%)`

Batches of ~10, show progress per batch.

## Step 4: Verify sync

```bash
make sync-check
```

Must pass with ✅ before finishing.

## Step 5: Summary

Show a summary table:

```
| Category   | Files | Avg savings |
|------------|------:|------------:|
| rules      |    20 |        45%  |
| skills     |   100 |        38%  |
| commands   |    40 |        42%  |
| guidelines |    20 |        35%  |
| contexts   |     5 |        40%  |
| templates  |     5 |        30%  |
| **Total**  | **190** | **40%** |
```

## Rules

- No commit/push. Never modify `.augment.uncompressed/`. Only write to `.augment/`. Preserve all technical content + YAML.
