---
type: "auto"
tier: "3"
description: "Symfony work (DI, bundles, Doctrine, Messenger, voters, console) — route to symfony-workflow"
triggers:
  - keyword: "symfony"
  - keyword: "doctrine"
  - keyword: "twig"
  - keyword: "messenger"
routes_to:
  - "skill:symfony-workflow"
workspaces: [engineering]
packs: [symfony]
trust:
  level: professional
install:
  default: false
  removable: true
# obligation: line 23
obligation_frequency: "none"
---

# Symfony Routing

**Iron Law.** Symfony-flavoured PHP → the `symfony-workflow` skill. Discriminator: the **entry point and router**, never the dependency list — `symfony/*` with no skeleton marker is *components-without-the-framework* and this rule does not claim it.

Body migrated to `skill:symfony-workflow`. Disambiguates the laravel ↔ symfony-workflow cluster head per [`adr-architectural-consensus-mechanism`](../../docs/contracts/adr-architectural-consensus-mechanism.md).
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).
