---
skills: []
description: Compress .md files from .augment.uncompressed/ into caveman format and write to .augment/
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

**Compression must improve execution quality, not just reduce length.**

Per file:

1. Read from `.augment.uncompressed/{path}`
2. **Remove:** articles/filler/hedging, redundant wording, obvious knowledge, decorative prose. Shorten phrases, fragments OK, merge redundant bullets. Prefer bullets over prose, direct instructions over paragraphs.
3. **NEVER modify:** code blocks, inline code, URLs, headings, tables, YAML frontmatter, technical terms, dates
4. **NEVER remove:** trigger clarity, decision hints, concrete validation, gotchas, anti-patterns
5. **Enrich (SKILL.md only):** concretize vague validation, add mini safe/unsafe example if missing, sharpen Output format, add anti-patterns if recurring mistakes. Don't invent — concretize what source implies. Don't compress weak skills — fix structure first. Reference: `.augment.uncompressed/skills/skill-writing/SKILL.md`
6. **Compare:** compressed must be at least as safe and executable as original
7. Write to `.augment/{path}`
8. Show: `{orig} → {comp} words ({saved}%)`
9. Mark as done: `task sync-mark-done -- {path}`

Batches of ~10, mark each file done after writing.

## Step 4: Verify

```bash
task sync-check
```

Must pass with ✅.

## Step 5: Summary table with per-category stats.

## Compression quality checklist

Per file verify:
- Code blocks, inline code, URLs, file paths — unchanged
- YAML frontmatter — identical to source
- Headings — match source exactly
- "NEVER", "MUST", "Do NOT" — preserved
- Technical terms, library/API names — unchanged
- No meaning lost, no sections removed
- 20-50% word count reduction (typical)

### Safe vs unsafe

Safe:
- "You should always make sure to run tests before committing" → "Run tests before commit"
- "In order to ensure configuration is correct" → "To verify config"

Unsafe (DO NOT):
- Removing bullet with unique information
- Changing `php artisan test --filter=MyTest` → `php artisan test`
- Shortening "Do NOT use float for money" → "Avoid float"
- Removing "NEVER" from "NEVER add to phpstan-baseline.neon"

## Rules

- No commit/push. Never modify `.augment.uncompressed/`. Only write to `.augment/`.
- Preserve all technical content + YAML.
- **Always run `task sync-mark-done`** after writing each compressed file.
