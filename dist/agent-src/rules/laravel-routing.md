---
type: "auto"
tier: "3"
description: "Writing/reviewing Laravel code — controllers, Eloquent, Artisan, jobs, events, policies — route to laravel skill"
triggers:
  - keyword: "laravel"
  - keyword: "artisan"
  - keyword: "eloquent"
  - keyword: "FormRequest"
routes_to:
  - "skill:laravel"
workspaces:
  - engineering
packs:
  - laravel
trust:
  level: professional
install:
  default: false
  removable: true
---

# Laravel Routing

**Iron Law.** Laravel-flavoured PHP (Eloquent, Artisan, FormRequest, jobs, events, policies) → load the `laravel` skill, not `symfony-workflow` and not `php-coder`.

Body migrated to `skill:laravel`. Disambiguates the laravel ↔ symfony-workflow cluster head per [`adr-architectural-consensus-mechanism`](../docs/contracts/adr-architectural-consensus-mechanism.md).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
