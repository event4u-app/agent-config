---
model_tier: high
name: brand-strategy
pack: brand
tier: 2
visibility: internal
cluster: brand
sub: strategy
skills: [brand-strategy]
description: Define brand positioning, archetype, voice, tone, and messaging over the brand-grounding corpus — the strategy that bounds identity and UI.
suggestion:
  eligible: true
  trigger_description: "define our brand strategy, what's our brand archetype, positioning and messaging, brand voice direction"
  trigger_context: "user wants brand positioning/archetype/voice/messaging before identity or UI work"
workspaces:
  - small-business
packs:
  - brand
---

# /brand:strategy

Run the [`brand-strategy`](../../skills/brand-strategy/SKILL.md) skill —
positioning, archetype (the 12), voice, tone, messaging frameworks grounded in
the brand corpus. Output: the strategic frame identity/tokens/voice build on.
Args: `"<brief>"` (company / product + market). Consumer brand tokens, if
present, are the source of truth; the corpus fills gaps.
