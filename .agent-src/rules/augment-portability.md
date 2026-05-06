---
type: "auto"
tier: "mechanical-already"
description: "Editing or creating files inside .augment/ directory — skills, rules, commands, templates, contexts must be project-agnostic"
source: package
triggers:
  - path_prefix: ".augment/"
  - path_prefix: ".agent-src.uncompressed/"
  - keyword: "portable"
routes_to:
  - "guideline:augment-portability-patterns"
---

# Augment Portability

**Iron Law.** Files inside `.augment/` and `.agent-src.uncompressed/` MUST stay project-agnostic — no project names, domains, stacks.

Body migrated to `guideline:augment-portability-patterns` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
