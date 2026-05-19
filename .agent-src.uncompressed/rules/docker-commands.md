---
type: "auto"
tier: "3"
description: "Running PHP commands inside Docker containers — artisan, composer, phpstan, rector, ecs, phpunit, tests, migrations, and any CLI tool execution"
source: package
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
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# Docker Commands

**Iron Law.** Run PHP / artisan / composer / phpstan / rector / ecs / phpunit inside the project container, never on the host.

Body migrated to `skill:docker` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
