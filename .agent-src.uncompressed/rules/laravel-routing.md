---
type: "auto"
tier: "3"
description: "When writing or reviewing Laravel code — controllers, Eloquent, Artisan, jobs, events, policies — route to the laravel skill"
source: package
triggers:
  - keyword: "laravel"
  - keyword: "artisan"
  - keyword: "eloquent"
  - keyword: "FormRequest"
routes_to:
  - "skill:laravel"
---

# Laravel Routing

**Iron Law.** Laravel-flavoured PHP (Eloquent, Artisan, FormRequest, jobs, events, policies) → load the `laravel` skill, not `symfony-workflow` and not `php-coder`.

Body migrated to `skill:laravel`. Disambiguates the laravel ↔ symfony-workflow cluster head per [`adr-architectural-consensus-mechanism`](../../docs/contracts/adr-architectural-consensus-mechanism.md).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
