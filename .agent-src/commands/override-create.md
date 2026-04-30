---
name: override-create
description: Creates a project-level override for a shared skill, rule, or command.
skills: [override-management, agent-docs-writing]
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "override this skill for the project, customize this rule locally"
  trigger_context: "prompt names a shared skill/rule needing project-specific behavior"
---

# /override-create

Creates an override file in `agents/overrides/` for a shared `.augment/` resource.

## Steps

### 1. Ask: What to override

Ask the user:

> What do you want to override?
> 1. **Rule** (`.augment/rules/`)
> 2. **Skill** (`.augment/skills/`)
> 3. **Command** (`.augment/commands/`)
> 4. **Guideline** (`.augment/guidelines/`)
> 5. **Template** (`.augment/templates/`)

### 2. List available originals

Based on the type, list all available files:

- **Rules:** `ls .augment/rules/*.md`
- **Skills:** `ls .augment/skills/*/SKILL.md`
- **Commands:** `ls .augment/commands/*.md`
- **Guidelines:** `find .augment/guidelines/ -name '*.md'`
- **Templates:** `find .augment/templates/ -name '*.md' -not -path '*/overrides/*'`

Present as a numbered list. Ask the user to pick one (or type a name).

### 3. Check for existing override

Check if `agents/overrides/{type}/{name}.md` already exists.

- If yes → inform the user and ask if they want to edit the existing one instead
- If no → continue

### 4. Read the original

Read the full content of the original file. Present a brief summary:

> **Original:** `.augment/skills/eloquent/SKILL.md`
> **Summary:** Writes Eloquent models with getter/setter pattern, eager loading, type safety...
> **Sections:** Core Rules, Relationships, Scopes, Query Patterns, ...

### 5. Ask: Mode

> How should the override work?
> - **extend** — The original stays active, your override adds or changes parts of it
> - **replace** — Das Original wird komplett ignoriert, dein Override ist die einzige Quelle

### 6. Ask: What to change

Based on mode:

- **extend:** "Which sections do you want to change or add?"
  - List the original's section headings
  - User picks sections or describes changes
- **replace:** "Describe what the override should do instead."

### 7. Create the override file

Use the appropriate template from `.augment/templates/overrides/{type}.md`.

Fill in:
- The correct `Mode` and `Original` path
- The user's changes/additions
- Remove template comments

**File path:** `agents/overrides/{type}/{name}.md`

- **Rules:** `agents/overrides/rules/{rule-name}.md`
- **Skills:** `agents/overrides/skills/{skill-name}.md`
- **Commands:** `agents/overrides/commands/{command-name}.md`
- **Guidelines:** `agents/overrides/guidelines/{lang}-{filename}.md` (e.g., `php-controllers.md`)
- **Templates:** `agents/overrides/templates/{template-name}.md`

**Important:** `.augment/` is a shared package — never modify files there for project-specific needs.

### 8. Verify

- Read the created file back
- Confirm with the user:

> ✅ Override created: `agents/overrides/skills/eloquent.md` (Mode: extend)
>
> Der Agent wird ab jetzt:
> 1. Load the original (`.augment/skills/eloquent/SKILL.md`)
> 2. Layer your override on top
>
> Anything else to adjust?
