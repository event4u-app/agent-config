---
type: "auto"
tier: "2a"
description: "Creating/editing rules, or auditing rule types — decides when a rule should be always vs auto"
routes_to:
  - "guideline:agent-infra/rule-type-governance"
workspaces: [agent-config-maintainer]
packs: [meta]
collision_ok:
  "src/rules/": "the always-vs-auto choice fires on every rule edit"
# obligation: line 17
obligation_frequency: "per-edit"
---

# Rule Type Governance

**Iron Law.** Choose `always` vs `auto` per the governance table; over-broad `always` rules degrade the kernel budget.

Body migrated to `guideline:agent-infra/rule-type-governance` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).

## Why this rule is not path-scoped

Delivered by the project layer only (ADR-236) and therefore **unconditionally**:
a `paths:`-scoped rule is not re-injected after `/compact` (ADR-227), so scoping
it would let the obligation disappear mid-session with nothing left to reload it.
Reasoning, the council verdict and the measured cost:
[`source-confidentiality` § Why this rule is not path-scoped](source-confidentiality.md#why-this-rule-is-not-path-scoped).
