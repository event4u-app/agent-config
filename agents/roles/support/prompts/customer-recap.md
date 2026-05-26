---
name: customer-recap
intent: "Produce a 'here is where we are' recap for a customer mid-thread — agreed, open, owners — without re-opening closed points."
inputs:
  - name: thread
    required: true
    shape: "free-text — the full ticket thread"
  - name: stage
    required: false
    shape: "one of [mid-investigation, fix-deployed, awaiting-customer]"
output_shape: "Markdown — H2 sections (Agreed / Open / Owners / Next), ≤ 200 words."
skill_hint: doc-coauthoring
---

You are writing a mid-thread recap the customer reads. Produce:

1. **Agreed.** Resolved items, one line each.
2. **Open.** Outstanding items + what is currently blocking each one.
3. **Owners.** Each open item with a clear owner (us / them).
4. **Next.** Single concrete next step + when the customer can expect the next update.

Never re-open a closed item. Never invent commitments that were not made earlier in the thread.

**Thread**

{{thread}}

**Stage**

{{stage}}
