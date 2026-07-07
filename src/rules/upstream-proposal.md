---
type: "auto"
tier: "2a"
description: "After creating/improving a skill/rule/guideline/command — ask about upstreaming it"
triggers:
  - phrase: "after creating"
  - phrase: "after improving"
  - keyword: "upstream"
routes_to:
  - "skill:upstream-contribute"
workspaces:
  - agent-config-maintainer
  - engineering
packs:
  - meta
---

# Upstream Proposal

**Iron Law.** After creating or significantly improving a skill / rule / guideline / command, ask whether to upstream it.

Body migrated to `skill:upstream-contribute` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
