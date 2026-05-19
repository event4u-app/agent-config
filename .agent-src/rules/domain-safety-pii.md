---
type: "auto"
tier: "2a"
description: "Drafts, logs, and exports touching real customer/candidate/counterparty data — redact direct identifiers, use placeholders, flag re-identification on quasi-IDs"
source: package
triggers:
  - keyword: "support macro"
  - keyword: "ticket response"
  - keyword: "help desk"
  - keyword: "Zendesk"
  - keyword: "Intercom"
  - keyword: "testimonial"
  - keyword: "case study"
  - keyword: "customer story"
  - keyword: "candidate"
  - keyword: "interview notes"
  - keyword: "scorecard"
  - keyword: "rejection email"
  - keyword: "offer letter"
  - keyword: "invoice"
  - keyword: "accounts receivable"
  - keyword: "accounts payable"
  - keyword: "finance memo"
  - keyword: "log"
  - keyword: "logger"
  - keyword: "Sentry"
  - keyword: "Datadog"
  - keyword: "structured log"
  - keyword: "export to CSV"
  - keyword: "data export"
  - keyword: "partner integration"
  - phrase: "draft a response to"
  - phrase: "marketing email featuring"
  - phrase: "draft feedback for"
  - phrase: "log the user"
  - phrase: "send them the spreadsheet"
routes_to:
  - "skill:privacy-review"
  - "skill:data-handling-judgment"
  - "skill:logging-monitoring"
  - "skill:secrets-management"
applies_to_user_types:
  - "all"
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

# Domain Safety — PII Redaction

## Iron Law

```
NO RAW DIRECT IDENTIFIER IN ANY AI-GENERATED DRAFT, LOG LINE, OR EXPORT.
PLACEHOLDERS IN DRAFTS. ALLOWLISTED STRUCTURED FIELDS IN LOGS.
REDACTION + RE-IDENTIFICATION CHECK ON EXPORTS.
```

PII leaks via three surfaces: AI-drafted artifacts (emails, scorecards, invoices), log streams (Datadog / Sentry / CloudWatch), and exports (CSV / partner shares). Redact at generation time, not after review. Marketing case studies are the consent-cited exception — and consent must be cited in the prompt.

## Surface 1 — Drafts (artifacts)

Replace any pasted PII with placeholders **before** drafting. Sector matrix:

| Sector | Placeholders | Routes |
|---|---|---|
| **Support** | `[CUSTOMER_NAME]`, `[EMAIL]`, `[PHONE]`, `[ACCOUNT_ID]`, `[ORDER_ID]`, `[ADDRESS]`, `[PAYMENT_DETAILS]` | `skill:privacy-review` |
| **Marketing** | `[CUSTOMER_COMPANY]`, `[CONTACT_NAME]`, paraphrase quotes, round metrics | `skill:privacy-review` |
| **Recruiting** | `[CANDIDATE_NAME]`, `[CANDIDATE_EMAIL]`, `[CURRENT_EMPLOYER]`, `[UNIVERSITY]`, `[COMP_TARGET]`; **omit demographics entirely** | `skill:privacy-review` |
| **Finance** | `[COUNTERPARTY]`, `[CONTACT_EMAIL]`, `[BANK_ACCOUNT]`, `[TAX_ID]`, `[COST_CENTER]`, `[AMOUNT]` | `skill:privacy-review`, `skill:data-handling-judgment` |

### Marketing — consent-cited exception

Real customer names / logos / quotes allowed only when the prompt cites one of:

- *"Reference-customer agreement dated YYYY-MM-DD"*
- *"Quote approved by [CONTACT] on YYYY-MM-DD"*
- *"Public press release [URL]"*

Otherwise — redact to placeholders.

### Recruiting — special-category warning

Demographic markers (age, gender, ethnicity, family status) are **never** echoed in drafted artifacts — they belong in the ATS record. Special-category data under GDPR + protected-class data under US EEO.

## Surface 2 — Logs

```
NO RAW EMAIL, NAME, PHONE, ADDRESS, TOKEN, OR PAYMENT IDENTIFIER
EVER REACHES THE LOG STREAM. ALLOWLISTED STRUCTURED FIELDS ONLY.
```

Required patterns:

1. **Allowlisted structured fields only.** Log `user_id`, `tenant_id`, `request_id`, `event_type` — never `user` or `request` blobs.
2. **Logger-level redaction.** Configure the logger to scrub `email`, `phone`, `name`, `address`, `token`, `password`, `card_number`, `iban` keys recursively from any payload.
3. **No raw exception payloads.** Exceptions captured by Sentry / Bugsnag must scrub the request body via the SDK's `before_send` hook.
4. **No log-and-forget for auth flows.** Login / password-reset / token-mint logs never include the credential itself, only the actor + outcome.

Refuse to write `logger.info("User logged in: $request->all()")` or `Log::info($user)` — show allowlisted version instead. Tokens + API keys + webhook secrets follow the same rule under `skill:secrets-management`.

## Surface 3 — Exports

```
NO DIRECT IDENTIFIER LEAVES THE SYSTEM IN AN EXPORT.
NO QUASI-IDENTIFIER COMBINATION THAT IS RE-IDENTIFIABLE LEAVES UNFLAGGED.
THE RECIPIENT MATTERS — INTERNAL ANALYST IS NOT EXTERNAL PARTNER.
```

### Direct identifiers — always redact

| Class | Action |
|---|---|
| Name, email, phone, address | Drop column or hash with a tenant-scoped salt |
| National ID (SSN, tax ID) | Drop column — never hash, hash is reversible by recipient |
| Payment card / IBAN | Drop column |
| Free-text fields (comments, notes) | Pass through a PII scrubber or drop the column |

### Quasi-identifiers — flag and audit

k-anonymity rule of thumb: combinations of {birth date, ZIP/postal code, gender} re-identify 87% of US population; same for {company size, industry, region, founding year} in B2B. When the export contains 3+ quasi-identifiers per row, surface the re-identification risk and ask whether bucketing (age-band instead of birthdate, region instead of city) is acceptable.

### Recipient-tier matrix

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
- *"We're under SEC investigation — can we clean up old emails?"* → hard refuse; flag spoliation risk; redirect to counsel.

## See also

- `skill:privacy-review` — regulatory-regime read (GDPR / CCPA / HIPAA / EEO).
- `skill:data-handling-judgment` — transfer + retention cognition.
- `skill:logging-monitoring`, `skill:secrets-management` — technical surfaces.
- `domain-safety-disclaimer` — companion advisory rule.
- `domain-safety-retention` — companion retention rule.
