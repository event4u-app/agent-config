---
type: "auto"
description: "Creating, editing, or modifying files inside .augment/ directory — the source of truth is .augment.uncompressed/, never edit .augment/ directly"
source: package
---

# .augment/ Source of Truth

`.augment.uncompressed/` is the **single source of truth** for all `.augment/` content.
`.augment/` contains compressed (token-optimized) copies — never edit them directly.

## The Iron Rule

```
NEVER create or edit files in .augment/ directly.
ALWAYS work in .augment.uncompressed/ — then compress.
```

## Workflow

1. **Create or edit** the file in `.augment.uncompressed/{path}`
2. **Do NOT auto-compress.** Continue working.
3. **Before commit/push:** Check if compression is needed (`task sync-changed`).
   If files need compression, ask the user:
   ```
   > 📦 {N} .augment files need compression before commit.
   >
   > 1. Compress now — run /compress
   > 2. Later — commit without compression
   ```
4. If compressing: run `/compress` command, then `task sync-mark-done -- {path}`

For new non-.md files (`.php`, configs): `task sync` copies them automatically.

**Key change:** Compression happens once before commit/push — not after every edit.
This avoids interruptions when work is still in progress.

## What "compress" means

- Remove articles (a, an, the), filler, hedging, connective fluff
- Shorten phrases: "in order to" → "to", "make sure to" → "ensure"
- Fragments OK: "Run tests before commit" not "You should always run tests before committing"
- Merge redundant bullets

## What NEVER changes during compression

- Code blocks, inline code, URLs, file paths, commands
- Headings (exact text preserved)
- Tables (structure preserved, compress cell text only)
- YAML frontmatter
- Technical terms, library names, API names
- Strong language: "NEVER", "MUST", "Do NOT" — these are load-bearing

## Quick reference

| Task | What to do |
|---|---|
| Edit existing file | Edit in `.augment.uncompressed/`, compress to `.augment/` |
| Create new `.md` | Create in `.augment.uncompressed/`, compress to `.augment/` |
| Create new non-`.md` | Create in `.augment.uncompressed/`, run `task sync` |
| Delete a file | Delete from both directories |
| Check what needs compression | `task sync-changed` |
| Mark file as compressed | `task sync-mark-done -- {path}` |
| Verify everything is in sync | `task sync-check` |
