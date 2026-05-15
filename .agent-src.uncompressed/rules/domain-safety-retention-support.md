---
type: "auto"
tier: "2a"
description: "Support / CRM data retention guidance — surface DSR-readiness, consent-window expiry, ticket-body retention vs. analytics aggregate retention"
source: package
triggers:
  - keyword: "ticket retention"
  - keyword: "CRM retention"
  - keyword: "DSAR"
  - keyword: "data subject request"
  - keyword: "right to be forgotten"
  - phrase: "delete customer data"
  - phrase: "how long do we keep tickets"
routes_to:
  - "skill:data-handling-judgment"
  - "skill:privacy-review"
applies_to_user_types:
  - "support"
  - "gtm"
---

# Domain Safety — Support / CRM Retention

## Iron Law

```
SUPPORT-DATA RETENTION ANSWERS DISTINGUISH RAW TICKET BODY (PII-LADEN)
FROM AGGREGATE ANALYTICS (DE-IDENTIFIED). DSR-READINESS IS THE FLOOR,
NOT THE CEILING.
```

The right answer to *"how long do we keep tickets?"* is almost never a single number — it's a two-track policy. Raw ticket bodies contain PII and must respect deletion requests on a DSR clock (typically 30 days under GDPR). De-identified aggregate analytics (resolution times, category counts) can persist indefinitely for product / ops insight.

## Required structure in every support-retention answer

1. **Two tracks.** Raw ticket body + attachments (PII): short retention with DSR honoring. Aggregate metrics (de-identified): long retention OK.
2. **Consent-window check.** If consent was time-bound (e.g., "we'll keep your data for 12 months for support quality"), name the expiry and the deletion job that must run.
3. **DSR readiness.** *"You must be able to honor a deletion request within [N] days. The system needs a query that finds every ticket + attachment + log line tied to one customer."*
4. **Backup retention gotcha.** *"Backups also contain PII. Either purge on the same DSR clock or document that backups are inaccessible and rotate within [N] days."*

## Default floors (cite, then qualify)

| Class | Typical floor | Driver |
|---|---|---|
| Raw ticket body | 12-24 months from close | Consent window + DSR readiness |
| Attachments with PII | 6-12 months | Higher leak risk → shorter |
| Aggregate analytics (de-identified) | Indefinite | No PII linkage |
| Quality-assurance recordings | 30-90 days | Consent typically narrow |

Verify against the customer's privacy notice, regulatory regime, and contractual data-processing agreements before locking values.

## See also

- `skill:data-handling-judgment` — retention + DSR shape.
- `skill:privacy-review` — regulatory-regime read.
