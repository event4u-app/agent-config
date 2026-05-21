# Command Template

> Template for creating new commands in `.agent-src.uncompressed/commands/{command-name}.md`.

## Instructions

1. Create file: `.agent-src.uncompressed/commands/{command-name}.md`
2. Copy the template below
3. Replace all `{placeholders}` with actual content
4. Remove all `<!-- comments -->` when done
5. Run: `python3 scripts/skill_linter.py .agent-src.uncompressed/commands/{command-name}.md`
6. Sync: `task sync` (regenerates `.agent-src/` and `.augment/`)
7. Generate Claude symlink: `task generate-tools` (or manually create symlink)

## Template

````markdown
---
name: {command-name}
description: {Short description of what the command does}
disable-model-invocation: true
skills: [{optional-skill-1}, {optional-skill-2}]
suggestion:
  eligible: true
  trigger_description: "natural-language pattern, comma-separated examples"
  trigger_context: "concrete signal — branch name, file pattern, recent tool output"
# council_depth: deep   # uncomment for architecture/refactor/bug-diagnose commands
---

<!-- FRONTMATTER RULES (delete this comment when done):
  - name: must match the filename (without .md)
  - description: short, human-readable — what the command does
  - disable-model-invocation: ALWAYS true for commands (prevents Claude from auto-invoking)
  - skills: optional — list skills this command references or delegates to
  - suggestion: REQUIRED — drives the in-host command suggester
    - eligible: true  → set trigger_description + trigger_context
    - eligible: false → set rationale (why never auto-suggested)
    See agents/settings/contexts/command-suggestion-eligibility.md for guidance.
  - council_depth: optional — only `deep` is accepted. **Omit the key
    for default depth** (`standard` is the implicit default and is
    rejected by the schema — every frontmatter byte counts). Set `deep`
    when this command triggers AI Council on architecture, refactoring,
    or bug-diagnosis artefacts. The host translates `deep` into
    `--depth deep` on the council CLI, raising the round floor to
    `ai_council.deep_min_rounds`. See .augment/skills/ai-council/SKILL.md.
-->

# /{command-name}

{One-line summary of what this command does.}

**Source of truth:** `.agent-src.uncompressed/` — never read or edit `.agent-src/` or `.augment/` directly.

## Steps

### 1. {First step}

{What to do, what to check, what to run.}

### 2. {Second step}

{Next action.}

### 3. {Third step}

{Continue until workflow is complete.}

### N. Present findings

<!-- For audit/analysis commands: state findings, then act or hand back.
     For action commands: state what was done.

     Default-terse per the
     [Frugality Charter](../contexts/contracts/frugality-charter.md):
     no preview-then-confirm pair, no "Ready to proceed?" gate, no
     numbered options unless options differ in *consequence* (per
     `no-cheap-questions § Pre-Send Self-Check`). Routine confirmations
     are governed by `verbosity.routine_confirmations: false` (default).

     Only emit a numbered-options block when ALL of:
       1. Two or more options carry distinct consequences (not sequencing/format),
       2. The user has not fenced the next step (per `scope-control § fenced step`),
       3. No option violates `commit-policy`, `scope-control § git-ops`,
          or `non-destructive-by-default`. -->

## Rules

<!-- Command-specific constraints. Keep short. -->

- {Rule 1}
- {Rule 2}
````

## Checklist

Before considering a command complete:

- [ ] **Frontmatter**: has `name`, `description`, `disable-model-invocation: true`, `suggestion` block
- [ ] **Steps**: numbered sub-headings (`### 1.`, `### 2.`, ...)
- [ ] **Source of truth**: works on `.agent-src.uncompressed/`, not `.agent-src/` or `.augment/`
- [ ] **No auto-apply**: presents findings, asks before destructive changes
- [ ] **Linter passes**: `python3 scripts/skill_linter.py` reports 0 FAIL
- [ ] **English only**: all content in English
- [ ] **Synced**: `.agent-src/commands/` has the same file
- [ ] **Claude symlink**: `.claude/skills/{name}/SKILL.md` → `../../../.agent-src/commands/{name}.md`
