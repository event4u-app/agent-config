---
model_tier: high
name: brand-voice
pack: brand
visibility: internal
cluster: brand
sub: voice
skills: [voice-and-tone-design]
description: Define the brand voice-and-tone profile — three attributes, a tone matrix by context, and a consistency review — the profile `/brand:review` reads copy against.
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
skill — three attributes, a tone matrix by context, and a consistency review.
The resulting
voice profile is what `/brand:review` and the `brand-source-of-truth` § Iron Law 2
checklist read emitted copy against. Args: `"<brand/strategy ref>"`. Run `/brand:strategy`
first when the archetype/positioning is not yet set.
