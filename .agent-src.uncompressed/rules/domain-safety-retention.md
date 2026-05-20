---
type: "auto"
tier: "2a"
description: "Data retention (finance, support/CRM) — name jurisdiction gap, default to longest floor, honor DSR/audit holds, never delete under inquiry"
source: package
triggers:
  - keyword: "retention policy"
  - keyword: "data retention"
  - keyword: "record retention"
  - keyword: "ticket retention"
  - keyword: "CRM retention"
  - keyword: "delete financial"
  - keyword: "purge invoice"
  - keyword: "DSAR"
  - keyword: "data subject request"
  - keyword: "right to be forgotten"
  - phrase: "how long should we keep"
  - phrase: "when can we delete"
  - phrase: "delete customer data"
  - phrase: "how long do we keep tickets"
routes_to:
  - "skill:data-handling-judgment"
  - "skill:privacy-review"
applies_to_user_types:
  - "finance"
  - "ops"
  - "support"
  - "gtm"
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# Domain Safety — Data Retention

## Iron Law

```
NAME THE JURISDICTION GAP. DEFAULT TO THE LONGEST APPLICABLE FLOOR.
NEVER RECOMMEND DELETION UNDER AUDIT HOLD, LITIGATION HOLD, OR REGULATORY INQUIRY.
SUPPORT-DATA ANSWERS DISTINGUISH RAW (PII-LADEN) FROM AGGREGATE (DE-IDENTIFIED).
DSR-READINESS IS A FLOOR, NOT A CEILING.
```

Retention questions look operational but are regulatory minefields: tax-authority floors, statute-of-limitations windows, GAAP / IFRS, consent windows, GDPR DSR clocks, and contractual obligations stack non-trivially. A wrong "delete after 3 years" recommendation can destroy evidence in a future tax audit, breach a consent contract, or fail a deletion request.

## Track 1 — Finance / record retention

Required surface in every finance-retention answer:

1. **Jurisdiction gap.** *"Retention floor depends on jurisdiction — name yours."* Then provide ranges if known (US-federal-tax: 7 years from filing; EU VAT: 10 years in DE/AT, 6 in UK post-Brexit).
2. **Audit / litigation hold check.** *"If any of these apply, do not delete: open tax audit, pending litigation, regulatory inquiry, contractual record-keeping clause, criminal investigation."*
3. **Longest-floor default.** When multiple floors apply, the longest wins. Document the chosen floor.
4. **Disclaimer.** Append the financial-disclaimer footer from `domain-safety-disclaimer` (financial section).

## Track 2 — Support / CRM retention

The right answer to *"how long do we keep tickets?"* is almost never a single number — it's a two-track policy. Raw ticket bodies contain PII and must respect deletion requests on a DSR clock (typically 30 days under GDPR). De-identified aggregate analytics (resolution times, category counts) can persist indefinitely for product / ops insight.

Required structure:

1. **Two tracks.** Raw ticket body + attachments (PII): short retention with DSR honoring. Aggregate metrics (de-identified): long retention OK.
2. **Consent-window check.** If consent was time-bound (e.g., *"we'll keep your data for 12 months for support quality"*), name the expiry and the deletion job that must run.
3. **DSR readiness.** *"You must be able to honor a deletion request within [N] days. The system needs a query that finds every ticket + attachment + log line tied to one customer."*
4. **Backup retention gotcha.** *"Backups also contain PII. Either purge on the same DSR clock or document that backups are inaccessible and rotate within [N] days."*

### Default support floors (cite, then qualify)

| Class | Typical floor | Driver |
|---|---|---|
| Raw ticket body | 12-24 months from close | Consent window + DSR readiness |
| Attachments with PII | 6-12 months | Higher leak risk → shorter |
| Aggregate analytics (de-identified) | Indefinite | No PII linkage |
| Quality-assurance recordings | 30-90 days | Consent typically narrow |

Verify against the customer's privacy notice, regulatory regime, and contractual data-processing agreements before locking values.

## Refusal triggers

- *"Delete all invoices older than 2 years"* (without jurisdiction context) → refuse + ask the jurisdiction-gap question.
- *"We're under SEC investigation — can we clean up old emails?"* → hard refuse; flag spoliation risk; redirect to counsel.
- *"Just purge the CRM"* (no DSR/consent context) → refuse + walk through the two-track policy.

## See also

- `skill:data-handling-judgment` — retention + transfer + DSR cognition.
- `skill:privacy-review` — regulatory-regime read.
- `domain-safety-disclaimer` — companion advisory disclaimer (financial track).
- `domain-safety-pii` — companion for PII in drafts/logs/exports.
