---
title: Configuration Overview
description: The .agent-settings.yml file — its layered merge order, write surfaces, and how it is validated and synced.
---

All configuration lives in **`.agent-settings.yml`**. The canonical, richly
commented template is
[`src/config/agent-settings.template.yml`](https://github.com/event4u-app/agent-config/blob/main/src/config/agent-settings.template.yml);
the installer renders it into your project (or user-global) settings.

```yaml
# .agent-settings.yml (excerpt)
profile:
  id: developer
discipline_profile: auto
personal:
  autonomy: auto
quality:
  local_auto_run: false
```

## Layered merge (lowest → highest precedence)

1. Package defaults (the template).
2. `~/.event4u/agent-config/agent-settings.yml` — user-global, **whitelist-filtered**
   to six DX keys (`name`, `ide`, `rule_loading_tier`, `personal.bot_icon`,
   `personal.autonomy`, `telegraph.speak_scope`).
3. `<repo-root>/.agent-settings.yml`.
4. Intermediate-directory settings.
5. `<CWD>/.agent-settings.yml` — deepest wins.

**Project-local always beats user-global.**

## Two ways to write it

- **The GUI** — `agent-config config` (or `settings`) opens a local settings
  editor (loopback-bound, two-phase commit, comment-preserving merge).
- **Hand-editing** the YAML directly — skips validation and locking, so prefer
  the GUI for anything non-trivial.

## Validation & sync

- `agent-config settings:check` — validate against the settings contract (read-only).
- `agent-config settings:sync` — additively merge new template keys into your file.
- `agent-config validate` — drift gate suitable for CI.

The schema
([`src/scripts/schemas/agent-settings.schema.json`](https://github.com/event4u-app/agent-config/blob/main/src/scripts/schemas/agent-settings.schema.json))
is deliberately permissive (`additionalProperties: true`) and only enum-guards
the value-bearing keys that historically collided.

## Next

- [Settings Reference](/agent-config/configuration/settings-reference/) — the key groups.
- [Profiles](/agent-config/configuration/profiles/) — the four profile concepts, disambiguated.
