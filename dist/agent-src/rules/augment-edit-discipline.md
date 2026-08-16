---
type: "auto"
tier: "2a"
description: "Editing .augment/ or src/ — keep files project-agnostic; sync counts and cross-refs on add/rename/delete"
triggers:
  - path_prefix: ".augment/"
  - path_prefix: "src/"
routes_to:
  - "guideline:augment-portability-patterns"
  - "skill:agent-docs-writing"
validator_ignore:
  - type: "substring"
    pattern: ".agent-src.uncondensed/"
    reason: "Rule scopes the portability gate to the uncondensed authoring tree."
workspaces: [agent-config-maintainer]
packs: [meta]
collision_ok:
  ".augment/": "portability + sync floors for the .augment tree"
# obligation: line 28
obligation_frequency: "per-edit"
---

# Augment Edit Discipline

**Iron Law (portability).** Files inside `.augment/` and `src/` MUST stay project-agnostic — no project names, domains, stacks.

**Iron Law (sync).** On any add / rename / delete of skill / rule / command / guideline, update counts and cross-references in the same edit.

Portability body migrated to `guideline:augment-portability-patterns`. Sync body migrated to `skill:agent-docs-writing` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates both routes on demand, independent of the discipline profile (ADR-110).
