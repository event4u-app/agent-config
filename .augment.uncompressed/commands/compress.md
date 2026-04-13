---
skills: []
description: Compress .md files from .augment.uncompressed/ into caveman format and write to .augment/
---

# compress

Compress agent config `.md` files from `.augment.uncompressed/` into token-efficient caveman format
and write the compressed output to `.augment/`.

## Step 1: Determine scope

Ask the user:

> 1. All files — compress all `.md` files (run `make sync-list` to see the list)
> 2. Changed files — only files changed since last compression
> 3. Specific file — I'll provide the path

If **all**: run `make sync-list` to get the full list.
If **changed**: run `git diff --name-only .augment.uncompressed/` to find changed source files.
If **specific**: ask for the relative path (e.g. `rules/token-efficiency.md`).

## Step 2: Sync non-.md files first

```bash
make sync
```

This copies non-`.md` files (`.php`, etc.) and deletes stale files.

## Step 3: Compress each .md file

For each `.md` file in scope:

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

### Batch processing

When compressing multiple files, process them in batches of ~10.
After each batch, show a progress summary:

```
Batch 1/20 complete: 10 files, avg 42% saved
```

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

- **Do NOT commit or push.** Only write files.
- **Do NOT modify `.augment.uncompressed/`** — it is the source of truth.
- **Only write to `.augment/`** — the compressed output directory.
- **Preserve ALL technical content** — only compress natural language prose.
- **YAML frontmatter** in command/skill files must be preserved exactly.
