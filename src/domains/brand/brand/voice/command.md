---
model_tier: high
name: brand-voice
pack: brand
tier: 2
visibility: internal
cluster: brand
sub: voice
skills: [voice-and-tone-design]
description: Define the brand voice-and-tone profile — register, do/don't lexicon, and tone shifts by context — the profile the brand-consistency gate checks copy against.
argument-hint: "<brand-ref | strategy-ref>"
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - small-business
packs:
  - brand
---

# /brand:voice

Run the [`voice-and-tone-design`](../../skills/voice-and-tone-design/SKILL.md)
skill — register, do/don't lexicon, and per-context tone shifts. The resulting
voice profile is what `/brand:review` and the `brand-consistency` gate check
emitted copy against. Args: `"<brand/strategy ref>"`. Run `/brand:strategy`
first when the archetype/positioning is not yet set.
