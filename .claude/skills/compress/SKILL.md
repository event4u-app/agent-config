---
name: compress
description: "compress"
disable-model-invocation: true
---

# compress

Compress `.md` files from `.augment.uncompressed/` → token-efficient format → `.augment/`.

Uses SHA-256 hashes to track which files changed since last compression.

## Step 1: Sync non-.md files

```bash
task sync
```

Copies non-`.md` files, deletes stale files, shows changed `.md` count.

## Step 2: Get changed files

```bash
task sync-changed
```

If no files changed → done. Otherwise continue with the listed files.

## Step 3: Compress each changed .md file

Per file:

1. Read from `.augment.uncompressed/{path}`
2. Compress prose: remove articles/filler/hedging, shorten phrases, fragments OK, merge redundant bullets
3. **NEVER modify:** code blocks, inline code, URLs, headings, tables, YAML frontmatter, technical terms, dates
4. Write to `.augment/{path}`
5. Show: `{orig} → {comp} words ({saved}%)`
6. Mark as done: `task sync-mark-done -- {path}`

Batches of ~10, mark each file done after writing.

## Step 4: Verify

```bash
task sync-check
```

Must pass with ✅.

## Step 5: Summary table with per-category stats.

## Rules

- No commit/push. Never modify `.augment.uncompressed/`. Only write to `.augment/`.
- Preserve all technical content + YAML.
- **Always run `task sync-mark-done`** after writing each compressed file — this updates the hash so the file won't show as changed next time.
