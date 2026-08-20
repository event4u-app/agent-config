---
type: "auto"
tier: "mechanical-already"
description: "Creating/editing/reviewing skills — minimum quality standard; every skill executable, validated, self-contained"
routes_to:
  - "guideline:agent-infra/skill-quality-checklist"
workspaces: [agent-config-maintainer]
packs: [meta]
enforced_by:
  - "validator:src/scripts/skill_linter.ts"
collision_ok:
  "src/skills/": "every skill edit passes the executable-quality floor"
# obligation: line 14
obligation_frequency: "per-edit"
---

# Skill Quality

**Iron Law.** Every skill must be executable, validated, and self-contained — full checklist in the guideline.

Body migrated to `guideline:agent-infra/skill-quality-checklist` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).

## Why this rule is not path-scoped

Delivered by the project layer only (ADR-236) and therefore **unconditionally**:
a `paths:`-scoped rule is not re-injected after `/compact` (ADR-227), so scoping
it would let the obligation disappear mid-session with nothing left to reload it.
Reasoning, the council verdict and the measured cost:
[`source-confidentiality` § Why this rule is not path-scoped](source-confidentiality.md#why-this-rule-is-not-path-scoped).
