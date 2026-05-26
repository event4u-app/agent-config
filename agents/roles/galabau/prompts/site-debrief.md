---
name: site-debrief
intent: "Compress a site-visit debrief into the team-facing brief — what we saw, what's at risk, what we owe the customer."
inputs:
  - name: site_observations
    required: true
    shape: "free-text — what you observed at the site"
  - name: customer_context
    required: false
    shape: "free-text — what the customer wants vs. what's possible"
output_shape: "Markdown — H2 sections (Observed / At risk / Customer owes us / We owe customer), ≤ 300 words."
skill_hint: doc-coauthoring
---

You are debriefing a site visit for the team. Produce:

1. **Observed.** Concrete site facts: access, slope, ground conditions, existing planting, neighbour considerations.
2. **At risk.** What could go wrong on the project as currently scoped.
3. **Customer owes us.** What we need from the customer before we start (permits, decisions, access).
4. **We owe customer.** What we promised on site that needs to land in writing.

Never invent observations. If a measurement is approximate, mark it.

**Site observations**

{{site_observations}}

**Customer context**

{{customer_context}}
