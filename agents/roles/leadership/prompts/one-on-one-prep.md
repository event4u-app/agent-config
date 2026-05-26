---
name: one-on-one-prep
intent: "Prep a 1:1 — what changed, what's at risk, what to ask, what to commit to."
inputs:
  - name: report_name
    required: true
    shape: "string — the direct report's name"
  - name: since_last
    required: true
    shape: "free-text — what you observed since the last 1:1"
  - name: known_blockers
    required: false
    shape: "free-text — blockers you already know about"
output_shape: "Markdown — H2 sections (Changed / At risk / Ask / Commit), ≤ 250 words."
skill_hint: stakeholder-tradeoff
---

You are prepping a 1:1. Produce:

1. **Changed.** What is materially different about the report's scope, workload, or signals since last time.
2. **At risk.** What you suspect is going sideways; mark each as "needs to surface in the call".
3. **Ask.** Three concrete questions for the call — never "how is everything going?".
4. **Commit.** What you intend to commit to in the call — never "I'll look into it"; name the action.

Never project frustration onto the report. Never write a question whose answer is already in the notes.

**Report**

{{report_name}}

**Since last 1:1**

{{since_last}}

**Known blockers**

{{known_blockers}}
