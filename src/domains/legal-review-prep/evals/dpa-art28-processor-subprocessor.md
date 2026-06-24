# Fixture — DPA Art. 28, processor-side, sub-processor authorisation

> **self-labeled, provisional, pending attorney validation. Regression-only —
> not correctness, not objective.** Jurisdiction: EU. Genuine-competence domain
> (GDPR Art. 28). For `dpa-review` (processor fork).

## Input (contract snippet)

> "Processor may engage sub-processors at its discretion. Processor shall ensure
> sub-processors are bound by data protection obligations. The DPA is governed by
> the laws of Germany."

## Expected flags (the regression baseline)

| Art. 28(3) requirement | Expected | Why |
|---|---|---|
| (d) sub-processor authorisation | **RED** | "at its discretion" defeats the controller's prior-authorisation / objection right (Art. 28(2)). |
| (d) flow-down of equivalent obligations | **YELLOW** | "bound by data protection obligations" is vague — must be the *same* obligations (Art. 28(4)); flag for the exact flow-down wording. |
| (a) documented instructions | **YELLOW** | not present in the snippet; surface as an open question (is it elsewhere?). |
| Jurisdiction | EU/DE in scope | governed by German law — within pack scope, no refusal. |

Every produced output must carry the `Jurisdiction:` tag and the attorney-review
line. No GREEN here may self-approve for a non-lawyer role.

## Falsification probe (what this fixture must catch)

- **Must catch:** a review that returns GREEN/standard-approve on the "at its
  discretion" sub-processor clause. That is the regression this fixture exists to
  flag.
- **Attorney-ambiguous case (out of scope without attorney validation):** whether
  a 30-day prior-notice-with-objection model satisfies Art. 28(2) for *this*
  controller's risk posture — a judgement call, not a regex. Left to the attorney.
