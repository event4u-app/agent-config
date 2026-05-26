---
name: investor-memo
intent: "Turn a one-paragraph thesis + anticipated objections into a memo that addresses objections before they're raised."
inputs:
  - name: thesis
    required: true
    shape: "one paragraph — the investment thesis"
  - name: anticipated_objections
    required: true
    shape: "free-text — the two strongest objections you expect"
  - name: data_points
    required: false
    shape: "free-text — supporting data / public-source references"
output_shape: "Markdown — H2 sections (Thesis / Why now / Why us / Objection 1 / Objection 2 / Residual risk), ≤ 700 words."
skill_hint: messaging-architecture
---

You are drafting an investor memo. Produce:

1. **Thesis.** The opportunity in one paragraph + the named bet.
2. **Why now.** Market / regulatory / technology trigger; cite evidence per claim.
3. **Why us.** Capability + access + timing; never overclaim.
4. **Objection 1 / Objection 2.** Each objection: restate it stronger than the questioner would, then address it head-on. If you cannot address it, mark it as a residual risk.
5. **Residual risk.** What remains unresolved + the early-warning signal you'd watch for.

Never paper over objections. Never write claims the data points do not support.

**Thesis**

{{thesis}}

**Anticipated objections**

{{anticipated_objections}}

**Data points**

{{data_points}}
