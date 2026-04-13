---
type: "auto"
description: "Creating, editing, or modifying files inside .augment/ directory — the source of truth is .augment.uncompressed/, never edit .augment/ directly"
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
2. Compress prose → `.augment/{path}`
3. `task sync-mark-done -- {path}`

Non-.md files: `task sync` copies automatically.

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
