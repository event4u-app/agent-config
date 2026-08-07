---
type: "auto"
tier: "1"
description: "User types a slash command like /create-pr, /commit, or pastes command file content"
triggers:
  - keyword: "/create-pr"
  - keyword: "/commit"
  - keyword: "/fix-ci"
  - phrase: "slash command"
routes_to:
  - "skill:command-routing"
workspaces: [agent-config-maintainer, construction, engineering, finance, founder, gtm, legal-review-prep, ops, product, small-business]
packs: [meta]
# obligation: "On a slash-command invocation or pasted command body, route to the command …" — src/rules/slash-command-routing-policy.md:18
obligation_frequency: "per-turn"
---

# Slash Command Routing Policy

**Iron Law.** On a slash-command invocation or pasted command body, route to the matching command file; never improvise.

Body migrated to `skill:command-routing` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).
