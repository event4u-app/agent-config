---
type: "auto"
tier: "2a"
description: "Editing inside .augment/ or .agent-src.uncompressed/ — files MUST stay project-agnostic AND any add/rename/delete syncs counts and cross-references in the same edit"
source: package
triggers:
  - path_prefix: ".augment/"
  - path_prefix: ".agent-src.uncompressed/"
  - keyword: "portable"
  - keyword: "rename"
  - keyword: "delete"
routes_to:
  - "guideline:augment-portability-patterns"
  - "skill:agent-docs-writing"
validator_ignore:
  - type: "substring"
    pattern: ".agent-src.uncompressed/"
    reason: "Rule scopes the portability gate to the uncompressed authoring tree."
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

# Augment Edit Discipline

**Iron Law (portability).** Files inside `.augment/` and `.agent-src.uncompressed/` MUST stay project-agnostic — no project names, domains, stacks.

**Iron Law (sync).** On any add / rename / delete of skill / rule / command / guideline, update counts and cross-references in the same edit.

Portability body migrated to `guideline:augment-portability-patterns`. Sync body migrated to `skill:agent-docs-writing` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates both routes under the `balanced` and `full` profiles.
