---
type: "auto"
tier: "2b"
alwaysApply: false
description: "Adopting a new domain track (mobile, ML, IoT…) — demand/owner/CI gates BEFORE harvest"
triggers:
  - keyword: "mobile track"
  - keyword: "ml track"
  - keyword: "blockchain track"
  - path_prefix: "src/skills/"
validator_ignore:
  - type: "substring"
    pattern: ".agent-src.uncondensed/"
    reason: "Rule names the authoring tree as the gated-entry location for new domain plates."
routes_to:
  - "guideline:agent-infra/domain-adoption-gates"
workspaces: [agent-config-maintainer]
packs: [meta]
collision_ok:
  "src/skills/": "a skill in a fresh vertical is exactly the domain-gate surface"
# obligation: line 38
obligation_frequency: "per-task"
---

# Domain Adoption Policy

A "domain" is a coherent vertical the suite has not yet entered — mobile, ML,
blockchain, scientific computing, IoT, gaming, embedded, robotics. Adopting
one is a structural decision: every new domain plate doubles the surface a
single maintainer keeps current, and most upstream skill-suites in adjacent
domains rot within 6-12 months as their underlying SDK churns.

This rule gates that decision. It does **not** gate per-skill adoptions inside
a domain that is already opened — those run under the regular harvest plate
process. It gates **opening** the domain in the first place.

## The Iron Law

```
NEVER OPEN A NEW DOMAIN TRACK WITHOUT THE THREE GATES.
DEMAND-SIGNAL · NAMED MAINTENANCE OWNER · CI-TOOLING DECISION.
ALL THREE PASS, OR THE ROADMAP MARKS THE DOMAIN GATED.
```

The three gates fire before any skill, guideline, command, or rule from the
domain enters `src/`. A council session may inform the decision but cannot
replace the gate evidence. Any gate not citeable → **defer** + a watch-only
note under `agents/settings/contexts/domain-watch/<domain>.md`; never silently
shrink scope to dodge a gate.

Body migrated to [`guideline:agent-infra/domain-adoption-gates`](../docs/guidelines/agent-infra/domain-adoption-gates.md) (per P4 of `road-to-kernel-and-router.md`) — per-gate evidence bars (demand signal, named owner + cadence, CI-vs-reference-only), the sunset policy, the failure-mode catalog, the gates-fail procedure, and the allowed-without-gates list.
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).

## See also

- [`augment-edit-discipline`](augment-edit-discipline.md) — portability +
  cross-reference floors domain plates inherit
- [`size-enforcement`](size-enforcement.md) — size budgets apply per
  artefact regardless of domain
- [`rule-type-governance`](rule-type-governance.md) — within-domain rules
  still pick `always` vs `auto` per the governance table
- [`skill-quality`](skill-quality.md) — every domain skill passes the
  same linter floor as a core skill
