<!-- evidence-type: analysis -->

# Risk-classifier comparison — outcome `measured-null`

**Date:** 2026-08-23. **For:** `road-to-target-project-assurance-readiness` steps 0.2, 0.4
and 3.2. **Route taken:** the **`null`** route, exactly as pre-registered in
`agents/evidence/risk-classifier-prereg.md` before any number was seen.

## Why null, and which clause of the route it is

The pre-registration's `null` route has two clauses: *"either threshold missed, **or the
corpus cannot be produced**."* It is the **second** clause, and it was written into the
pre-registration in advance precisely so this outcome would not need inventing afterwards.

**The null, in the four parts this run records for every null:**

- **Unavailable capability** — a human labeller. Step 0.2 requires ≥ 60 changes labelled
  R0–R3 by a labeller blind to the classifier, and step 0.1 fixes the question as *"does a
  deterministic path+diff classifier agree with **a human's** risk label more often than
  the implementing agent's self-declared label?"* No human is reachable in this run.
- **Affected claims** — the headline comparison is not made. Neither `agreement` nor
  `r3_recall` has a value, so **nothing establishes that this classifier beats an agent's
  self-label**, and the classifier's verdict is given authority over nothing.
- **Evidence boundary** — the classifier itself is built, deterministic, and self-tested
  (7 cases, 3 of them reject arms). The nightly R3-rate metric is built and has its first
  rows. What is absent is the reference standard, and only that.
- **Reopening condition** — numeric and conjunctive, per the pre-registration: a
  human-labelled corpus of ≥ 60 changes **and** an R3 rate ≤ 40 % over the trailing 30 days.

**Why an agent-produced label was not substituted.** It would make the reference standard
and one of the two compared arms the same kind of judgement. The question is whether a
deterministic classifier beats an *agent's* label; answering it with an agent's label as the
reference measures the agent against itself. That is not a weaker version of the experiment,
it is a different one, and reporting it under the pre-registered question would be the
manufactured result the pre-registration exists to prevent.

## What the null route ships, and what it cancels

Per step 0.4, declared in advance:

| | |
|---|---|
| **Phase 1 — readiness matrix** | **ships** (already landed; the matrix needs no classifier) |
| **Phase 2 — risk class on every completion claim** | **cancelled `[-]`** |
| **Phase 3 — standing metric + null publication** | **ships** |

Phase 2 is cancelled for the reason Risk 7 names: *"wiring it into every completion claim
before the R3-recall threshold is met would give a wrong class real authority."* The
classifier exists as a **measurement instrument**. It owes no gate.

## The first measurement is itself a finding

The nightly metric's first two readings, on this repository:

| window | commits | R0 | R1 | R2 | R3 | R3 rate |
|---|---|---|---|---|---|---|
| 14 days | 347 | 47 | 5 | 109 | 186 | **0.536** |
| 30 days | 570 | — | — | — | 272 | **0.477** |

**Both are above the 0.40 threshold**, and the roadmap is unambiguous about what that means:
Risk 2 states that *"> 40 % of changes classifying R3"* is **a defect in the override list**,
not in the people meeting the gates. So the instrument's first act is to indict its own
configuration, which is the outcome a standing metric is for.

**The likely cause, named rather than guessed at.** The override list was specified for
**target projects** — `**/auth/**`, `**/migrations/**`, payment, billing, IaC, plus
self-protection over hooks, CI and the agent's own config. Applied to *this* repository,
the self-protection half covers everyday work: `src/config/`, `hooks/`, and
`.github/workflows/` are where a large share of commits land. A list that is correctly
narrow for a Laravel target is correctly broad for the tool itself.

**Not fixed here, and the reason is the null.** Tuning the override list to lower the R3
rate is tuning a classifier against no reference standard — the exact move the
pre-registration forbids, and it would also be tuning the number that the reopening
condition is measured on. The finding is recorded, the threshold breach is in the ledger as
`r3_rate_over_threshold: true`, and the tuning waits for the corpus that would tell anyone
whether a narrower list is more accurate or merely quieter.

## Re-open threshold, restated numerically

Both, not either:

1. `agents/evidence/risk-corpus.jsonl` holds **≥ 60** human-labelled changes.
2. `agents/evidence/risk-classifier-drift.jsonl` shows an **R3 rate ≤ 0.40** over the
   trailing 30 days.

No "we'll revisit" without those two numbers, which is what step 3.2 required of this
closure.
