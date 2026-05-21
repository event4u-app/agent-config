---
name: churn-prevention
description: "Use when designing churn defence — health-score signals, churn-cause split (involuntary / value / relationship / fit), early-warning loop. Triggers on 'why are accounts leaving'."
status: active
tier: senior
source: package
domain: product
context_spine: [product, customer-segment]
workspaces:
  - product
packs:
  - product-basic
lifecycle: active
trust:
  level: professional
  confidence: high
  human_review_required: false
install:
  default: true
  removable: true
---

# churn-prevention

## When to use

- Net retention dropped and the team cannot name *which* of the four churn causes is dominant — defence-spending is uniform when it should be cause-specific.
- A health score exists but does not predict — it tracks usage but misses relationship and fit signals — and CS plays are running on bad triggers.
- A board ask names *"are we losing customers we should have kept, or customers who never fit?"* — the answer requires the four-way classification, not a single number.

Do NOT use to fix days 0–30 onboarding (route to
`onboarding-design`), drive upsell or expansion (route to
`expansion-playbook`), or build product-led retention loops (route
to `retention-loops`).

## Cognition cluster

- **Mental model 30 — Inversion.** Do not ask *"how do we keep this
  account?"* — ask *"name the reason this account will leave."* The
  inversion forces a cause; the cause picks the move. See
  [`docs/contracts/mental-models.md`](../../../docs/contracts/mental-models.md) § 30.
- **Mental model 16 — Leading vs. lagging indicators.** Cancellation
  is lagging; usage-decay, relationship-decay, and fit-mismatch
  signals are leading. A health score built on lagging signals can
  only confirm churn after the cancel request lands. See
  `mental-models.md` § 16.
- **Mental model 3 — Pareto (80/20).** ~20 % of accounts carry ~80 %
  of revenue risk. Uniform health-monitoring across the book is
  theatre; weighted monitoring is reasoning. See
  `mental-models.md` § 3.
- **Context-spine — product + customer-segment.** Read the
  **product** slot for which capabilities the segment was sold
  (value-churn lives here when capability and pitch diverged), and
  the **customer-segment** slot for the segment's switch-event
  patterns — fit-churn shows up early in segments whose switch
  event differs from the ICP. See
  [`context-spine`](../../../docs/contracts/context-spine.md).

## Procedure

### Step 0: Inspect — classify the last 20 churn events

Inspect the most recent 20 cancellation events. Tag each as one of:

1. **Involuntary** — payment failure, dunning, card expiry. Not a value problem; an ops problem.
2. **Value** — capability shipped does not match what was sold or what the buyer needs now.
3. **Relationship** — champion left, sponsor change, exec turnover; product still fits, relationship does not.
4. **Fit** — buyer was never the ICP; usage and pain never matched.

A book with > 30 % involuntary is an ops fix, not a CS fix. A book
with > 30 % fit is a marketing / qualification fix upstream, not a
CS fix.

### Step 1: Define health-score signals per cause

One leading signal per cause, falsifiable, computable from
existing telemetry:

1. **Involuntary** — payment-method age, dunning-retry depth.
2. **Value** — feature-usage decay vs paid-tier ceiling (used / available), session length trend.
3. **Relationship** — primary-contact response-latency, executive-meeting cadence vs contract baseline.
4. **Fit** — segment classification at signup vs ICP; in-product behaviour mismatch (using read-only when sold workflow).

Health score = weighted aggregate per segment; weights derived from
Step 0's cause distribution. Do not average across causes — average
hides the binding signal.

### Step 2: Set early-warning thresholds with confidence bands

For each signal, compute the historical threshold where the signal
flipped to a churn event within 60 days. Attach a confidence band.
A threshold without a band over-triggers in low-volume cohorts and
trains CS to ignore the alert.

### Step 3: Map cause → play

Each cause gets one default play and one disqualifier:

- **Involuntary** — payment-retry + alternate-method outreach. Disqualifier: account in voluntary cancellation queue.
- **Value** — capability-gap interview; if real gap, route to product; if perception gap, route to enablement.
- **Relationship** — multi-thread outreach to second sponsor + exec sponsor injection.
- **Fit** — controlled wind-down; do not invest CS hours in saving a fit-mismatch account.

### Step 4: Run the early-warning loop weekly

Weekly: pull accounts crossing threshold per signal; tag with
cause; assign default play; record outcome at +30 days. Outcomes
that do not match the play's expected lift become Step 1 signal
revisions next quarter — not next week.

### Step 5: Hand back

Hand the cause-classification of the last 20 events, the
per-cause signal definitions, and the cause → play map to CS
operations and to
[`expansion-playbook`](../expansion-playbook/SKILL.md) for the
healthy-account expansion-trigger logic. Net retention work
without the cause split is spending money in random directions.

## Related Skills

**WHEN to use this**

- Designing a churn-cause classification and weighted health score.
- Running the weekly early-warning loop and tuning thresholds.

**WHEN NOT to use this**

- Days 0–30 onboarding friction — route to
  [`onboarding-design`](../onboarding-design/SKILL.md).
- Upsell or cross-sell to healthy accounts — route to
  [`expansion-playbook`](../expansion-playbook/SKILL.md).
- Product-led habit loops or activation events — route to
  [`retention-loops`](../retention-loops/SKILL.md).

## When the agent should load this

- "Why are accounts churning?"
- "Design a health score that actually predicts."
- "Classify last quarter's churn — value or fit?"
- "Welche Plays für Relationship-Churn?"

## Output

1. **`churn-classification.md`** — last 20 events tagged with cause; cause-distribution percentages with bands.
2. **`health-signals.md`** — per-cause leading signal · threshold · confidence band · weight in aggregate health score.
3. **`cause-play-map.md`** — per-cause default play · disqualifier · expected lift at +30 days.

## Gotcha

- A health score that aggregates without segmenting by cause hides the binding signal; CS plays based on the aggregate burn hours on the wrong account.
- *"Engagement dropped"* is not a cause; it is an observation. Engagement drops because of value, relationship, or fit — diagnose the cause before triggering a play.
- Fit-mismatch accounts surface as save targets when they should be wind-down targets. Saving a fit-mismatch account costs CS hours and produces a louder churn one cycle later.

## Do NOT

- Do NOT run uniform CS plays across the book; weight by Pareto-risk-tier.
- Do NOT change health-score thresholds inside a quarter without an A/B holdout — concurrent changes destroy the signal.
- Do NOT invest save-cycles into accounts whose churn cause is **fit**; route to a controlled wind-down and tighten qualification upstream.

## Runnable example

Mid-market SaaS, gross retention slipped from 92 % to 86 % over two quarters.

- Cause classification — of last 20 churns: involuntary 15 %, value 30 %, relationship 25 %, fit 30 %.
- Health signals — involuntary: payment-retry-depth ≥ 2 → 38 % cancel-in-60d (band 22–54). Value: feature-usage decay > 30 % MoM → 51 % cancel (band 38–64). Relationship: primary-contact silent 21+ days → 44 % cancel (band 30–58). Fit: ICP-classification ≠ ICP-purchased → 71 % cancel (band 58–82).
- Cause-play map — relationship-churn plays generate +18 % save-rate at +30 days; value plays generate +9 % only when paired with a product commit on the capability gap.
- Hand-off — classification + signals + plays → CS ops weekly; tightened qualification rule fed back to marketing (fit-mismatch upstream); healthy-account triggers handed to `expansion-playbook`.
