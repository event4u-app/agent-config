---
model_tier: inherit
name: activation-design
description: "Use when defining or auditing the activation event — aha-moment selection, retention correlation, falsifiable definition. Triggers on 'what is our aha moment', 'redefine activation'."
status: active
tier: senior
domain: product
context_spine: [product, customer-segment, funnel-stage]
workspaces:
  - product
packs:
  - product-discovery
trust:
  level: professional
install:
  default: false
  removable: true
---

# activation-design

## When to use

- The activation event is *"signed up"* or *"logged in"* and the funnel looks healthy while retention sinks — the event does not correlate with paid or D30, so the metric is a vanity surface.
- A new segment is being routed against an activation event built for a previous segment — the aha moment differs by segment and the metric needs to be re-keyed.
- A product loop redesign needs activation to complete the loop's first cycle (handover from `retention-loops`) — the activation event must match the binding loop's first reward, not an arbitrary product step.

Do NOT use to design the day-0-to-day-30 milestone path (route to
`onboarding-design`), the long-running retention loops themselves
(route to `retention-loops`), or the full visitor-to-paid funnel
diagnosis (route to `funnel-analysis`).

## Cognition cluster

- **Mental model 9 — Hypothesis-driven thinking.** *"Event E is the
  activation moment because users who reach E retain at \<rate\>
  vs \<base\>"* is a falsifiable claim with evidence. *"E feels
  important"* is not. Pick the event that survives the
  hypothesis test. See
  [`docs/contracts/mental-models.md`](../../../docs/contracts/mental-models.md) § 9.
- **Mental model 16 — Leading vs. lagging indicators.** Paid is
  lagging; the activation event must be leading — observable
  *before* the user has paid, and correlated with the lagging
  outcome. An activation event that is itself lagging cannot drive
  a decision in time. See `mental-models.md` § 16.
- **Mental model 13 — Occam's razor.** When candidate events
  compete, the simpler one (single observable action) wins if it
  correlates as well as a composite. Composite events hide
  noise behind apparent precision. See `mental-models.md` § 13.
- **Context-spine — product + customer-segment + funnel-stage.**
  Read the **product** slot for what counts as a *meaningful
  buyer action* in-product (the action must be observable in
  instrumentation), the **customer-segment** slot for the
  segment's switch-event (the aha moment is the segment's job
  done once), and the **funnel-stage** slot for activation's
  position relative to signup and paid. See
  [`context-spine`](../../../docs/contracts/context-spine.md).

## Procedure

### Step 0: Inspect — name the current activation event and its correlation

Inspect the existing definition. **Verify** by computing
correlation between the event and paid conversion / D30 retention
on the trailing four cohorts. If r < 0.4 with paid, the event is
mis-defined; if r > 0.4 but the event is downstream of paid, it is
lagging and useless for in-funnel decisions.

### Step 1: Generate three candidate activation events

Each candidate is one observable user action that:

1. **Is in-product, in-instrumentation, in-segment-shape.** No
   surveys, no proxies, no inferences from secondary signals.
2. **Sits upstream of paid in the funnel.** Activation that
   requires paid is a retention metric, not an activation metric.
3. **Maps to the segment's switch-event.** The candidate is the
   segment's *"job done once"* — not the vendor's vision of value.

### Step 2: Compute correlation per candidate

For each candidate, compute on the trailing four cohorts:

1. **Correlation with paid conversion** (point-biserial r).
2. **Correlation with D30 retention** among paid users.
3. **Coverage** — what fraction of paid users ever fire the event?
   A candidate with high r and low coverage is a niche aha, not
   the segment's aha.

The candidate that maximises (r-paid × r-retention × coverage) is
the binding event. **Verify** it passes the simplicity check
(Occam): if a composite event wins by < 10 % over a simpler
single-action event, pick the simpler one.

### Step 3: Lock the falsifiable definition

Write: *"For \<segment\>, activation = \<observable action\> within
\<time-to-event window\> after signup."* The time-to-event window
is the median time from signup to event among activated, retained
users — not an aspiration. The window is part of the definition;
events outside the window do not count.

### Step 4: Hand back to onboarding and retention

The activation event is the **target** of onboarding milestones
(route to `onboarding-design` for the milestone path that ends at
this event) and the **first cycle** of the binding retention loop
(route to `retention-loops` for the loop that begins from this
event). Activation work without these two handoffs is metric
theatre.

### Step 5: Run the recheck every quarter

Each quarter, recompute the correlation on the latest four cohorts.
Segment shape, pricing, or packaging shifts can move the aha
moment by one step. **Verify** the binding event still maximises
r × coverage; if a new candidate now wins, propose a redefinition,
do not silently switch the event mid-quarter.

## Related Skills

**WHEN to use this**

- Defining or auditing the activation event for a segment.
- Verifying correlation with paid / D30 against alternatives.

**WHEN NOT to use this**

- Designing the days 0–30 milestone path itself — route to
  [`onboarding-design`](../onboarding-design/SKILL.md).
- Designing the retention loops that begin at activation — route to
  [`retention-loops`](../retention-loops/SKILL.md).
- Full visitor → paid funnel diagnosis — route to
  [`funnel-analysis`](../funnel-analysis/SKILL.md).

## When the agent should load this

- "What is our aha moment?"
- "Redefine activation for the mid-market segment."
- "Does our activation event actually correlate with paid?"
- "Welches Event ist der echte Aha-Moment?"

## Output

1. **`activation-definition.md`** — segment · observable action · time-to-event window · trailing-cohort correlation with paid and D30 · coverage.
2. **`candidates-shortlist.md`** — three candidate events scored by r-paid × r-retention × coverage; simplicity check noted.
3. **`recheck-cadence.md`** — quarterly recheck plan: which cohorts feed the recompute · what would force a redefinition · who owns it.

## Gotcha

- An activation event that does not correlate with paid is a vanity event; the funnel looks fine while D30 keeps falling. Correlation comes before celebration.
- *"Composite"* activation events that combine three actions hide noise behind apparent precision; the simpler single-action event usually carries the segment's switch-event better.
- Switching the activation event mid-quarter without an A/B holdout destroys longitudinal comparison; propose a redefinition between quarters, with the recompute as evidence.

## Do NOT

- Do NOT pick activation by vendor narrative or pitch deck; the event must be observable in-product and falsifiable against retention.
- Do NOT define activation as something that requires paid status; activation is the leading event, paid is the lagging event.
- Do NOT use an industry-standard activation event ("first dashboard viewed", "first integration") without verifying segment correlation; segment shape dominates the choice.

## Runnable example

B2B mid-market analytics tool, current activation = *"user viewed dashboard"*, D30 retention 58 % despite activation rate 71 %.

- Step 0 inspect — *"viewed dashboard"* correlation with D30 paid retention r = 0.18; activation is decoupled from outcome. Flagged for redefinition.
- Step 1 candidates — *(C1)* connected one data source + rendered one dashboard (single action chain); *(C2)* saved one query; *(C3)* shared one dashboard with one teammate (network proxy).
- Step 2 scores — C1: r-paid 0.54 · r-retention 0.61 · coverage 0.78. C2: r-paid 0.34. C3: r-paid 0.41 · coverage 0.22 (niche). Winner: C1. Simplicity check: passes (single action chain).
- Step 3 definition — *"Mid-market activation = first data source connected and first dashboard rendered, within 24 hours of signup."*
- Hand-off — onboarding milestone path retargeted at C1 (`onboarding-design`); retention loop L1 from `retention-loops` begins at C1's first cycle. Quarterly recheck owned by RevOps.
