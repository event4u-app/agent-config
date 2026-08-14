---
model_tier: high
name: brand-tokens
pack: brand
visibility: internal
cluster: brand
sub: tokens
skills: [brand-to-tokens]
description: Derive a DTCG .tokens.json source of truth from brand decisions, then emit CSS vars + Tailwind via the no-Node token generator.
argument-hint: "<identity-ref>"
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - small-business
packs:
  - brand
---

# /brand:tokens

Run the [`brand-to-tokens`](../../skills/brand-to-tokens/SKILL.md) skill —
brand decisions → a DTCG `.tokens.json` source of truth → `design-tokens`
emits CSS vars + Tailwind (no Node). The same `.tokens.json` is the export that
`pack-ai-image`'s brand-asset generation and the greenfield scaffold seed
consume; stays on `$value`/`$type` so Tokens Studio / Style Dictionary
round-trip. Args: `"<identity ref>"`.
