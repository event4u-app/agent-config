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
workspaces: [engineering]
packs: [engineering-base]
collision_ok:
  "artisan": "artisan runs inside the project container, never on the host"
  "composer": "composer runs inside the project container"
  "docker": "its own core subject"
# obligation: "Run PHP / artisan / composer / phpstan / rector / ecs / phpunit inside the …" — src/rules/docker-commands.md:22
obligation_frequency: "per-edit"
---

# Docker Commands

**Iron Law.** Run PHP / artisan / composer / phpstan / rector / ecs / phpunit inside the project container, never on the host.

Body migrated to `skill:docker` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).
