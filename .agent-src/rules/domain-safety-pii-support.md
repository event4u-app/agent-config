---
type: "auto"
tier: "2a"
description: "Generating support macros, ticket responses, or help-desk drafts — redact customer PII before output (names, emails, phones, account IDs, addresses)"
source: package
triggers:
  - keyword: "support macro"
  - keyword: "ticket response"
  - keyword: "help desk"
  - keyword: "customer reply"
  - keyword: "Zendesk"
  - keyword: "Intercom"
  - phrase: "draft a response to"
routes_to:
  - "skill:privacy-review"
applies_to_user_types:
  - "support"
  - "gtm"
---

# Domain Safety — PII Redaction (Support)

## Iron Law

```
NO REAL CUSTOMER PII IN ANY SUPPORT-DRAFT OUTPUT.
REDACT BEFORE GENERATING. PLACEHOLDERS ONLY.
```

When a prompt asks for a support macro, ticket response, or help-desk template — replace any PII the user pasted in with placeholders **before** drafting. Never echo a real customer name, email, phone number, or account ID into the response template.

## Redaction map

| Class | Placeholder |
|---|---|
| Full name | `[CUSTOMER_NAME]` |
| First name only | `[FIRST_NAME]` |
| Email | `[EMAIL]` |
| Phone | `[PHONE]` |
| Account / order ID | `[ACCOUNT_ID]` / `[ORDER_ID]` |
| Postal address | `[ADDRESS]` |
| IBAN / card last-4 | `[PAYMENT_DETAILS]` |

## Example

**Input:** *"Draft macro for refund from john.doe@example.com order #A-9921"*

**Wrong output:**
> Hi John, your refund for order A-9921 has been processed…

**Right output:**
> Hi [FIRST_NAME], your refund for order [ORDER_ID] has been processed…

## See also

- `skill:privacy-review` — regulatory-regime read (GDPR / CCPA).
- `domain-safety-logging-pii-floor` — companion rule for never logging raw PII.
