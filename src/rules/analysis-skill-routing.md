---
type: "manual"
tier: "3"
description: "When choosing an analysis skill, route to the narrowest matching skill instead of defaulting to broad analysis"
triggers:
  - keyword: "analyze"
  - keyword: "analysis"
  - phrase: "dig into the codebase"
routes_to:
  - "skill:analysis-skill-router"
workspaces: [agent-config-maintainer, engineering]
packs: [meta]
# obligation: line 19
obligation_frequency: "none"
---

# Analysis Skill Routing

**Iron Law.** Route analysis tasks to the narrowest matching `project-analysis-*` skill, not the broad fallback.

Body migrated to `skill:analysis-skill-router` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).
