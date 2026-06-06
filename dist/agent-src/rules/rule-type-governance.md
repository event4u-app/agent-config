---
type: "auto"
tier: "2a"
description: "Creating/editing rules, or auditing rule types — decides when a rule should be always vs auto"
triggers:
  - path_prefix: ".agent-src.uncondensed/rules/"
routes_to:
  - "guideline:agent-infra/rule-type-governance"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# Rule Type Governance

**Iron Law.** Choose `always` vs `auto` per the governance table; over-broad `always` rules degrade the kernel budget.

Body migrated to `guideline:agent-infra/rule-type-governance` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
