---
name: prep-discovery-call
intent: "Turn a buyer's LinkedIn + website context into a discovery-call deck — 5 buyer-fit questions plus 3 hidden-pain probes."
inputs:
  - name: company_context
    required: true
    shape: "free-text — what you know about the company from website / LinkedIn / inbound"
  - name: hypothesis
    required: false
    shape: "one sentence — your current bet on the pain we solve"
output_shape: "Markdown — H2 sections (Open / Fit / Probe / Close), ≤ 400 words."
skill_hint: customer-research
---

You are prepping a discovery call. From the company context produce a deck with:

1. **Open.** A two-sentence opener that names what you already know — proves you read their site.
2. **Fit (5 questions).** Each question maps to a buyer-fit signal: budget authority, decision timeline, success metric, existing tooling, internal sponsor.
3. **Probe (3 questions).** Hidden-pain probes — the things they would not volunteer.
4. **Close.** A "based on what we hear, here is the next step" prompt — three options, one is "let's not".

Never write a leading question. Never assume the buyer's pain matches your hypothesis. Mark the hypothesis as the bet you are testing, not as fact.

**Company context**

{{company_context}}

**Hypothesis**

{{hypothesis}}
