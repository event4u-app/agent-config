---
type: "auto"
description: "Creating, editing, or modifying files inside .augment/ directory — the source of truth is .augment.uncompressed/, never edit .augment/ directly"
source: package
---

# .augment/ Source of Truth

`.augment.uncompressed/` = **single source of truth**. `.augment/` = compressed copies.

## Iron Rule

```
NEVER create or edit files in .augment/ directly.
ALWAYS work in .augment.uncompressed/ — then compress.
```

## Workflow

1. Create/edit in `.augment.uncompressed/{path}`
2. **Do NOT auto-compress.** Continue working.
3. **Before commit/push:** Check `task sync-changed`. If files need compression, ask:
   ```
   > 📦 {N} .augment files need compression before commit.
   >
   > 1. Compress now — run /compress
   > 2. Later — commit without compression
   ```
4. If compressing: `/compress`, then `task sync-mark-done -- {path}`

Non-.md files: `task sync` copies automatically.

**Compression happens once before commit/push — not after every edit.**

## Compression = remove filler/articles/hedging, shorten phrases, fragments OK, merge redundant bullets

## NEVER change: code blocks, inline code, URLs, headings, tables, YAML, technical terms, strong language

## Quick reference

| Task | Command |
|---|---|
| Edit/create `.md` | Edit `.augment.uncompressed/`, compress to `.augment/` |
| Create non-`.md` | Create in `.augment.uncompressed/`, `task sync` |
| Delete | Both directories |
| What needs compression? | `task sync-changed` |
| Mark compressed | `task sync-mark-done -- {path}` |
| Verify sync | `task sync-check` |
