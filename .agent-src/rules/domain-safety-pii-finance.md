---
type: "auto"
tier: "2a"
description: "Drafting invoices, financial reports, AR/AP statements, or finance memos — redact counterparty PII and account/bank identifiers before output"
source: package
triggers:
  - keyword: "invoice"
  - keyword: "accounts receivable"
  - keyword: "accounts payable"
  - keyword: "finance memo"
  - keyword: "AR aging"
  - keyword: "AP run"
  - phrase: "draft a financial report"
routes_to:
  - "skill:privacy-review"
  - "skill:data-handling-judgment"
applies_to_user_types:
  - "finance"
  - "ops"
---

# Domain Safety — PII Redaction (Finance)

## Iron Law

```
NO REAL COUNTERPARTY PII OR BANK IDENTIFIERS IN ANY FINANCE-DRAFT OUTPUT.
TEMPLATES USE PLACEHOLDERS. SAMPLE DATA USES SYNTHETIC ONLY.
```

Finance drafts (invoices, AR/AP runs, reconciliation notes, board memos) routinely embed counterparty names, contact emails, bank account numbers, IBANs, tax IDs. A leaked draft is a regulator-triggering event. Redact at generation time, not after review.

## Redaction map

| Class | Placeholder |
|---|---|
| Counterparty company | `[COUNTERPARTY]` |
| Counterparty contact name | `[CONTACT_NAME]` |
| Counterparty email | `[CONTACT_EMAIL]` |
| Bank account / IBAN | `[BANK_ACCOUNT]` |
| Tax ID / VAT number | `[TAX_ID]` |
| Internal cost center | `[COST_CENTER]` |
| Real amount in a template | `[AMOUNT]` or synthetic round number |

## Example

**Input:** *"Draft a dunning letter for Acme Corp, IBAN DE89370400440532013000, owed €4,210"*

**Right output (template):**
> Dear [CONTACT_NAME], invoice [INVOICE_ID] for [COUNTERPARTY] in the amount of [AMOUNT] is now [DAYS] days past due. Please remit to [BANK_ACCOUNT]…

Real values stay in the user's spreadsheet — the agent never echoes them into the drafted artifact.

## See also

- `skill:data-handling-judgment` — retention + cross-border transfer.
- `domain-safety-retention-finance` — companion retention rule.
