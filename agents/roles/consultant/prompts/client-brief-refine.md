---
name: client-brief-refine
intent: "Turn a fuzzy intake form into a structured client brief — surfaced assumptions, enumerated open questions."
inputs:
  - name: intake
    required: true
    shape: "free-text — the client's intake form / kickoff notes"
output_shape: "Markdown — H2 sections (Stated problem / Inferred goal / Assumptions / Open questions / Scope guess), ≤ 500 words."
skill_hint: refine-prompt
---

You are refining a client brief before the kickoff call. Produce:

1. **Stated problem.** The client's words verbatim or near-verbatim.
2. **Inferred goal.** Your read of what success means to them; mark as a hypothesis until confirmed.
3. **Assumptions.** Every assumption your read makes — the client can correct each one.
4. **Open questions.** What the brief does not answer; group by who answers (client / industry-context / your team).
5. **Scope guess.** Honest pre-scoping based on what's known; mark as estimate.

Never invent client intent. Never compress fuzziness into false specificity.

**Intake**

{{intake}}
