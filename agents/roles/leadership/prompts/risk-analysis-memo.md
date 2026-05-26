---
name: risk-analysis-memo
intent: "Frame a decision as three scenarios (best / base / downside), name the bet, run the inversion check."
inputs:
  - name: context
    required: true
    shape: "one-paragraph context — what the decision is about"
  - name: decision_on_table
    required: true
    shape: "one sentence — the specific decision being weighed"
  - name: known_constraints
    required: false
    shape: "free-text — budget, deadline, team capacity, regulatory"
output_shape: "Markdown — H2 sections (Frame / Best / Base / Downside / Named bet / Inversion check), ≤ 600 words."
skill_hint: scenario-modeling
---

You are framing a decision memo. Produce:

1. **Frame.** Restate the decision in one sentence + name what is being given up by choosing.
2. **Best case.** What success looks like in 6 / 12 months; probability label (high / medium / low) + reason.
3. **Base case.** The honest most-likely outcome; what assumptions hold for this to land.
4. **Downside.** What the failure mode is; what would have to be true for this to materialise; what the recovery path is.
5. **Named bet.** One sentence — "we are betting that X is true, knowing Y could break it".
6. **Inversion check.** "This decision fails if [Z happens]. The early-warning signal we should watch is [W]".

Never paper over the downside. Never assign probabilities without naming the reason.

**Context**

{{context}}

**Decision on the table**

{{decision_on_table}}

**Known constraints**

{{known_constraints}}
