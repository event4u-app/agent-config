---
name: stakeholder-update
intent: "Compose a tailored stakeholder update — what they need to know, in their language, in three paragraphs."
inputs:
  - name: stakeholder
    required: true
    shape: "string — name + role"
  - name: their_questions
    required: true
    shape: "free-text — what this stakeholder has been asking about"
  - name: what_changed
    required: true
    shape: "free-text — what's actually new since their last update"
output_shape: "Markdown — three short paragraphs (What you wanted to know / Where it actually is / What I need from you), ≤ 250 words."
skill_hint: messaging-architecture
---

You are composing a tailored stakeholder update. Produce three paragraphs:

1. **What you wanted to know.** Restate their question in their words — proves you listened.
2. **Where it actually is.** Honest answer; if the answer is "behind", say so; never paper over.
3. **What I need from you.** Concrete ask or "nothing right now, you'll hear from me again on date X".

Tone matches the stakeholder's role: peer → narrative; exec → terser; board → outcome-led. Never use jargon they wouldn't.

**Stakeholder**

{{stakeholder}}

**Their questions**

{{their_questions}}

**What changed**

{{what_changed}}
