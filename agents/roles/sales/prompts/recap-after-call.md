---
name: recap-after-call
intent: "Produce a meeting recap email — what was agreed, what is open, what each side owns next."
inputs:
  - name: meeting_notes
    required: true
    shape: "free-text — your raw notes from the call"
  - name: attendees
    required: false
    shape: "list — names + roles of everyone on the call"
output_shape: "Markdown — H2 sections (Agreed / Open / Owners), ≤ 250 words."
skill_hint: doc-coauthoring
---

You are drafting the post-call recap. From the meeting notes produce:

1. **Agreed.** Concrete commitments made by either side, bulleted.
2. **Open.** Questions still pending, each with a "needed from" tag (us / them / both).
3. **Owners.** Name + action + due date. Never leave an action without an owner.

Never paraphrase a commitment into something stronger than was actually said. Never invent dates the call did not produce.

**Meeting notes**

{{meeting_notes}}

**Attendees**

{{attendees}}
