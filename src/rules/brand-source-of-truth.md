---
type: "auto"
tier: "2a"
description: "Consumer brand tokens + voice profile are the run's source of truth — the corpus fills gaps, never overrides; emitted values that trace to no token are flagged off-brand"
triggers:
  - keyword: "brand"
  - keyword: "on-brand"
  - keyword: "off-brand"
  - keyword: "brand tokens"
  - keyword: "brand voice"
  - keyword: "brand guide"
  - keyword: "brand profile"
  - phrase: "brand consistency"
  - phrase: "on brand"
  - phrase: "brand source of truth"
applies_to_user_types:
  - "creator"
  - "developer"
  - "maintainer"
self_contained: true
workspaces: [engineering]
packs: [brand]
# obligation: line 51
obligation_frequency: "per-edit"
---

# Brand Source of Truth

A precedence rule plus its validation gate (merged from the former
`brand-consistency` rule, 2026-08-04 — the pair shared triggers and one
subject). When a consumer already has a brand — registered tokens
(`.tokens.json`), a voice profile, a brand guide — that brand is authoritative
for the run. The curated `brand` corpus (archetypes, colour psychology, type
principles) is a **gap-filler**, never an override.

Brand is the layer that *constrains* UI, copy, and assets — not a coat of paint
applied after. The gate half is a concrete Validation gate: emitted artifacts
are checked against the **active brand tokens and voice profile**, and anything
that cannot be traced back to one is flagged off-brand. It mirrors the
design-intelligence principle that **audit findings outrank corpus
suggestions** — the consumer's brand outranks any generated default.

## Iron Law 1 — precedence

```
CONSUMER BRAND TOKENS AND VOICE WIN. THE CORPUS FILLS GAPS ONLY.
NEVER OVERWRITE A REGISTERED BRAND VALUE WITH A CORPUS DEFAULT.
```

## Iron Law 2 — the consistency gate

```
EVERY EMITTED COLOUR, TYPE, SPACING, AND VOICE CHOICE TRACES TO A BRAND TOKEN
OR A VOICE RULE. A VALUE THAT TRACES TO NEITHER IS OFF-BRAND.
NEVER SHIP AN ASSET THE ACTIVE BRAND CANNOT ACCOUNT FOR.
```

## Precedence order

1. **Consumer brand profile** — registered `.tokens.json`, voice profile, brand
   guide, or a confirmed `brand-strategy` / `brand-identity` constraint set.
2. **This run's confirmed decisions** — selections the human signed off this session.
3. **The brand corpus** — archetype / colour / type / messaging defaults, used
   only where 1 and 2 are silent, and always surfaced as corpus-sourced.

## What the gate covers

- **Colour / type / spacing** in generated UI or assets that is not one of the
  active brand tokens (from `state.ui_design` or the consumer's `.tokens.json`).
  A raw hex / font / px value with no token behind it is off-brand.
- **Copy and microcopy** whose register contradicts the active voice profile
  (e.g. playful copy under an authoritative `Ruler` voice).
- **Generated brand assets** (logo, banner, social) emitted without injecting the
  registered brand tokens — raw generation is allowed only when no brand layer
  exists (graceful fallback), never as a silent override of one that does.

## When it fires

- **Precedence half:** any brand decision while a consumer brand profile is
  present — to keep the corpus from quietly replacing a value the brand already
  defines.
- **Gate half:** a brand layer is active for the run (a `.tokens.json` /
  `state.ui_design` brand profile or a confirmed `brand-strategy` /
  `brand-identity` constraint set) AND a UI / copy / asset is being emitted or
  reviewed.

## When NOT to fire

- No consumer brand exists (greenfield) — the corpus is the only ground; use it,
  marked as corpus-sourced, until `brand-identity` defines real tokens. There is
  nothing to validate against; generation proceeds on the brief, and
  `brand-strategy` / `brand-identity` define the tokens first.
- The user explicitly scopes an exploration ("just show options") with no
  commitment to an on-brand deliverable.
- Non-brand surfaces: scripts, CLI output, internal tooling.

## How to surface a violation

Name the off-brand value, the token/voice rule it should have matched, and the
fix — do not silently rewrite. Untraceable value → "off-brand: `<value>` has no
brand token; nearest is `<token>`" so the human decides token-or-exception.

## Design register note

When a consumer brand profile is present, the brand register ("the impression IS
the product") is active — use `brand-identity`, `iconography`, and
`design-intelligence` as the primary skill cluster. For product/dashboard/admin
surfaces within the same brand, the product register ("design serves the task")
may apply per-surface. See [`docs/guidelines/design-modes.md`](../../docs/guidelines/design-modes.md)
for the full Brand-mode vs Product-mode discriminator.

## See also

- [`brand-consistency`](brand-consistency.md) — pointer stub; its body lives here since the 2026-08-04 merge.
- [`brand`](../skills/brand/SKILL.md) — the gap-fill corpus this rule subordinates to consumer brand.
- [`brand-identity`](../skills/brand-identity/SKILL.md) — defines the tokens the gate validates against.
- [`brand-to-tokens`](../skills/brand-to-tokens/SKILL.md) — emits the DTCG `.tokens.json` source of truth.
- [`design-intelligence`](../skills/design-intelligence/SKILL.md) — the "audit findings outrank corpus" precedent the gate mirrors.
- [`docs/guidelines/design-modes.md`](../../docs/guidelines/design-modes.md) — brand vs product register discriminator and routing.
