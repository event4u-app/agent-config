---
type: "auto"
tier: "2a"
description: "The consumer's brand tokens and voice profile are the run's source of truth — the curated brand corpus only fills gaps, never overrides a registered brand value."
triggers:
  - keyword: "brand tokens"
  - keyword: "brand voice"
  - keyword: "brand guide"
  - keyword: "brand profile"
  - phrase: "brand source of truth"
applies_to_user_types:
  - "creator"
  - "developer"
  - "maintainer"
workspaces:
  - engineering
packs:
  - brand
---

# Brand Source of Truth

A precedence rule, light by design. When a consumer already has a brand —
registered tokens (`.tokens.json`), a voice profile, a brand guide — that brand
is authoritative for the run. The curated `brand` corpus (archetypes, colour
psychology, type principles) is a **gap-filler**, never an override.

## The Iron Law

```
CONSUMER BRAND TOKENS AND VOICE WIN. THE CORPUS FILLS GAPS ONLY.
NEVER OVERWRITE A REGISTERED BRAND VALUE WITH A CORPUS DEFAULT.
```

## Precedence order

1. **Consumer brand profile** — registered `.tokens.json`, voice profile, brand
   guide, or a confirmed `brand-strategy` / `brand-identity` constraint set.
2. **This run's confirmed decisions** — selections the human signed off this session.
3. **The brand corpus** — archetype / colour / type / messaging defaults, used
   only where 1 and 2 are silent, and always surfaced as corpus-sourced.

## When it fires

Any brand decision while a consumer brand profile is present — to keep the
corpus from quietly replacing a value the brand already defines.

## When NOT to fire

- No consumer brand exists (greenfield) — the corpus is the only ground; use it,
  marked as corpus-sourced, until `brand-identity` defines real tokens.
- Non-brand surfaces.

## See also

- [`brand-consistency`](brand-consistency.md) — validates emitted artifacts against the authoritative brand profile this rule establishes.
- [`brand`](../skills/brand/SKILL.md) — the gap-fill corpus this rule subordinates to consumer brand.
