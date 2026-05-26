---
name: escalation-risk-analysis
intent: "Flag escalation triggers in a ticket thread: SLA breach, named exec, churn-signal language, compliance hit."
inputs:
  - name: thread
    required: true
    shape: "free-text — the full ticket thread"
  - name: sla_window
    required: false
    shape: "string — the contractual SLA window, e.g. '24 business hours'"
output_shape: "Markdown — table of (Trigger / Evidence / Next move), one row per flagged risk."
skill_hint: churn-prevention
---

You are scanning a support thread for escalation triggers. Report a table with one row per trigger present:

- **SLA breach risk** — thread duration vs. SLA window. Evidence: timestamps. Next move: who needs to know.
- **Named exec stakeholder** — VP / Director / C-level mentioned. Evidence: verbatim quote. Next move: loop AM.
- **Churn-signal language** — "we are looking at alternatives", "considering not renewing", "this is the last try". Evidence: verbatim quote. Next move: AM + product.
- **Regulatory / compliance trigger** — GDPR / HIPAA / SOC / audit / breach language. Evidence: verbatim quote. Next move: legal + security on-call.

If no triggers fire, return "No escalation triggers detected" + one sentence on why (the thread is technical, contained, on-cadence).

**Thread**

{{thread}}

**SLA window**

{{sla_window}}
