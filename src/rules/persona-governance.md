---
type: "auto"
tier: "2a"
description: "Creating/editing/proposing personas — enforce per-domain cap (≤ 2 specialists), ≥ 1 skill citation, deprecation path"
triggers:
  - path_prefix: ".agent-src.uncondensed/personas/"
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
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# Persona Governance

## Iron Law

```
ONE PERSONA, ONE OWNER, ONE SKILL CITATION, ONE DOMAIN SLOT.
NO NEW SPECIALIST WITHOUT A DEPRECATION CANDIDATE WHEN THE DOMAIN IS FULL.
```

Personas are review lenses, not free real estate. Every specialist persona has a maintenance cost: it must stay aligned with the schema, the cited skills must still want it, and the per-domain reasoning surface must not bloat to the point that no single persona is load-bearing. This rule routes the agent to [`docs/contracts/persona-schema.md`](../../docs/contracts/persona-schema.md) and [`docs/personas.md`](../../docs/personas.md) and enforces the four discipline checks below.

## The four checks

### 1. Per-domain cap — ≤ 2 specialised personas per content domain

A **content domain** is a self-contained creative or technical surface that one or two specialist personas can fully cover. Current domains:

| Domain | Specialists allowed | Examples |
|---|---|---|
| ai-video / ai-image / ai-audio | ≤ 2 | one director-shaped lens + one technical-tuning lens |
| backend engineering | ≤ 2 | architect + ORM-tamer |
| frontend engineering | ≤ 2 | component / lifecycle + design / a11y |
| security | ≤ 2 | abuse-case + secrets-and-trust |
| gtm / growth | ≤ 2 | CMO + RevOps |
| money / strategy | ≤ 2 | finance-partner + strategist |
| people / org | ≤ 2 | engineering-manager + people-strategist |
| customer / discovery | ≤ 2 | discovery-lead + customer-success-lead |

**Core personas** (`developer`, `senior-engineer`, `product-owner`, `stakeholder`, `critical-challenger`, `ai-agent`) are exempt — they are always-loaded cross-cutting lenses, not domain specialists.

A new specialist into a full domain MUST come with a deprecation candidate from the same domain. The agent surfaces both, then runs an ai-council debate (per [`ai-council`](../skills/ai-council/SKILL.md)) before any rename / merge / delete.

### 2. Skill citation floor — ≥ 1 cite before merge

A specialist persona without a `personas: [<id>]` citation in at least one skill's frontmatter is dead weight. The PR adding the persona MUST also add the citation, OR the PR is rejected. Citation map lives in [`docs/personas.md § Skill citations`](../../docs/personas.md#skill-citations).

### 3. Deprecation path — delete immediately, record in commit

A persona being removed is **deleted in the same commit** that lands its replacement. The commit message names the successor (or "merged into X") and cites the council decision (or maintainer rationale) that authorised it. No soak window — internal personas have no external consumers; a persona file kept around as a tombstone is dead weight the linter still loads. No silent deletes either: the audit trail is the commit, not a docs table.

### 4. Schema conformance — the skill linter is the gate

Every persona file is linted against [`docs/contracts/persona-schema.md`](../../docs/contracts/persona-schema.md) by the skill linter: frontmatter shape, tier enum, wing enum, required sections per tier, line budget per tier (with wing override), `Unique Questions` ≥ 3, filename / id match, description ≤ 160 chars. The agent runs `./scripts-run src/scripts/skill_linter` before any persona PR is marked ready.

## Failure modes — what counts as a violation

- Adding a third specialist to a full domain without naming the deprecation candidate.
- Landing a specialist with no `personas: [<id>]` cite in any skill.
- Renaming or deleting a persona file without naming the successor (or sunset reason) in the commit message.
- Editing core-tier personas in-place with breaking changes (rename, section removal) without bumping to a new id.
- Skipping the skill linter (`./scripts-run src/scripts/skill_linter`) on a persona PR.

## Day-one state

Resolved 2026-05-17 via two-round ai-council debate (members: anthropic/claude-sonnet-4-5, openai/gpt-4o — converged on delete-and-fold): `pixar-storyboard-artist` deleted; its acting / beat-decomposition lens folded into the [`pixar-storyteller`](../skills/pixar-storyteller/SKILL.md) skill body. Active per-domain count for `ai-video` is now 2 (`ai-video-technical-director`, `hollywood-director`), within cap. Total active personas in the root cluster: 24 (plus 5 advisors in `personas/advisors/`). Full inventory + ownership in [`docs/personas.md`](../../docs/personas.md).

## See also

- [`docs/contracts/persona-schema.md`](../../docs/contracts/persona-schema.md) — schema lock, tiers, sections, size budgets, linter enforcement surface.
- [`docs/personas.md`](../../docs/personas.md) — active persona catalog, citation map, ownership column.
- [`ai-council`](../skills/ai-council/SKILL.md) — neutral second-opinion mechanism used for merge / deprecation decisions.
- [`skill-quality`](skill-quality.md) — sibling discipline rule for skill files.
