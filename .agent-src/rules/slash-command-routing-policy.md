---
type: "auto"
tier: "1"
description: "When user types a slash command like /create-pr, /commit, or pastes command file content"
source: package
triggers:
  - keyword: "/create-pr"
  - keyword: "/commit"
  - keyword: "/fix-ci"
  - phrase: "slash command"
routes_to:
  - "skill:command-routing"
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# Slash Command Routing Policy

**Iron Law.** On a slash-command invocation or pasted command body, route to the matching command file; never improvise.

Body migrated to `skill:command-routing` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
