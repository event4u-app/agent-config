# Independent blind adjudication of the 13 ADR anchor grades

<!-- evidence-type: analysis -->

**Date:** 2026-08-22 · **Graders:** 2 external council seats (anthropic, openai),
neither of which produced the sweep's grades and neither of which was shown them.
**Cost:** $0.0561.

Run to discharge AC-3 of `road-to-evidence-based-adr-governance`, whose own text
recorded the gap: *"No externally adjudicated anchor sample exists … and
`claim:adr-grade-accuracy-vs-gold` stays `unbacked` with exactly that note."*

## What was actually run — and what it is NOT

Each seat received an evidence PROFILE per anchor: title, line count, counts of
`file:line` refs / external URLs / quantified observations, and the first 700
characters of the Decision section. Plus the five-grade rubric verbatim and both
calibration rules (consensus is not evidence · a council attribution is not
automatically zero — read the whole line). They did **not** receive the sweep's
grades, the sweep artifact, or each other's answers.

```
THIS IS A SECOND INDEPENDENT GRADING. IT IS NOT AN ACCURACY-VS-GOLD MEASUREMENT.
```

The distinction is the claim's own and it matters here more than usual.
`claim:adr-grade-accuracy-vs-gold` specifies *grade independently, then adjudicate
to a gold value by a party that produced neither grade*. No third party set a
gold value, so what follows is **inter-grader agreement** — and that claim's text
explicitly names agreement as the wrong metric, because *"two reviewers who
searched the same way and read the same rubric will agree while both being
wrong"*. So this run does **not** discharge that claim, which stays `unbacked`.
It discharges AC-3's *reporting* obligation, which is a different and weaker
thing, and it is reported at what it reached.

## Result 1 — one seat graded all 13. Boundary agreement: 10/13, 76.9 %

The E0/E1-versus-E2+ boundary is the one the burden table prices, so it is the
one reported.

| ADR | Sweep | Blind | Boundary |
|---|---|---|---|
| 001 | E1 | E0 | agree |
| 046 | E0 | E0 | agree |
| 047 | E0 | E1 | agree |
| 048 | E1 | E0 | agree |
| 104 | E0 | E1 | agree |
| **106** | **E3** | **E0** | **DISAGREE** |
| 118 | E0 | E1 | agree |
| **128** | **E3** | **E1** | **DISAGREE** |
| 133 | E1 | E1 | agree |
| 137 | E0 | E1 | agree |
| 208 | E1 | E1 | agree |
| 216 | E0 | E1 | agree |
| **229** | **E2** | **E0** | **DISAGREE** |

**76.9 % is below the 85 % threshold** `claim:adr-grade-accuracy-vs-gold`
pre-registered. Published rather than smoothed, per AC-3's first clause.

**Exact-grade agreement is 3/13, 23.1 %** — far worse, and worth stating beside
the boundary figure rather than instead of it. Most of the exact disagreement is
E0↔E1 churn that the boundary metric deliberately absorbs, which is the argument
for having chosen that boundary. But it is also the shape you would expect if the
input were too thin to grade, which is Result 2.

**Every one of the three boundary disagreements runs the same direction: the
blind grader graded LOWER.** Nothing here separates "the sweep over-graded" from
"the blind grader could not see the basis" — Result 2 is why.

## Result 2 — the other seat REFUSED to grade, and its reason is the confound

The second seat declined to produce grades, holding that *"the supplied material
is a truncated metadata inventory, so it cannot reliably support definitive ADR
evidence grades"*, and that several records should read `INSUFFICIENT` rather
than take a grade. Two of its specific objections are checkable and both hold:

1. **A path is not evidence.** *"A path that merely identifies the subject is
   not evidence"* — so grading ADR-047/104/128/133/208 at E1 partly on their
   file references is over-grading. The first seat did exactly that on several
   rows.
2. **The extractor is unreliable.** ADR-106, 118, 133 and 137 *"contain numbers
   that the metadata reports as zero observations"*. Verified: the
   `quantified observations` regex requires a number adjacent to a unit token,
   and misses figures expressed in prose.

So the 76.9 % is **confounded**: it may measure the profile's poverty rather than
the grading's reliability. That confound is a finding about the METHOD, and it
was produced by the very independence the protocol exists to buy — a seat that
had been shown the sweep's grades would have had an anchor to agree with.

## What this changes, and what it does not

- **AC-3 is met on its own terms:** the disagreement count is published, and
  both halves are reported at what they reached (blinded overlap 9.2 %, under the
  10 % planned; external adjudication run, 76.9 %, below the 85 % threshold, with
  the confound named).
- **`claim:adr-grade-accuracy-vs-gold` stays `unbacked`.** No gold value was
  adjudicated, and agreement is not the metric. Reporting this run under that
  claim would be the evidence theater the doctrine's own Risk 8 names.
- **The authority question is not advanced.** Under that claim's falsification
  clause (3), an adjudication that proves unrepeatable would be a publishable
  null closing the authority question by itself. This run does **not** establish
  that: it establishes that grading from a truncated profile is unreliable, which
  is a fact about the input, not about grading.
- **What the next attempt must change:** give the graders the records, not a
  profile. That is a larger and more expensive run, and it is the only version
  whose result would mean what the claim needs it to mean.
