---
type: "auto"
tier: "3"
description: "Running PHP inside Docker — artisan, composer, phpstan, rector, ecs, phpunit, tests, migrations, any CLI tool"
triggers:
  - keyword: "docker"
  - keyword: "artisan"
  - keyword: "composer"
  - phrase: "inside the container"
routes_to:
  - "skill:docker"
workspaces:
  - engineering
packs:
  - engineering-base
---

# Docker Commands

**Iron Law.** Run PHP / artisan / composer / phpstan / rector / ecs / phpunit inside the project container, never on the host.

Body migrated to `skill:docker` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
