---
stability: beta
keep-beta-until: 2026-08-13
---


# Router Blending — Cross-Domain Skill Mix Contract

> **Status:** beta · **Owner:** router governance · **Depends on:** [`universal-skills.md`](universal-skills.md), the user-types axis (axis seeds — schema field defined under [`skill.schema.json`](../../scripts/schemas/skill.schema.json) → `recommended_for_user_types`).

## Purpose

A founder doing technical due diligence needs both `runway-cognition` and `data-flow-mapper`. A consultant pitching ghost-written thought leadership needs both `ghostwriter` and `competitive-positioning`. Pure prefix-filtering — "load consulting/* for consultants" — silos these workflows and forces the operator to re-enable skills manually.

Router blending defines the mix-ratio per user-type so the resolved skill set covers the **dominant** domain plus the **bridge** skills that real workflows demand.

## The blend formula

```
loaded_skills(user_type) =
    universal_allowlist            (always — see universal-skills.md)
  ∪ dominant_pool(user_type)       (primary domain, ≈70%)
  ∪ bridge_pool(user_type)         (cross-domain, ≈20%)
  ∪ context_pool(user_type)        (content / writing / safety, ≈10%)
```

Percentages are **soft caps** measured against the post-filter skill count, not hard quotas. Drift > ±10% on any pool triggers a re-tag pass and a finding in `agents/evidence/eval-findings/`.

## Per user-type blends

| user_type | Dominant (~70%) | Bridge (~20%) | Context (~10%) |
|---|---|---|---|
| **creator** | `voice-and-tone-design`, `editorial-calendar`, `content-funnel-design`, `messaging-architecture`, `release-comms` | `customer-research`, `competitive-positioning`, `voc-extract` | `privacy-review`, `accessibility-auditor` |
| **founder** | `runway-cognition`, `unit-economics-modeling`, `fundraising-narrative`, `scenario-modeling`, `okr-tree-modeling` | `data-flow-mapper`, `threat-modeling`, `api-design` | `voice-and-tone-design`, `release-comms` |
| **consultant** | `discovery-interview`, `competitive-moat-analysis`, `competitive-positioning`, `stakeholder-tradeoff`, `customer-research` | `messaging-architecture`, `voice-and-tone-design`, `release-comms` | `privacy-review`, `data-handling-judgment` |
| **gtm** | `pipeline-strategy`, `forecast-accuracy`, `deal-qualification-meddic`, `gtm-launch`, `release-comms` | `voice-and-tone-design`, `messaging-architecture`, `voc-extract` | `privacy-review`, `unit-economics-modeling` |
| **finance** | `runway-cognition`, `unit-economics-modeling`, `scenario-modeling`, `forecasting`, `dcf-modeling` | `data-handling-judgment`, `privacy-review`, `contracts-cognition` | `voice-and-tone-design`, `stakeholder-tradeoff` |
| **ops** | `incident-commander`, `data-handling-judgment`, `privacy-review`, `dashboard-design`, `launch-readiness` | `threat-modeling`, `secrets-management`, `api-design` | `voice-and-tone-design`, `release-comms` |
| **developer** | language-/framework-keyed pool (laravel · nextjs-patterns · php-coder · …) | `api-design`, `authz-review`, `playwright-architect`, `threat-modeling` | `voice-and-tone-design`, `release-comms` |

Each pool entry is a `recommended_for_user_types:` frontmatter tag on the skill. A skill with no tag is **universal** (see [`universal-skills.md`](universal-skills.md)).

## How the loader resolves a profile

1. **Read** `.agent-config.local.json` → `user_type`.
2. **Filter** all 210 skills: keep the skill iff `user_type ∈ recommended_for_user_types` **or** `recommended_for_user_types` is absent (universal).
3. **Stack overlay.** If `stack` is set (laravel / nextjs / python / …), also keep skills whose body cites that stack — language-keyed bridge. Implementation: pattern match on the skill `description:` frontmatter; details land with the schema-rigor contract once the schema bridge for stack-keyed bridge tagging is finalised.
4. **Cap.** No filter is applied if the result drops below 50 skills (safety floor — under-filtering is recoverable, over-filtering hides essentials).
5. **Surface** `loaded_skills_count` + per-pool counts in the agent debug output.

## Drift detection

`scripts/check_router_blend.py` (to ship with Phase 5) walks each user-type and reports:

- Dominant-pool fraction (must be ≥ 0.55).
- Bridge-pool fraction (≥ 0.15).
- Empty-pool sentinel: any user-type with zero bridge tags fails the check.

Wired into `task ci` as a non-blocking warning until the user-types axis stabilizes; promoted to blocking once `step-9` ships its three seed user-types.

## Open questions (tracked for Phase 5 → Phase 6 transition)

- Stack overlay precedence: framework tag vs. user-type tag — currently union, may want intersection for the `developer + laravel` combo. Empirical question, tested by corpus.
- Cross-domain explicit opt-in: `agent-config skills enable <name>` to override the filter on demand. Not in scope for Phase 5 — opens once the filter ships.
- Persona ↔ user-type mapping: a `consultant` user_type may default to `discovery-lead` persona, but personas are role-axis, not user-axis. Final mapping resolved with [`docs/contracts/persona-schema.md`](persona-schema.md).

## Related

- [`universal-skills.md`](universal-skills.md) — the always-loaded floor under the blend.
- [`skill.schema.json`](../../scripts/schemas/skill.schema.json) — `recommended_for_user_types` field that carries the tags.
- [`tests/eval/corpus-non-dev.yaml`](../../tests/eval/corpus-non-dev.yaml) — empirical validation of the blends.
