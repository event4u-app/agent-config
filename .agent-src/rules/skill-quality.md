---
type: "auto"
tier: "mechanical-already"
description: "Creating, editing, or reviewing skills — minimum quality standard, every skill must be executable, validated, and self-contained"
source: package
triggers:
  - path_prefix: ".agent-src.uncompressed/skills/"
routes_to:
  - "guideline:agent-infra/skill-quality-checklist"
---

# Skill Quality

**Iron Law.** Every skill must be executable, validated, and self-contained — full checklist in the guideline.

Body migrated to `guideline:agent-infra/skill-quality-checklist` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
