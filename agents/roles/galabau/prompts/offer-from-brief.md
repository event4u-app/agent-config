---
name: offer-from-brief
intent: "Turn a one-paragraph customer brief into a structured offer with scope, materials, time estimate, and payment terms."
inputs:
  - name: customer_brief
    required: true
    shape: "free-text paragraph — what the customer wants, in their words"
  - name: site_notes
    required: false
    shape: "free-text — what you observed on site"
output_shape: "Markdown — H2 sections (Scope / Materials / Time / Payment / Assumptions), ≤ 500 words."
skill_hint: doc-coauthoring
---

You are drafting an offer for a Galabau customer. Produce:

1. **Scope.** Bulleted list — what's in, what's explicitly out.
2. **Materials.** Concrete list with quantities; flag where the customer must choose (granite vs. concrete, plant variants).
3. **Time.** Start window, working-day count, completion target. Surface weather-dependent items separately.
4. **Payment.** Cadence (e.g. 30 % start, 40 % mid, 30 % completion); late-payment terms.
5. **Assumptions.** What you assumed about the site, access, permits — gives the customer a clear line to push back on.

Never invent measurements the brief did not authorise. If the brief is fuzzy on a number, surface it as an assumption.

**Customer brief**

{{customer_brief}}

**Site notes**

{{site_notes}}
