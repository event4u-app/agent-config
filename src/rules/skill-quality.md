---
type: "auto"
tier: "mechanical-already"
description: "Creating/editing/reviewing skills — minimum quality standard; every skill executable, validated, self-contained"
triggers:
  - path_prefix: "src/skills/"
routes_to:
  - "guideline:agent-infra/skill-quality-checklist"
workspaces: [agent-config-maintainer]
packs: [meta]
enforced_by:
  - "validator:src/scripts/skill_linter.ts"
---

# Skill Quality

**Iron Law.** Every skill must be executable, validated, and self-contained — full checklist in the guideline.

Body migrated to `guideline:agent-infra/skill-quality-checklist` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).
