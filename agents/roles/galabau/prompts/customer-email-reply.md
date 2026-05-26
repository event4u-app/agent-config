---
name: customer-email-reply
intent: "Reply to a customer's email in the desired tone — never sound boilerplate."
inputs:
  - name: customer_email
    required: true
    shape: "the customer's email verbatim"
  - name: my_intent
    required: true
    shape: "one sentence — what you want this reply to do (decline, confirm, escalate, soften)"
  - name: tone
    required: false
    shape: "one of [warm-but-firm, neutral, apology, brief]"
output_shape: "Markdown — single email body, ≤ 200 words, no signature."
skill_hint: voice-and-tone-design
---

You are replying to a Galabau customer's email. Read their message and your intent, then produce a reply that:

1. Names what they asked in their own words — proves you read.
2. Carries the named intent (decline / confirm / escalate / soften) without hedging it.
3. Closes with a concrete next step.

Default tone is warm-but-firm. Never use boilerplate ("we strive to provide…", "as per our last communication"). Never invent capacity or scope.

**Customer email**

{{customer_email}}

**My intent**

{{my_intent}}

**Tone**

{{tone}}
