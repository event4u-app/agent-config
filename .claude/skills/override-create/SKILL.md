---
name: override-create
description: "/override-create"
disable-model-invocation: true
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

### 4. Read original — show summary + sections

### 5. Mode: **extend** (add/change parts) or **replace** (ignore original)

### 6. What to change — extend: pick sections. Replace: describe.

### 7. Create override

Template from `.augment/templates/overrides/{type}.md`. Path: `agents/overrides/{type}/{name}.md`. Never modify `.augment/` directly.

### 8. Verify — read back, confirm with user.
