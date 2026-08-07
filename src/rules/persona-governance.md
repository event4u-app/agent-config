---
type: "auto"
tier: "2a"
description: "Creating/editing/proposing personas — enforce per-domain cap (≤ 2 specialists), ≥ 1 skill citation, deprecation path"
triggers:
  - path_prefix: "src/agent-src/personas/"
  - path_prefix: "dist/agent-src/personas/"
  - keyword: "persona"
  - keyword: "personas"
  - phrase: "new persona"
  - phrase: "add a persona"
  - phrase: "specialist persona"
  - phrase: "review lens"
routes_to:
  - "contract:persona-schema"
applies_to_user_types:
  - "maintainer"
  - "developer"
validator_ignore:
  - type: "substring"
    pattern: "../../docs/"
    reason: "Rule routes to docs/contracts/persona-schema.md and docs/personas.md — the canonical persona catalog and schema live there by design."
  - type: "substring"
    pattern: ".agent-src.uncondensed/"
    reason: "Rule documents the persona authoring tree (.agent-src.uncondensed/personas/) as the deprecation-path operand."
workspaces: [agent-config-maintainer]
packs: [meta]
enforced_by:
  - "validator:src/scripts/lint_persona_governance.ts"
# obligation: "Fires on creating, editing, or proposing a persona (review lens)" — src/rules/persona-governance.md:41
obligation_frequency: "per-edit"
---

# Persona Governance

## Iron Law

```
ONE PERSONA, ONE OWNER, ONE SKILL CITATION, ONE DOMAIN SLOT.
NO NEW SPECIALIST WITHOUT A DEPRECATION CANDIDATE WHEN THE DOMAIN IS FULL.
```

Fires on creating, editing, or proposing a persona (review lens) — the four discipline checks: **1. per-domain cap (≤ 2 specialists)** · **2. skill citation floor (≥ 1 cite)** · **3. deprecation path (delete + record in commit)** · **4. schema conformance (skill linter)**.

Body migrated to [`docs/contracts/persona-schema.md § 8`](../../docs/contracts/persona-schema.md#-8--governance-discipline-the-four-checks) (per P4 of `road-to-kernel-and-router.md`) — the four checks' detail tables, failure modes, day-one state.
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).

## See also

- [`docs/contracts/persona-schema.md`](../../docs/contracts/persona-schema.md) — schema lock, tiers, sections, size budgets, linter enforcement surface, and the migrated governance checks (§ 8).
- [`docs/personas.md`](../../docs/personas.md) — active persona catalog, citation map, ownership column.
- [`ai-council`](../skills/ai-council/SKILL.md) — neutral second-opinion mechanism used for merge / deprecation decisions.
- [`skill-quality`](skill-quality.md) — sibling discipline rule for skill files.
