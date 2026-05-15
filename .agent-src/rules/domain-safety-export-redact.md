---
type: "auto"
tier: "2a"
description: "Generating CSV / Excel / API exports, data-shares with partners, or analyst handoffs — redact direct identifiers; flag re-identification risk on quasi-identifier combinations"
source: package
triggers:
  - keyword: "export to CSV"
  - keyword: "data export"
  - keyword: "share with analyst"
  - keyword: "send dataset"
  - keyword: "partner integration"
  - phrase: "dump the data"
  - phrase: "send them the spreadsheet"
routes_to:
  - "skill:data-handling-judgment"
  - "skill:privacy-review"
applies_to_user_types:
  - "all"
---

# Domain Safety — Export Redaction

## Iron Law

```
NO DIRECT IDENTIFIER LEAVES THE SYSTEM IN AN EXPORT.
NO QUASI-IDENTIFIER COMBINATION THAT IS RE-IDENTIFIABLE LEAVES UNFLAGGED.
THE RECIPIENT MATTERS — INTERNAL ANALYST IS NOT EXTERNAL PARTNER.
```

Exports are the most common cross-boundary PII leak path: a CSV "for the analytics team" becomes a download on a laptop, a copy on a partner's S3, a row in someone's training set. Two-layer guard: redact direct identifiers on every export, and pause on quasi-identifier shapes that re-identify even after the names are stripped.

## Direct identifiers — always redact

| Class | Action |
|---|---|
| Name, email, phone, address | Drop column or hash with a tenant-scoped salt |
| National ID (SSN, tax ID) | Drop column — never hash, hash is reversible by recipient |
| Payment card / IBAN | Drop column |
| Free-text fields (comments, notes) | Pass through a PII scrubber or drop the column |

## Quasi-identifiers — flag and audit

The k-anonymity rule of thumb: combinations of {birth date, ZIP/postal code, gender} re-identify 87% of US population. Same applies to {company size, industry, region, founding year} for B2B. When the export contains 3+ quasi-identifiers per row, surface the re-identification risk and ask whether bucketing (age-band instead of birthdate, region instead of city) is acceptable.

## Recipient-tier check

| Recipient | Floor |
|---|---|
| Internal analyst, NDA-bound, on-prem analytics | Pseudonymized identifiers OK |
| Internal analyst, BYO-device, cloud analytics | Pseudonymized + aggregated only |
| External partner, signed DPA | Pseudonymized + minimum-necessary columns |
| External partner, no DPA | Refuse; require DPA first |
| Public dataset | Aggregated, k-anonymity ≥ 5, no quasi-identifier combos |

## Refusal triggers

- *"Send the customer list to our new marketing vendor"* (no DPA cited) → refuse + redirect to legal.
- *"Export everything to a Google Sheet"* (recipient tier unknown) → ask the recipient question first.

## See also

- `skill:data-handling-judgment` — transfer + retention cognition.
- `skill:privacy-review` — DPA shape audit.
- `domain-safety-pii-marketing` — companion when partner = marketing channel.
