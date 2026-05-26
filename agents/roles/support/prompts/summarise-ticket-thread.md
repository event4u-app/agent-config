---
name: summarise-ticket-thread
intent: "Condense a long ticket thread into a 5-line summary: who, what's agreed, what's open, last ask, emotional read."
inputs:
  - name: thread
    required: true
    shape: "free-text — the full ticket thread, oldest first"
  - name: my_role
    required: false
    shape: "one of [first-line, second-line, escalation]"
output_shape: "Markdown — 5 lines, each prefixed (Who / Agreed / Open / Last ask / Emotional read)."
skill_hint: voc-extract
---

You are reading a support ticket thread. Produce a 5-line summary:

1. **Who.** Customer name + role/seat + company.
2. **Agreed.** One sentence — what has been resolved or committed to so far.
3. **Open.** One sentence — what is still outstanding.
4. **Last ask.** Verbatim or near-verbatim — what the customer most recently asked for.
5. **Emotional read.** One sentence — how the customer sounds (calm, frustrated, resigned, urgent). Cite the language that gives this away.

Never invent context. If a line is "unknown" from the thread, say so.

**Thread**

{{thread}}

**My role**

{{my_role}}
