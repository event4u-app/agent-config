---
name: pipeline-strategy
description: "Use when designing or auditing a sales pipeline — stage exit criteria, per-cell conversion, coverage reasoning, leak detection. Triggers on 'tighten our pipeline', 'where is the leak'."
status: active
tier: senior
source: package
domain: product
context_spine: [product, customer-segment, channel-stage]
---

# pipeline-strategy

## When to use

- Pipeline stages are named but have no exit criteria — reps move deals on gut and forecasts ride on opinion, not evidence.
- Coverage is being computed from a flat multiple (*"3x quota"*) without per-stage conversion rates, so the multiple flatters or punishes the team at random.
- A board ask names *"why did pipeline coverage look fine and the quarter still missed?"* — a leak is hiding inside a healthy-looking total.

Do NOT use to qualify a single deal (route to
`deal-qualification-meddic`), construct the forecast call from a
locked pipeline (route to `forecast-accuracy`), or configure
CRM stage fields in a specific vendor tool (out of scope — this
skill is strategy, not tooling).

## Cognition cluster

- **Mental model 6 — Theory of constraints.** A pipeline has one
  binding stage at any time; rates upstream of the constraint are
  inventory that never ships, rates downstream cannot exceed the
  constraint. Find the constraint before changing anything else. See
  [`docs/contracts/mental-models.md`](../../../docs/contracts/mental-models.md) § 6.
- **Mental model 16 — Leading vs. lagging indicators.** Stage-to-stage
  conversion is leading; closed-won is lagging. A coverage call built
  on lagging signals can only confirm the miss after it lands. See
  `mental-models.md` § 16.
- **Mental model 3 — Pareto (80/20).** ~20 % of segment × stage cells
  carry ~80 % of revenue risk. Coverage uniformly applied across cells
  is theatre; coverage weighted by cell-level conversion is reasoning.
  See `mental-models.md` § 3.
- **Context-spine — product + customer-segment + channel-stage.**
  Read the **product** slot for what is actually sellable this
  quarter, the **customer-segment** slot for which segments belong in
  pipeline (and which are pre-pipeline education), and the
  **channel-stage** slot for where each segment enters. See
  [`context-spine`](../../../docs/contracts/context-spine.md).

## Procedure

### Step 0: Inspect — inventory the current pipeline shape

Pull stage counts, $ value, age in stage, and stage-to-stage
conversion for the trailing two quarters. Inspect whether each
stage has a written exit criterion; if not, write one now (one
bullet per stage, falsifiable). A pipeline without exit criteria
cannot be audited.

### Step 1: Lock stage definitions with exit criteria

Each stage gets three lines:

1. **Definition** — what the deal looks like in this stage (one sentence).
2. **Entry trigger** — the buyer event that moves a deal in (not a rep action).
3. **Exit criterion** — the artefact or signal that proves the deal earned the next stage (one bullet, falsifiable; *"meeting booked"* is not falsifiable, *"economic buyer named and confirmed"* is).

