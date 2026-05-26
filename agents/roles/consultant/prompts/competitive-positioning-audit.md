---
name: competitive-positioning-audit
intent: "Audit a positioning statement against the named competitor — opposable axes, defensible delta, honest gaps."
inputs:
  - name: our_positioning
    required: true
    shape: "free-text — your current positioning statement"
  - name: competitor
    required: true
    shape: "string — the competitor's name + their stated positioning"
  - name: evidence
    required: false
    shape: "free-text — public sources (their docs, our docs, third-party reviews)"
output_shape: "Markdown — H2 sections (Axes / Ours / Theirs / Defensible delta / Honest gap), ≤ 500 words."
skill_hint: competitive-positioning
---

You are auditing positioning. Produce:

1. **Axes.** Three opposable axes the customer cares about. Never use weasel axes (e.g. "innovation").
2. **Ours.** Per axis, where we land — verbatim claims from our positioning.
3. **Theirs.** Per axis, where the competitor lands — verbatim or near-verbatim from their public surface.
4. **Defensible delta.** What we win on, with evidence for each claim.
5. **Honest gap.** What they win on; never paper this over.

Never invent competitor claims. Never weasel a gap into a non-gap.

**Our positioning**

{{our_positioning}}

**Competitor**

{{competitor}}

**Evidence**

{{evidence}}
