---
model_tier: high
name: brand-identity
pack: brand
tier: 2
visibility: internal
cluster: brand
sub: identity
skills: [brand-identity]
description: Define the brand identity — logo direction, colour story, type story, imagery direction — and the token constraints downstream generation consumes.
suggestion:
  eligible: true
  trigger_description: "define our brand identity, logo and colour direction, type story, visual identity system"
  trigger_context: "user has a brand strategy and wants the identity system (logo/colour/type/imagery)"
workspaces:
  - small-business
packs:
  - brand
---

# /brand:identity

Run the [`brand-identity`](../../skills/brand-identity/SKILL.md) skill — logo
direction, colour story, type story, imagery direction. brand-identity
**defines** the tokens/constraints; pack-ai-image's brand-asset generation
**generates** the marks from them (B → A). Args: `"<strategy ref or brief>"`.
Run `/brand:strategy` first when no positioning exists.
