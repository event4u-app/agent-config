---
type: "auto"
tier: "2a"
description: "Drafting testimonials, case studies, social proof, or marketing emails referencing real customers — require consent; redact identifiers if absent"
source: package
triggers:
  - keyword: "testimonial"
  - keyword: "case study"
  - keyword: "social proof"
  - keyword: "customer story"
  - keyword: "logo wall"
  - phrase: "marketing email featuring"
routes_to:
  - "skill:privacy-review"
applies_to_user_types:
  - "marketing"
  - "gtm"
---

# Domain Safety — PII Redaction (Marketing)

## Iron Law

```
NO REAL CUSTOMER NAME, LOGO, OR QUOTE IN A PUBLIC MARKETING DRAFT
WITHOUT A CITED CONSENT RECORD IN THE PROMPT.
```

Customer testimonials and case studies are the highest-risk marketing artifacts: a missing consent flip turns a glowing story into a contract breach. Refuse to embed real identifying details unless the prompt explicitly cites the consent source (e.g., signed reference-customer agreement, attributed quote approval).

## Required when consent is cited

The prompt must include one of:
- *"Reference-customer agreement dated YYYY-MM-DD"*
- *"Quote approved by [CONTACT] on YYYY-MM-DD"*
- *"Public press release [URL]"* (consent inferred from prior publication)

Otherwise — redact to placeholders.

## Redaction map (consent absent)

| Class | Placeholder |
|---|---|
| Customer company name | `[CUSTOMER_COMPANY]` or "a Fortune 500 retailer" / "a mid-market SaaS" |
| Customer contact name | `[CONTACT_NAME]` |
| Customer logo | omit — request approval separately |
| Direct quote | paraphrase as `[PARAPHRASED_QUOTE]` |
| Specific metrics tied to one customer | round / range (e.g., "≈40% faster") |

## Example

**Input (no consent cited):** *"Write a LinkedIn post about how Acme Corp cut their close time by 47%"*

**Right output:**
> One of our mid-market SaaS customers cut their close time by ≈45% in the first quarter. Here's how the workflow shift played out…

## See also

- `skill:privacy-review` — consent shape audit.
- `domain-safety-disclaimer-consulting` — when claims carry advisory weight.
