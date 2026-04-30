---
name: override-manage
description: Reviews, updates, and refactors existing project-level overrides.
skills: [override-management, agent-docs-writing]
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "review my overrides, update the project overrides"
  trigger_context: "existing entries under agents/overrides/"
---

# /override-manage

Manages existing overrides in `agents/overrides/`.

## Steps

### 1. Scan all overrides

```bash
find agents/overrides/ -name '*.md' -not -name '.gitkeep' | sort
```

If no overrides exist:

> No overrides found. Use `/override-create` to create one.

### 2. Present inventory

Show a table of all overrides with their status:

| # | Override | Mode | Original exists? | Status |
|---|---|---|---|---|
| 1 | `rules/php-coding.md` | extend | ✅ | Active |
| 2 | `skills/eloquent.md` | replace | ✅ | Active |
| 3 | `commands/old-cmd.md` | extend | ❌ | ⚠️ Orphaned |

**Status checks:**
- **Active** — Original exists, override is valid
- **Orphaned** — Original was deleted/renamed, override has no target
- **Invalid** — Missing `Mode` header or malformed

### 3. Ask: What to do

> What would you like to do?
> 1. **Review** — View an override in detail
> 2. **Edit** — Edit an override
> 3. **Delete** — Remove an override (original becomes active again)
> 4. **Sync** — Check all overrides against their originals
> 5. **Upgrade** — Update override after original changed

### 4a. Review

- Read the override file
- Read the original file
- Show a side-by-side comparison:
  - What the original says
  - What the override changes/adds/removes
  - Effective result (merged view for `extend` mode)

### 4b. Edit

- Read the current override
- Ask what to change
- Apply changes
- Verify the result

### 4c. Delete

- Confirm with the user:
  > ⚠️ Override `skills/eloquent.md` will be deleted.
  > The original `.augment/skills/eloquent/SKILL.md` will become active again unchanged.
  > Proceed?
- Delete the file

### 4d. Sync

For each override:
1. Read the original
2. Read the override
3. Check if the override still makes sense:
   - Does it reference sections that still exist?
   - Has the original changed significantly?
   - Are there new sections in the original that the override should address?

Report findings:

> **Sync Report:**
> - `skills/eloquent.md` — ✅ OK, override still valid
> - `rules/php-coding.md` — ⚠️ Original has new section "Enums" not covered by override
> - `commands/old-cmd.md` — ❌ Original deleted, override is orphaned

### 4e. Upgrade

When an original has changed and the override needs updating:

1. Show what changed in the original (diff-style)
2. Ask if the override needs adjustment
3. Apply changes to the override
4. Verify the result
