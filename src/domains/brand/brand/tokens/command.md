---
model_tier: high
name: brand-tokens
pack: brand
tier: 2
visibility: internal
cluster: brand
sub: tokens
skills: [brand-to-tokens]
description: Derive a DTCG .tokens.json source of truth from brand decisions, then emit CSS vars + Tailwind via the no-Node token generator.
suggestion:
  eligible: true
  trigger_description: "derive brand tokens, turn our brand into design tokens, generate a .tokens.json from the brand"
  trigger_context: "user has brand identity decisions and wants a DTCG token source of truth + CSS/Tailwind output"
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
