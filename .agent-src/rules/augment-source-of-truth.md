---
type: "auto"
description: "Creating, editing, or modifying files inside .agent-src/ or .augment/ — the source of truth is .agent-src.uncompressed/, never edit the generated directories directly"
source: package
---

# Source of Truth

`.agent-src.uncompressed/` is the **single source of truth**. Compressed output
ships as `.agent-src/`. In the package repo, `.augment/` is a local projection
of `.agent-src/` for Augment Code (rules copied, rest symlinked). Consumer
projects still see `.augment/` as the installed runtime tree.

Never edit any generated layer directly:

- `.agent-src/` — compressed output shipped in the package
- `.augment/` — local projection (gitignored in package; installer output in consumers)
- `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules` — tool projections

## The Iron Rule

```
NEVER edit .agent-src/ or .augment/ directly — not even "just a small fix".
ALWAYS work in .agent-src.uncompressed/ — then compress via /compress command.
```

**ZERO exceptions.** Even if the fix is obvious, small, or "faster" — STOP.
Edit `.agent-src.uncompressed/` first. Always.

Direct edits to `.agent-src/` break compression hashes, cause CI failures, and create drift.

**Compression ONLY via `/compress` command.** Handles hashing, sync, and quality checks.

## Workflow

1. **Create or edit** the file in `.agent-src.uncompressed/{path}`
2. **Do NOT auto-compress.** Continue working.
3. **Before commit/push:** Check if compression is needed (`task sync-changed`).
   If files need compression, ask the user:
   ```
   > 📦 {N} .agent-src files need compression before commit.
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

Commands live in `.agent-src.uncompressed/commands/{name}.md` (single source of truth).
Claude Code reads them via symlinks in `.claude/skills/{name}/SKILL.md`.

**Required frontmatter for commands:**

```yaml
name: {command-name}
description: {what it does}
disable-model-invocation: true
```

- `name` and `disable-model-invocation: true` are required for Claude Code compatibility
- Augment ignores unknown frontmatter fields — no conflict
- Template: `.agent-src.uncompressed/templates/command.md`

**Creating a new command:**

1. Create `.agent-src.uncompressed/commands/{name}.md` (use template)
2. Run `python3 scripts/skill_linter.py` — must be 0 FAIL
3. Compress via `/compress`, which writes to `.agent-src/commands/`
4. Run `task generate-tools` — creates Claude symlink automatically

**Never** create `.claude/skills/{name}/SKILL.md` manually for commands — always use the symlink workflow.

## Pre-review consistency checkpoints

Before asking for review or creating a PR, verify derived outputs are not stale:

1. Run `task sync-changed` — check if `.agent-src.uncompressed/` has changes not yet compressed
2. If stale files exist: run `/compress` before pushing
3. Before merge: verify derived outputs (`.agent-src/`, `.augment/`, `.claude/skills/`) are regenerated
4. Do NOT leave `.agent-src/` stale across review cycles

## Multi-agent symlink mapping

`.claude/skills/` contains symlinks to **both** `.agent-src/skills/` and `.agent-src/commands/`.
Claude Code treats both as "skills" — but they are different artifact types in our taxonomy.

| `.claude/skills/{name}/SKILL.md` points to... | Actual type |
|---|---|
| `.agent-src/skills/{name}/SKILL.md` | **Skill** (workflow) |
| `.agent-src/commands/{name}.md` | **Command** (slash-invoked procedure) |

Always check the symlink target to determine the actual artifact type.
Commands have `disable-model-invocation: true` in their frontmatter.

## Quick reference

| Task | What to do |
|---|---|
| Edit existing file | Edit in `.agent-src.uncompressed/`, compress to `.agent-src/` |
| Create new `.md` | Create in `.agent-src.uncompressed/`, compress to `.agent-src/` |
| Create new non-`.md` | Create in `.agent-src.uncompressed/`, run `task sync` |
| Create new command | Create in `.agent-src.uncompressed/commands/`, sync, `task generate-tools` |
| Delete a file | Delete from `.agent-src.uncompressed/` and `.agent-src/` |
| Check what needs compression | `task sync-changed` |
| Mark file as compressed | `task sync-mark-done -- {path}` |
| Verify everything is in sync | `task sync-check` |
