---
model_tier: high
name: brand-review
pack: brand
visibility: internal
cluster: brand
sub: review
skills: [brand-audit]
description: Audit emitted UI, copy, and assets against the active brand tokens and voice profile — flag any value not traceable to a brand token or voice rule.
argument-hint: "<artifact-path | description>"
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
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
