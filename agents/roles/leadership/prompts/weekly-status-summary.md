---
name: weekly-status-summary
intent: "Turn raw weekly notes into a 1-page status summary: shipped, at risk, plan changes, what we need."
inputs:
  - name: notes
    required: true
    shape: "free-text — your raw week's notes (Slack threads, meetings, blockers)"
  - name: audience
    required: false
    shape: "one of [direct-report, peer, exec-sponsor, board]"
output_shape: "Markdown — H2 sections (Shipped / At risk / Plan changes / What we need), ≤ 400 words."
skill_hint: doc-coauthoring
---

You are writing the weekly status summary. From the raw notes produce:

1. **Shipped.** What landed this week, in audience-appropriate language. Each item: one sentence + owner.
2. **At risk.** Items behind plan + reason + named mitigation. If a mitigation is "unknown", say so.
3. **Plan changes.** What you are doing differently next week vs. the prior plan; never silently move a date.
4. **What we need.** Concrete asks of the reader — never "support and alignment"; name the decision or unblock.

Tone scales with audience: board / exec-sponsor → terser, decision-oriented; peer → narrative; direct-report → context-rich.

Never overclaim. If a "shipped" item has a known follow-up debt, flag it.

**Notes**

{{notes}}

**Audience**

{{audience}}
