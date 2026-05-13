---
name: forecast-accuracy
description: "Use when constructing the forecast call — commit / best-case / pipeline categorisation, deal-level evidence test, accuracy retro-loop. Triggers on 'build the forecast', 'why does our commit miss'."
status: active
tier: senior
source: package
domain: product
context_spine: [product, customer-segment]
---

# forecast-accuracy

## When to use

- The quarterly forecast call is being constructed and the team needs a categorisation rule that survives retro — not a feel-good number that flatters this week.
- Commit has missed two or more quarters and nobody can name which signals broke — the retro-loop is missing or the categorisation rule is unwritten.
- A new RevOps lead inherits a pipeline and needs to rebuild the forecast call without inheriting last regime's optimism bias.

Do NOT use to design pipeline stages (route to
`pipeline-strategy`), qualify a single deal (route to
`deal-qualification-meddic`), or build the finance-side
top-down / bottom-up model (composes against — but does not
duplicate — the finance-partner forecasting capability,
via the `forecast-construction-shape` interface).

## Cognition cluster

- **Mental model 16 — Leading vs. lagging indicators.** Closed-won
  is lagging; per-stage conversion and MEDDIC-slot completeness
  are leading. A forecast built on lagging signals can only confirm
  the result after it lands. See
  [`docs/contracts/mental-models.md`](../../../docs/contracts/mental-models.md) § 16.
- **Mental model 29 — Premortem.** Before locking the call, write
  the post-quarter retro as if commit missed by 20 %. The premortem
  surfaces which categorisations are riding on weak evidence; demote
  those before the call locks. See `mental-models.md` § 29.
- **Mental model 9 — Hypothesis-driven thinking.** Each commit deal
  carries a falsifiable claim: *"this closes by \<date\> because
  \<evidence\>."* If the claim cannot be falsified inside the
  quarter, the deal is best-case, not commit. See
  `mental-models.md` § 9.
- **Context-spine — product + customer-segment.** Read the
  **product** slot for what is actually GA-shippable this quarter
  (deals depending on non-shipped scope are not commit), and the
  **customer-segment** slot for segment-historical close rates —
  pricing-power and cycle-length differ by segment and the forecast
  must too. See
  [`context-spine`](../../../docs/contracts/context-spine.md).

## Procedure

### Step 0: Inspect — inherit pipeline + qualification artefacts

Pull `stage-definitions.md`, `coverage-by-cell.md` from
`pipeline-strategy`, and the latest `meddic-card.md` per deal from
`deal-qualification-meddic`. Inspect whether each commit-candidate
deal carries falsifiable evidence per MEDDIC slot — a forecast
built without that inspection is rep opinion, not categorisation.

### Step 1: Lock the three categories with falsifiable rules

1. **Commit** — deal closes in-window with ≥ 90 % subjective
   probability **and** MEDDIC slots all filled with evidence **and**
   decision-process has buyer-written dates inside the window.
2. **Best-case** — deal *could* close in-window with ≥ 50 %
   probability **and** ≤ 2 MEDDIC slots unfilled **and** at least
   one decision-process date inside the window.
3. **Pipeline** — everything else. Pipeline is not a forecast
   category; it is the population from which commit and best-case
   are drawn.

Reject *"commit"* placements that do not meet all three commit
criteria, regardless of $ value or rep confidence.

### Step 2: Apply the segment-historical close rate

For each deal, compute *expected $* = $ × segment-historical
in-window close-rate (trailing four quarters). Aggregate by
category. If commit-$ exceeds (segment historical commit close-rate
× pipeline-$ in commit), the call is structurally optimistic — find
the optimism source before defending the number.

### Step 3: Premortem the commit list

Write *"if commit misses by 20 %, the reason is \_\_\_."* The most
common patterns: (a) one anchor deal slipped, (b) segment cycle
lengthened, (c) procurement/legal queues bunched at quarter-end.
Tag each commit deal with which of these would kill it; deals tagged
with two or more move to best-case.

### Step 4: Construct the call with confidence bands

Report **commit $** = sum of commit-tagged after Step 3 demotions.
**Best-case $** = commit + best-case-tagged. Attach the band:
*"commit ± \<historical-deviation\>; best-case ± \<historical
upside\>"*. A call without a band has no honesty about its prior
miss-rate.

### Step 5: Run the accuracy retro-loop at quarter-end

Compare predicted commit / best-case / pipeline to actual
closed-won by category. Compute per-rep, per-segment, and per-stage
miss-rate. Patterns that repeat for two quarters become categorisation
rule changes in Step 1; one-off misses become deal-level evidence
upgrades in Step 0.

## Related Skills

**WHEN to use this**

- Constructing the quarterly forecast call from a qualified pipeline.
- Running the accuracy retro-loop and feeding it back into Step 1.

**WHEN NOT to use this**

- Designing pipeline stages or per-stage conversion targets — route to
  [`pipeline-strategy`](../pipeline-strategy/SKILL.md).
- Single-deal qualification or disqualification — route to
  [`deal-qualification-meddic`](../deal-qualification-meddic/SKILL.md).
- Finance-side top-down model or board-deck forecast — composes
  against (does not replace) the finance-partner forecasting capability
  via the `forecast-construction-shape` interface.

## When the agent should load this

- "Build the Q3 forecast call."
- "Why does our commit keep missing?"
- "Run the forecast retro for last quarter."
- "Welche Deals gehören wirklich in Commit?"

## Output

1. **`forecast-call.md`** — commit $ and best-case $ with confidence bands; per-segment breakdown.
2. **`commit-list.md`** — one row per commit deal: $, segment, MEDDIC-completeness, decision-process date, premortem tag (none / single-risk / two-risk demoted).
3. **`retro-deltas.md`** *(at quarter-end)* — predicted vs actual per category, per-segment, per-rep miss-rate, and the categorisation-rule change (if any) for next quarter.

## Gotcha

- *"Strong commit"* without buyer-written dates inside the window is a wish, not a forecast. Subjective probability without artefact evidence is what the retro will punish.
- Segment-historical close rates change after a pricing change, a packaging change, or a competitive shift. Recompute the rates when the segment shape changes, otherwise the call inherits the old regime's optimism.
- Reporting commit as a point estimate without the band hides the prior miss-rate. A team that has missed by 18 % twice and reports commit ± 0 % is performing forecasting, not doing it.

## Do NOT

- Do NOT place a deal in commit because the size is large; size is independent of evidence.
- Do NOT skip the premortem on commit deals — most misses come from a small number of anchor deals slipping, and the premortem is where you catch them.
- Do NOT change categorisation rules on a single-quarter miss; rules change on a two-quarter pattern.

## Runnable example

End of Q2, last two commits missed by 14 % and 21 %.

- Step 1 enforcement — three deals placed in commit had ≥ 2 MEDDIC slots open; demoted to best-case (–$ 540 k commit, +$ 540 k best-case).
- Segment close-rate — Mid-Market historical commit close-rate is 78 %; commit-$ implies 91 % aggregate close-rate; structural optimism of ~$ 320 k.
- Premortem — two anchor deals (each > 10 % of commit) tagged single-risk (procurement queue); one tagged two-risk (no buyer-written date) → demoted.
- Final call — *"commit $ 4.1 m ± 12 % (historical deviation); best-case $ 6.7 m + 8 % / – 14 %."* Commit-list flags the two procurement-risk anchors for VP-level intervention.
- Retro at quarter-end — predicted commit $ 4.1 m, actual $ 4.0 m; rule unchanged; one rep over-commits two quarters running → categorisation-coaching action.
