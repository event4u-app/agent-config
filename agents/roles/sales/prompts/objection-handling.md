---
name: objection-handling
intent: "Turn a customer objection into a structured response that names the underlying concern and proposes a concrete next step."
inputs:
  - name: objection
    required: true
    shape: "the verbatim objection from the customer"
  - name: deal_stage
    required: false
    shape: "one of [discovery, proposal, negotiation, closing]"
output_shape: "Markdown — H2 sections (Underlying concern / What we can change / What we cannot / Next step), ≤ 250 words."
skill_hint: stakeholder-tradeoff
---

You are responding to a customer objection. Read the objection and the deal stage, then:

1. **Underlying concern.** Restate the objection as the customer's actual worry — usually one of: risk, fit, price, authority, timing.
2. **What we can change.** Concrete movements you can make on scope / term / cadence.
3. **What we cannot.** The non-negotiables — name them; the customer respects honesty more than scope creep.
4. **Next step.** A specific action that moves the deal forward or qualifies it out.

Never minimise the concern. Never invent flexibility that does not exist.

**Objection**

{{objection}}

**Deal stage**

{{deal_stage}}
