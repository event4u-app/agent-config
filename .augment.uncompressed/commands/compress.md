---
skills: []
description: Compress .md files from .augment.uncompressed/ into caveman format and write to .augment/
---

# compress

Compress agent config `.md` files from `.augment.uncompressed/` into token-efficient caveman format
and write the compressed output to `.augment/`.

Uses SHA-256 hashes to track which source files changed since last compression.
Only changed files need recompression — saving tokens and time.

## Step 1: Sync non-.md files

```bash
task sync
```

This copies non-`.md` files (`.php`, etc.), deletes stale files, and shows the count of
changed `.md` files that need compression.

## Step 2: Get changed files

```bash
task sync-changed
```

This lists only `.md` files whose source has changed since the last compression (based on
stored SHA-256 hashes). If no files changed → you're done.

If you need to see ALL files regardless of change status: `task sync-list`.

## Step 3: Compress each changed .md file

For each changed `.md` file:

1. Read the source from `.augment.uncompressed/{path}`
2. Compress the prose using these rules:
   - **Remove:** articles (a, an, the), filler (just, really, basically, actually, simply, essentially),
     pleasantries, hedging, connective fluff (however, furthermore, additionally)
   - **Shorten:** "in order to" → "to", "make sure to" → "ensure", use short synonyms
   - **Fragments OK:** "Run tests before commit" not "You should always run tests before committing"
   - **Drop:** "you should", "make sure to", "remember to" — state action directly
   - **Merge** redundant bullets that say the same thing differently
3. **NEVER modify:**
   - Code blocks (``` fenced or indented)
   - Inline code (`backtick content`)
   - URLs, links, file paths, commands
   - Headings (exact text preserved)
   - Tables (structure preserved, compress cell text)
   - YAML frontmatter
   - Technical terms, library names, API names
   - Dates, version numbers, numeric values
4. Write the compressed output to `.augment/{path}`
5. Show word count: `{original} → {compressed} words ({saved}% saved)`
6. **Mark as done:** `task sync-mark-done -- {path}`

This updates the stored hash so the file won't appear as changed next time.

### Batch processing

When compressing multiple files, process them in batches of ~10.
Mark each file done after writing it. After each batch, show a progress summary:

```
Batch 1/5 complete: 10 files, avg 42% saved
```

## Step 4: Verify sync

```bash
task sync-check
```

Must pass with ✅ before finishing.

## Step 5: Summary

Show a summary table with per-category stats (files compressed, avg savings).

## Hash management

- Hashes are stored in `.augment/.compression-hashes.json` (committed to Git).
- `task sync` automatically cleans up hashes for deleted source files.
- `task sync-mark-all-done` marks ALL current `.md` files as compressed (useful after an
  initial full compression or when bootstrapping the hash file).
- A file with no stored hash is always treated as "changed".

## Rules

- **Do NOT commit or push.** Only write files.
- **Do NOT modify `.augment.uncompressed/`** — it is the source of truth.
- **Only write to `.augment/`** — the compressed output directory.
- **Preserve ALL technical content** — only compress natural language prose.
- **YAML frontmatter** in command/skill files must be preserved exactly.
- **Always run `task sync-mark-done`** after writing each compressed file.
