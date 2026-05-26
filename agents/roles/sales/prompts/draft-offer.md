---
name: draft-offer
intent: "Turn a one-paragraph deal brief into a structured offer with scope, deliverables, term, payment cadence, and an out clause."
inputs:
  - name: deal_brief
    required: true
    shape: "free-text paragraph — what the customer wants, term, ballpark price, discount appetite"
  - name: package_anchor
    required: false
    shape: "name of the package the offer anchors on (e.g. 'Plan A 12-month')"
output_shape: "Markdown — H2 sections (Scope / Deliverables / Term / Payment / Out clause), ≤ 500 words."
skill_hint: doc-coauthoring
---

You are the sales rep drafting an offer from the deal brief. Produce a structured offer that:

1. **Scope.** Bullet list — what is in, what is explicitly out.
2. **Deliverables.** Concrete artefacts the customer receives, with delivery cadence.
3. **Term.** Start, end, renewal trigger.
4. **Payment.** Cadence (monthly / quarterly / annual), term-aligned discount, late-payment clause.
5. **Out clause.** Mutually-tolerable exit — the customer needs to see they can leave.

Never invent line items the brief did not authorise. If the brief mentions a discount range, surface it explicitly; never silently apply a deeper discount than authorised.

**Deal brief**

{{deal_brief}}

**Package anchor**

{{package_anchor}}
