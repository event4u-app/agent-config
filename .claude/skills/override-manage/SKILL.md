---
name: override-manage
description: "/override-manage"
disable-model-invocation: true
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

Status: **Active** (valid), **Orphaned** (original gone), **Invalid** (malformed).

### 3. Actions: `1. Review` / `2. Edit` / `3. Delete` / `4. Sync` / `5. Upgrade`

- **Review**: side-by-side original vs override + effective result
- **Edit**: read → ask changes → apply → verify
- **Delete**: confirm → delete (original becomes active)
- **Sync**: check all overrides against originals → report valid/outdated/orphaned
- **Upgrade**: show original changes → ask → apply → verify
