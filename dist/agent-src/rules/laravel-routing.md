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
workspaces: [engineering]
packs: [laravel]
trust:
  level: professional
install:
  default: false
  removable: true
collision_ok:
  "artisan": "artisan is a Laravel-flavoured PHP routing cue — load the laravel skill"
  "eloquent": "eloquent is a Laravel routing cue"
  "formrequest": "FormRequest is a Laravel routing cue"
# obligation: line 29
obligation_frequency: "none"
---

# Laravel Routing

**Iron Law.** Laravel-flavoured PHP → the `laravel` skill. Discriminator: the **entry point and router**, never the dependency list — `illuminate/*` with no skeleton marker is *components-without-the-framework* and this rule does not claim it.

Body migrated to `skill:laravel`. Disambiguates the laravel ↔ symfony-workflow cluster head per [`adr-architectural-consensus-mechanism`](../docs/contracts/adr-architectural-consensus-mechanism.md).
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).
