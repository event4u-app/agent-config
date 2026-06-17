---
model_tier: high
name: brand-review
pack: brand
tier: 2
visibility: internal
cluster: brand
sub: review
skills: [brand-audit]
description: Audit emitted UI, copy, and assets against the active brand tokens and voice profile — flag any value not traceable to a brand token or voice rule.
suggestion:
  eligible: true
  trigger_description: "audit our brand consistency, is this on-brand, check this UI/copy against the brand, brand review"
  trigger_context: "user has emitted UI/copy/assets and wants an on-brand consistency check against tokens + voice"
workspaces:
  - small-business
packs:
  - brand
---

# /brand:review

Run the [`brand-audit`](../../skills/brand-audit/SKILL.md) skill — audit
emitted UI / copy / assets against the active brand tokens (from
`state.ui_design` / the consumer's `.tokens.json`) and the voice profile, per
the `brand-consistency` gate. A value not traceable to a brand token or voice
rule is flagged off-brand. Args: `"<artifact path or description>"`.
