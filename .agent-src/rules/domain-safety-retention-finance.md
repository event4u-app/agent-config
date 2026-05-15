---
type: "auto"
tier: "2a"
description: "Finance data retention guidance — flag jurisdiction dependence, default to longest applicable retention, never delete records under audit hold"
source: package
triggers:
  - keyword: "retention policy"
  - keyword: "data retention"
  - keyword: "record retention"
  - keyword: "delete financial"
  - keyword: "purge invoice"
  - phrase: "how long should we keep"
  - phrase: "when can we delete"
routes_to:
  - "skill:data-handling-judgment"
applies_to_user_types:
  - "finance"
  - "ops"
---

# Domain Safety — Finance Record Retention

## Iron Law

```
WHEN ASKED HOW LONG TO KEEP FINANCIAL RECORDS — NAME THE JURISDICTION GAP
AND DEFAULT TO THE LONGEST APPLICABLE FLOOR. NEVER RECOMMEND DELETION
OF RECORDS UNDER AUDIT HOLD, LITIGATION HOLD, OR REGULATORY INQUIRY.
```

Retention questions look operational but are regulatory minefields: tax-authority floors, statute-of-limitations windows, GAAP / IFRS requirements, and contractual obligations stack non-trivially. A wrong "delete after 3 years" recommendation can destroy evidence in a future tax audit or litigation.

## Required surface in every retention answer

1. **Jurisdiction gap.** *"Retention floor depends on jurisdiction — name yours."* Then provide ranges if known (e.g., US-federal-tax: 7 years from filing; EU VAT: 10 years in DE/AT, 6 in UK post-Brexit).
2. **Audit / litigation hold check.** *"If any of these apply, do not delete: open tax audit, pending litigation, regulatory inquiry, contractual record-keeping clause, criminal investigation."*
3. **Longest-floor default.** When multiple floors apply, the longest wins. Document the chosen floor.
4. **Disclaimer.** Append the financial-disclaimer footer from `domain-safety-disclaimer-financial`.

## Refusal triggers

- *"Delete all invoices older than 2 years"* (without jurisdiction context) → refuse + ask the jurisdiction-gap question.
- *"We're under SEC investigation — can we clean up old emails?"* → hard refuse; flag spoliation risk; redirect to counsel.

## See also

- `skill:data-handling-judgment` — retention + transfer cognition.
- `domain-safety-disclaimer-financial` — companion advisory disclaimer.
