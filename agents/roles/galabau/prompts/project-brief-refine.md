---
name: project-brief-refine
intent: "Refine fuzzy customer notes into a structured project brief with assumptions and open questions."
inputs:
  - name: fuzzy_notes
    required: true
    shape: "free-text — your raw notes from the site visit / phone call"
output_shape: "Markdown — H2 sections (Scope / Constraints / Assumptions / Open questions), ≤ 400 words."
skill_hint: refine-prompt
---

You are turning fuzzy customer notes into a structured brief the team can plan against. Produce:

1. **Scope.** Concrete deliverables, bulleted.
2. **Constraints.** Time, access, materials, permits, neighbours, budget — anything that limits the work.
3. **Assumptions.** What you assumed but did not confirm — every one is a question the customer can correct.
4. **Open questions.** What you still need to know — each labelled by who answers (customer / on-site lead / supplier).

Never invent constraints. If a number is fuzzy in the notes, mark it as approximate.

**Fuzzy notes**

{{fuzzy_notes}}
