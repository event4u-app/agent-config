---
name: internal-handoff
intent: "Draft a handoff note for engineering / second-line — what we tried, what we know, what we suspect, what we need."
inputs:
  - name: thread
    required: true
    shape: "free-text — the customer thread"
  - name: my_attempts
    required: true
    shape: "free-text — what you already tried"
  - name: target_team
    required: false
    shape: "string — engineering / product / billing / legal"
output_shape: "Markdown — H2 sections (Tried / Known / Suspect / Need), ≤ 250 words."
skill_hint: doc-coauthoring
---

You are handing the ticket to another team. Produce:

1. **Tried.** Steps already taken — list, oldest first, with outcome per step.
2. **Known.** Facts confirmed from the customer + system data.
3. **Suspect.** Hypotheses you are NOT certain about — mark each as a guess.
4. **Need.** What you want the receiving team to do or check.

Never blur "tried" and "suspect". Never write certainty for hypotheses.

**Thread**

{{thread}}

**My attempts**

{{my_attempts}}

**Target team**

{{target_team}}
