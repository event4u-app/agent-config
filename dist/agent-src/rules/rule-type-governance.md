---
type: "auto"
tier: "2a"
description: "Creating/editing rules, or auditing rule types — decides when a rule should be always vs auto"
triggers:
  - path_prefix: "src/rules/"
routes_to:
  - "guideline:agent-infra/rule-type-governance"
workspaces: [agent-config-maintainer]
packs: [meta]
collision_ok:
  "src/rules/": "the always-vs-auto choice fires on every rule edit"
# obligation: "Choose `always` vs `auto` per the governance table" — src/rules/rule-type-governance.md:17
obligation_frequency: "per-edit"
---

# Rule Type Governance

**Iron Law.** Choose `always` vs `auto` per the governance table; over-broad `always` rules degrade the kernel budget.

Body migrated to `guideline:agent-infra/rule-type-governance` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).
