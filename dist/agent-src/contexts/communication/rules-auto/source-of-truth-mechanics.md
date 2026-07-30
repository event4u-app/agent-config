# Source of Truth — mechanics

Workflow, condensation rules, commands workflow, symlink mapping, and
quick reference for the
[`source-of-truth`](../../../rules/source-of-truth.md)
rule. The Iron Rule and the "never edit a generated projection" obligation
live in the rule; this file is the lookup material the rule pulls
when authoring or pre-review verification fires.

## Workflow

1. **Create or edit** the file in `src/{path}` (e.g. `src/rules/`, `src/skills/`,
   `src/agent-src/`, `src/domains/<pack>/`)
2. **Do NOT auto-condense.** Continue working.
3. **Before commit/push:** Check whether any projection is out of date
   (`bash src/scripts/condense.sh --changed` — `dist != rewrite(src)`). If files
   are listed, ask the user:
   ```
   > 📦 {N} dist/agent-src files are out of date before commit.
   >
   > 1. Sync now — run /condense
   > 2. Later — commit without syncing
   ```
4. If syncing: run the `/condense` command — `--sync` writes the projection,
   nothing has to be marked afterwards.

For new non-.md files (`.php`, configs):
`bash src/scripts/condense.sh --sync` copies them automatically.

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

Commands live in `src/agent-src/commands/{name}.md` (single source of truth).
Claude Code reads them via symlinks in `.claude/skills/{name}/SKILL.md`.

**Required frontmatter for commands:**

```yaml
name: {command-name}
description: {what it does}
disable-model-invocation: true
```

- `name` and `disable-model-invocation: true` are required for Claude Code compatibility
- Tools that don't recognise a frontmatter field ignore it — no conflict
- Template: `src/agent-src/templates/command.md`

**Creating a new command:**

1. Create `src/agent-src/commands/{name}.md` (use template)
2. Run `./scripts-run src/scripts/skill_linter` — must be 0 FAIL
3. Condense via `/condense`, which writes to `dist/agent-src/commands/`
4. Run `./scripts-run src/scripts/condense --generate-tools` — creates Claude symlink automatically

**Never** create `.claude/skills/{name}/SKILL.md` manually for commands — always use the symlink workflow.

## Multi-agent symlink mapping

`.claude/skills/` contains symlinks to **both** `dist/agent-src/skills/` and `dist/agent-src/commands/`.
Claude Code treats both as "skills" — but they are different artifact types in our taxonomy.

| `.claude/skills/{name}/SKILL.md` points to... | Actual type |
|---|---|
| `dist/agent-src/skills/{name}/SKILL.md` | **Skill** (workflow) |
| `dist/agent-src/commands/{name}.md` | **Command** (slash-invoked procedure) |

Always check the symlink target to determine the actual artifact type.
Commands have `disable-model-invocation: true` in their frontmatter.

## Quick reference

| Task | What to do |
|---|---|
| Edit existing file | Edit in `src/`, condense to `dist/agent-src/` |
| Create new `.md` | Create in `src/`, condense to `dist/agent-src/` |
| Create new non-`.md` | Create in `src/`, run `bash src/scripts/condense.sh --sync` |
| Create new command | Create in `src/agent-src/commands/`, sync, `./scripts-run src/scripts/condense --generate-tools` |
| Delete a file | Delete from `src/` and `dist/agent-src/` |
| Check which projections are out of date | `bash src/scripts/condense.sh --changed` |
| Verify everything is in sync | `bash src/scripts/condense.sh --check` |
