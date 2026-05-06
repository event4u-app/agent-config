---
type: "auto"
tier: "2a"
description: "Keeping .augment/ contexts, counts, and cross-references in sync when creating, renaming, or deleting skills, commands, rules, guidelines, templates, or any agent infrastructure files"
source: package
triggers:
  - path_prefix: ".agent-src.uncompressed/"
  - path_prefix: ".augment/"
  - keyword: "rename"
  - keyword: "delete"
routes_to:
  - "skill:agent-docs-writing"
---

# Docs Sync

**Iron Law.** On any add / rename / delete of skill / rule / command / guideline, update counts and cross-references in the same edit.

Body migrated to `skill:agent-docs-writing` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
