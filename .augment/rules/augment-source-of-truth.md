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

## Commands workflow

Commands live in `.augment.uncompressed/commands/{name}.md` (single source of truth).
Claude Code reads them via symlinks in `.claude/skills/{name}/SKILL.md`.

**Required frontmatter for commands:**

```yaml
name: {command-name}
description: {what it does}
disable-model-invocation: true
```

- `name` and `disable-model-invocation: true` are required for Claude Code compatibility
- Augment ignores unknown frontmatter fields — no conflict
- Template: `.augment.uncompressed/templates/command.md`

**Creating a new command:**

1. Create `.augment.uncompressed/commands/{name}.md` (use template)
2. Run `python3 scripts/skill_linter.py` — must be 0 FAIL
3. Sync: `cp` to `.augment/commands/`
4. Run `task generate-tools` — creates Claude symlink automatically

**Never** create `.claude/skills/{name}/SKILL.md` manually for commands — always use the symlink workflow.

## Pre-review consistency checkpoints

Before review or PR, verify derived outputs are not stale:

1. Run `task sync-changed` — check for uncompressed changes
2. If stale: run `/compress` before pushing
3. Before merge: verify `.augment/` and `.claude/skills/` are regenerated
4. Do NOT leave `.augment/` stale across review cycles

## Multi-agent symlink mapping

`.claude/skills/` has symlinks to BOTH `.augment/skills/` AND `.augment/commands/`.
Claude Code treats both as "skills" — different artifact types in our taxonomy.

| Symlink target | Actual type |
|---|---|
| `.augment/skills/{name}/SKILL.md` | **Skill** |
| `.augment/commands/{name}.md` | **Command** (`disable-model-invocation: true`) |

Always check symlink target to determine actual type.

## Quick reference

| Task | What to do |
|---|---|
| Edit existing file | Edit in `.augment.uncompressed/`, compress to `.augment/` |
| Create new `.md` | Create in `.augment.uncompressed/`, compress to `.augment/` |
| Create new non-`.md` | Create in `.augment.uncompressed/`, run `task sync` |
| Create new command | Create in `.augment.uncompressed/commands/`, sync, `task generate-tools` |
| Delete a file | Delete from both directories |
| Check what needs compression | `task sync-changed` |
| Mark file as compressed | `task sync-mark-done -- {path}` |
| Verify everything is in sync | `task sync-check` |
