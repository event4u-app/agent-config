# Source of Truth — mechanics

Workflow, condensation rules, commands workflow, symlink mapping, and
quick reference for the
[`augment-source-of-truth`](../../../rules/augment-source-of-truth.md)
rule. The Iron Rule and the "never edit generated layers" obligation
live in the rule; this file is the lookup material the rule pulls
when authoring or pre-review verification fires.

## Workflow

1. **Create or edit** the file in `.agent-src.uncondensed/{path}`
2. **Do NOT auto-condense.** Continue working.
3. **Before commit/push:** Check if condensation is needed
   (`bash scripts/condense.sh --changed`). If files need condensation,
   ask the user:
   ```
   > 📦 {N} .agent-src files need condensation before commit.
   >
   > 1. Condense now — run /condense
   > 2. Later — commit without condensation
   ```
4. If condensing: run `/condense` command, then
   `bash scripts/condense.sh --mark-done {path}`

For new non-.md files (`.php`, configs):
`bash scripts/condense.sh --sync` copies them automatically.

**Key change:** Condensation happens once before commit/push — not after every edit.
This avoids interruptions when work is still in progress.

## What "condense" means

- Remove articles (a, an, the), filler, hedging, connective fluff
- Shorten phrases: "in order to" → "to", "make sure to" → "ensure"
- Fragments OK: "Run tests before commit" not "You should always run tests before committing"
- Merge redundant bullets

## What NEVER changes during condensation

- Code blocks, inline code, URLs, file paths, commands
- Headings (exact text preserved)
- Tables (structure preserved, condense cell text only)
- YAML frontmatter
- Technical terms, library names, API names
- Strong language: "NEVER", "MUST", "Do NOT" — these are load-bearing

## Commands workflow

Commands live in `.agent-src.uncondensed/commands/{name}.md` (single source of truth).
Claude Code reads them via symlinks in `.claude/skills/{name}/SKILL.md`.

**Required frontmatter for commands:**

```yaml
name: {command-name}
description: {what it does}
disable-model-invocation: true
```

- `name` and `disable-model-invocation: true` are required for Claude Code compatibility
- Augment ignores unknown frontmatter fields — no conflict
- Template: `.agent-src.uncondensed/templates/command.md`

**Creating a new command:**

1. Create `.agent-src.uncondensed/commands/{name}.md` (use template)
2. Run `python3 scripts/skill_linter.py` — must be 0 FAIL
3. Condense via `/condense`, which writes to `.agent-src/commands/`
4. Run `python3 scripts/condense.py --generate-tools` — creates Claude symlink automatically

**Never** create `.claude/skills/{name}/SKILL.md` manually for commands — always use the symlink workflow.

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
| Edit existing file | Edit in `.agent-src.uncondensed/`, condense to `.agent-src/` |
| Create new `.md` | Create in `.agent-src.uncondensed/`, condense to `.agent-src/` |
| Create new non-`.md` | Create in `.agent-src.uncondensed/`, run `bash scripts/condense.sh --sync` |
| Create new command | Create in `.agent-src.uncondensed/commands/`, sync, `python3 scripts/condense.py --generate-tools` |
| Delete a file | Delete from `.agent-src.uncondensed/` and `.agent-src/` |
| Check what needs condensation | `bash scripts/condense.sh --changed` |
| Mark file as condensed | `bash scripts/condense.sh --mark-done {path}` |
| Verify everything is in sync | `bash scripts/condense.sh --check` |
