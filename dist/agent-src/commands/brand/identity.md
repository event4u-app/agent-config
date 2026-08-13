---
model_tier: high
name: brand-identity
pack: brand
visibility: internal
cluster: brand
sub: identity
skills: [brand-identity]
description: Define the brand identity — logo direction, colour story, type story, imagery direction — and the token constraints downstream generation consumes.
argument-hint: "<strategy-ref | brief>"
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - small-business
packs:
  - brand
---

# /brand:identity

Run the [`brand-identity`](../../skills/brand-identity/SKILL.md) skill —
logo direction, colour story, type story, imagery direction. brand-identity
**defines** the tokens/constraints; `pack-ai-image`'s brand-asset generation
**generates** the marks from them (B → A dependency). Args: `"<strategy ref or
brief>"`. Run `/brand:strategy` first when no positioning exists.
