---
type: "auto"
tier: "3"
description: "Writing/reviewing Symfony — DI, bundles, Doctrine, Messenger, Security voters, console commands — route to symfony-workflow"
source: package
triggers:
  - keyword: "symfony"
  - keyword: "doctrine"
  - keyword: "twig"
  - keyword: "messenger"
routes_to:
  - "skill:symfony-workflow"
workspaces:
  - engineering
packs:
  - symfony
lifecycle: active
trust:
  level: professional
  confidence: high
  human_review_required: false
install:
  default: false
  removable: true
---

# Symfony Routing

**Iron Law.** Symfony-flavoured PHP (DI container, bundles, Doctrine entities, Messenger, Security voters, console commands) → load the `symfony-workflow` skill, not `laravel` and not `php-coder`.

Body migrated to `skill:symfony-workflow`. Disambiguates the laravel ↔ symfony-workflow cluster head per [`adr-architectural-consensus-mechanism`](../../docs/contracts/adr-architectural-consensus-mechanism.md).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
