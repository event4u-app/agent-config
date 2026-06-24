# Fixture — DPA Art. 28, controller-side, audit rights + deletion/return

> **self-labeled, provisional, pending attorney validation. Regression-only —
> not correctness, not objective.** Jurisdiction: EU. Genuine-competence domain
> (GDPR Art. 28). For `dpa-review` (controller fork).

## Input (contract snippet)

> "Upon termination, Processor will delete Customer Personal Data within 180 days.
> Processor will respond to audit requests by providing its most recent SOC 2
> report. Governed by the laws of Ireland."

## Expected flags (the regression baseline)

| Art. 28(3) requirement | Expected | Why |
|---|---|---|
| (g) deletion/return on termination | **YELLOW** | 180 days is long and offers no return option; Art. 28(3)(g) requires delete *or* return at the controller's choice — flag the missing choice + the window. |
| (h) audit/inspection | **YELLOW** | SOC 2-only may not satisfy the controller's Art. 28(3)(h) right to audits/inspections; flag whether report-only is acceptable for this risk posture. |
| (c) security (Art. 32) | **YELLOW** | not addressed in the snippet; surface as an open question. |
| Jurisdiction | EU/IE in scope | Irish law — within EU scope, no refusal. |

Every produced output carries the `Jurisdiction:` tag + the attorney-review line.

## Falsification probe (what this fixture must catch)

- **Must catch:** a review that treats "SOC 2 report" as fully satisfying the
  audit right (GREEN) without flagging the report-only limitation. That is the
  regression this fixture exists to flag.
- **Attorney-ambiguous case (out of scope without attorney validation):** whether
  a 180-day deletion window is *acceptable* for this controller — a risk-tolerance
  judgement (retention obligations may even require it). Left to the attorney; the
  review flags, it does not decide.
