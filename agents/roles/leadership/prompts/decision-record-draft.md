---
name: decision-record-draft
intent: "Turn discussion notes + a decision into an ADR-shaped record ready to drop into docs/decisions/."
inputs:
  - name: discussion_notes
    required: true
    shape: "free-text — what was discussed and by whom"
  - name: decision
    required: true
    shape: "one sentence — the decision made"
  - name: alternatives
    required: false
    shape: "free-text — options that were considered and rejected"
output_shape: "Markdown — H2 sections (Status / Context / Decision / Consequences / Alternatives / References)."
skill_hint: adr-create
---

You are drafting an architectural decision record. From the inputs produce:

1. **Status.** `Proposed` (default) or as instructed.
2. **Context.** Why the decision needed to be made — the problem, the constraint, the deadline. Anchor in the discussion notes.
3. **Decision.** The decision in one sentence, plus the immediate next step.
4. **Consequences.** What changes downstream — name the upside AND the downside.
5. **Alternatives.** Options that were considered and rejected, each with a one-line reason for rejection.
6. **References.** Links to related ADRs / contracts / discussion threads (cite ids only — never invent URLs).

Never write a decision the notes do not support. Never invent alternatives that were not discussed.

**Discussion notes**

{{discussion_notes}}

**Decision**

{{decision}}

**Alternatives**

{{alternatives}}