Reject any stage whose exit criterion is a rep activity ("call
made") rather than a buyer signal ("buyer confirmed budget owner").

### Step 2: Compute per-stage conversion rates with bands

For each stage transition, compute the trailing-quarter rate and a
95 % confidence band. Segment by customer-segment (and channel-stage
if the channel mix changed). Report the band, not the point — a
30 % rate on 12 deals and a 30 % rate on 300 deals are different
signals.

### Step 3: Find the binding constraint

The constraint is the stage whose conversion rate is **furthest
below its segment-historical median, weighted by $ value flowing
through it**. Add deals upstream of any other stage and watch them
queue; add deals upstream of the constraint and they queue twice as
fast. A pipeline-coverage call that ignores the constraint
multiplies inventory the team cannot ship.

### Step 4: Compute coverage cell by cell, not by total

Coverage = (pipeline $ at stage *s*) ÷ (target closed-won $ in
window) ÷ (cumulative conversion from *s* to closed-won). Compute
per segment × stage cell. A 3× total can hide a 0.8× cell — the
0.8× cell is the quarter's risk.

### Step 5: Name three leaks with falsifiable hypotheses

For the three lowest coverage cells (or the three steepest
conversion-rate drops vs trailing-quarter median), write one
sentence per leak: *"\<cell\> leaks at \<stage\> because \<cause\>;
falsified if \<test\> shows \<expected signal\>."* If a cause is
not testable in under two weeks, the hypothesis is not yet sharp
enough — sharpen before recommending a fix.

### Step 6: Hand back

Hand the locked stages, the per-cell coverage table, and the three
leak hypotheses to
[`forecast-accuracy`](../forecast-accuracy/SKILL.md) for
commit / best-case categorisation, and to
[`deal-qualification-meddic`](../deal-qualification-meddic/SKILL.md)
when the leak is upstream qualification, not late-stage execution.

## Related Skills

**WHEN to use this**

- Designing or auditing pipeline stages and per-stage rates.
- Computing coverage by segment × stage instead of by total.

**WHEN NOT to use this**

- Single-deal qualification — route to
  [`deal-qualification-meddic`](../deal-qualification-meddic/SKILL.md).
- Forecast call construction from a locked pipeline — route to
  [`forecast-accuracy`](../forecast-accuracy/SKILL.md).
- Product-led conversion-funnel diagnosis (signup → activation → paid) — route to
  [`funnel-analysis`](../funnel-analysis/SKILL.md).

## When the agent should load this

- "Tighten our pipeline stages — exit criteria are vibes."
- "Coverage looks 3× and we still missed. Where is the leak?"
- "Audit per-stage conversion by segment."
- "Welche Stage ist das Bottleneck im Quartal?"

## Output

1. **`stage-definitions.md`** — one block per stage: definition · entry trigger · exit criterion (buyer signal, falsifiable).
2. **`coverage-by-cell.md`** — table of segment × stage cells with $ pipeline, cumulative conversion, and computed coverage. Cells under 1× flagged.
3. **`leak-hypotheses.md`** — three leaks with falsifiable test + expected signal + 2-week deadline.

## Gotcha

- A pipeline with exit criteria written as rep activities (*"call made"*) is unauditable — reps move deals on activity, not on buyer signal, and forecasts inherit the noise.
- Total-pipeline coverage is the wrong unit. A 3× total made of 5× early-stage and 0.5× late-stage will miss the quarter even though the dashboard looks healthy.
- Per-stage conversion rates without confidence bands are gossip dressed as evidence. Twelve deals give you a band so wide the rate is uninformative.

## Do NOT

- Do NOT invent stages to flatter the dashboard. Each stage must have a buyer signal earning the transition.
- Do NOT compare the quarter's coverage to a fixed historical multiple if segment mix changed — recompute per cell.
- Do NOT recommend a fix to a leak before naming the falsifiable test that proves the cause.

## Runnable example

Mid-market SaaS, total coverage 3.1×, quarter missed by 18 %.

- Stages with exit criteria — *Discovery → Qualified (economic buyer named) → Proposal (pricing in writing) → Negotiation (terms in redline) → Won.*
- Per-cell coverage — Mid-Market × Proposal: **0.7×**. Mid-Market × Discovery: **6.4×**. Enterprise × Negotiation: **2.1×**.
- Constraint — Proposal → Negotiation conversion 22 % vs 41 % trailing-quarter median (band 14–31 %). Constraint is **Proposal exit**, not pipeline volume.
- Leaks — *(1)* Mid-Market proposals stall at pricing-page review; falsified if a pre-proposal pricing-walkthrough call lifts Proposal → Negotiation to 35 %+ within four weeks. *(2)* Enterprise Negotiation drags > 60 days; falsified if procurement-checklist shipped at Proposal stage cuts median age by 20 days. *(3)* Discovery overflow is unqualified — route to `deal-qualification-meddic`.
- Hand-off — coverage table + leaks → `forecast-accuracy` for commit / best-case rebuild on the corrected denominator.
