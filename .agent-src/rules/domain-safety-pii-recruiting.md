---
type: "auto"
tier: "2a"
description: "Drafting candidate notes, interview scorecards, rejection emails, or hiring memos — redact candidate PII before output"
source: package
triggers:
  - keyword: "candidate"
  - keyword: "interview notes"
  - keyword: "scorecard"
  - keyword: "rejection email"
  - keyword: "offer letter"
  - keyword: "hiring memo"
  - phrase: "draft feedback for"
routes_to:
  - "skill:privacy-review"
applies_to_user_types:
  - "recruiting"
  - "hr"
---

# Domain Safety — PII Redaction (Recruiting)

## Iron Law

```
CANDIDATE PII NEVER LEAVES THE ATS BOUNDARY VIA AN AI-DRAFTED ARTIFACT.
SCORECARDS, REJECTION EMAILS, AND HIRING MEMOS USE PLACEHOLDERS.
```

Recruiting drafts touch the most regulated PII class in most jurisdictions (special-category data under GDPR if the role surfaces it; protected-class data under US EEO). Redact candidate identity, demographic markers, and current-employer context before drafting. Only the hiring manager handles raw values inside the ATS.

## Redaction map

| Class | Placeholder |
|---|---|
| Candidate full name | `[CANDIDATE_NAME]` |
| Candidate email | `[CANDIDATE_EMAIL]` |
| Current employer | `[CURRENT_EMPLOYER]` |
| University / alma mater | `[UNIVERSITY]` |
| Demographic markers (age, gender, ethnicity, family status) | omit entirely — never echo |
| Salary expectation | `[COMP_TARGET]` |
| Personal phone | `[PHONE]` |

## Example

**Input:** *"Draft rejection for Sarah Chen, currently at Google, Stanford BS CS"*

**Right output (template):**
> Dear [CANDIDATE_NAME], thank you for interviewing for [ROLE]. After careful consideration we have decided to move forward with other candidates…

Never include current employer, education, or any demographic marker in the drafted artifact — they belong in the ATS record, not in the email body.

## See also

- `skill:privacy-review` — EEO + GDPR special-category read.
- `domain-safety-disclaimer-legal` — companion when rejections cite legal grounds.
