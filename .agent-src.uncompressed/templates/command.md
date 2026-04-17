# Command Template

> Template for creating new commands in `.agent-src.uncompressed/commands/{command-name}.md`.

## Instructions

1. Create file: `.agent-src.uncompressed/commands/{command-name}.md`
2. Copy the template below
3. Replace all `{placeholders}` with actual content
4. Remove all `<!-- comments -->` when done
5. Run: `python3 scripts/skill_linter.py .agent-src.uncompressed/commands/{command-name}.md`
6. Sync: `cp .agent-src.uncompressed/commands/{command-name}.md .augment/commands/{command-name}.md`
7. Generate Claude symlink: `task generate-tools` (or manually create symlink)

## Template

````markdown
---
name: {command-name}
description: {Short description of what the command does}
disable-model-invocation: true
skills: [{optional-skill-1}, {optional-skill-2}]
---

<!-- FRONTMATTER RULES (delete this comment when done):
  - name: must match the filename (without .md)
  - description: short, human-readable — what the command does
  - disable-model-invocation: ALWAYS true for commands (prevents Claude from auto-invoking)
  - skills: optional — list skills this command references or delegates to
-->

# /{command-name}

{One-line summary of what this command does.}

**Source of truth:** `.agent-src.uncompressed/` — never read or edit `.augment/` directly.

## Steps

### 1. {First step}

{What to do, what to check, what to run.}

### 2. {Second step}

{Next action.}

### 3. {Third step}

{Continue until workflow is complete.}

### N. Present findings

<!-- For audit/analysis commands: always present findings before applying changes.
     For action commands: show summary of what was done. -->

Ask the user:

```
> 1. {Option 1}
> 2. {Option 2}
> 3. Skip — report only
```

## Rules

<!-- Command-specific constraints. Keep short. -->

- {Rule 1}
- {Rule 2}
````

## Checklist

Before considering a command complete:

- [ ] **Frontmatter**: has `name`, `description`, `disable-model-invocation: true`
- [ ] **Steps**: numbered sub-headings (`### 1.`, `### 2.`, ...)
- [ ] **Source of truth**: works on `.agent-src.uncompressed/`, not `.augment/`
- [ ] **No auto-apply**: presents findings, asks before destructive changes
- [ ] **Linter passes**: `python3 scripts/skill_linter.py` reports 0 FAIL
- [ ] **English only**: all content in English
- [ ] **Synced**: `.augment/commands/` has the same file
- [ ] **Claude symlink**: `.claude/skills/{name}/SKILL.md` → `../../../.augment/commands/{name}.md`
