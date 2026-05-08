---
type: "manual"
tier: "3"
description: "When choosing an analysis skill, route to the narrowest matching skill instead of defaulting to broad analysis"
source: package
triggers:
  - keyword: "analyze"
  - keyword: "analysis"
  - phrase: "dig into the codebase"
routes_to:
  - "skill:analysis-skill-router"
---

# Analysis Skill Routing

**Iron Law.** Route analysis tasks to the narrowest matching `project-analysis-*` skill, not the broad fallback.

Body migrated to `skill:analysis-skill-router` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
