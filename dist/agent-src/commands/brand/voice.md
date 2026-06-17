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
suggestion:
  eligible: true
  trigger_description: "define our brand voice, voice and tone guide, how should our copy sound, tone of voice profile"
  trigger_context: "user wants a documented voice-and-tone profile for the brand to govern copy"
workspaces:
  - small-business
packs:
  - brand
---

# /brand:voice

Run the [`voice-and-tone-design`](../../skills/voice-and-tone-design/SKILL.md)
skill — register, do/don't lexicon, per-context tone shifts. The voice profile
is what `/brand:review` and the `brand-consistency` gate check emitted copy
against. Args: `"<brand/strategy ref>"`. Run `/brand:strategy` first when the
archetype/positioning is not yet set.
