---
recommended_model: inherit
name: onboarding-design
description: "Use when designing customer onboarding — time-to-first-value, milestone design, friction audit, drop-off diagnosis. Triggers on 'fix onboarding', 'why do new accounts churn fast'."
status: active
tier: senior
domain: product
context_spine: [product, customer-segment, funnel-stage]
workspaces:
  - product
packs:
  - product-basic
trust:
  level: professional
install:
  removable: true
---

# onboarding-design

## When to use

- New accounts churn inside their first 30 days and the team cannot name which onboarding milestone they failed to reach — drop-off is treated as a single number, not a stage-by-stage signal.
- A new segment is being onboarded against an onboarding flow built for a previous segment — the milestones likely do not match the new segment's switch-event shape.
- Time-to-first-value is *"days, maybe weeks"* — the answer needs to be a number with a falsifiable definition, not a sentiment.

Do NOT use to onboard employees (that is the Wing-4
employee-onboarding program — different audience, different
contract), diagnose long-cycle churn (route to
`churn-prevention`), or run the full visitor → paid funnel (route
to `funnel-analysis`).

## Cognition cluster

- **Mental model 14 — Meadows leverage points.** Onboarding is a
  high-leverage system: a change in the milestone *definition*
  reshapes retention more than a change in the welcome email. Pick
  the leverage point — milestone definition over surface polish.
  See
  [`docs/contracts/mental-models.md`](../../../docs/contracts/mental-models.md) § 14.
- **Mental model 16 — Leading vs. lagging indicators.**
  Time-to-first-value and milestone-completion are leading; D30
  retention is lagging. Onboarding decisions built on lagging
  signals can only confirm churn after it lands. See
  `mental-models.md` § 16.
- **Mental model 13 — Occam's razor.** When new accounts drop off,
  the simpler explanation usually wins: *"the first milestone is
  too far from the buyer's job to complete in one session"* beats
  *"users do not understand our value proposition."* Pick the
  simpler explanation; it changes the move. See
  `mental-models.md` § 13.
- **Context-spine — product + customer-segment + funnel-stage.**
  Read the **product** slot for what the segment can actually
  configure unattended, the **customer-segment** slot for the
  segment's job and switch-event, and the **funnel-stage** slot for
  where activation sits relative to signup and paid. See
  [`context-spine`](../../../docs/contracts/context-spine.md).

## Procedure

### Step 0: Inspect — pull the current onboarding shape

Inspect the actual funnel: signup → milestone-1 → milestone-2 →
activation → D30. For each transition pull conversion rate (with
band) and median time-to-transition for the last two cohorts.
Inspect whether the activation event correlates with paid retention;
if not, the activation event is mis-defined and Step 2 fixes it.

### Step 1: Define time-to-first-value with a falsifiable definition

Write the sentence: *"\<Segment\> reaches first value when
\<observable buyer action\> happens, by \<target hours / days\>
after signup."* The action must be observable in instrumentation,
must correlate with paid retention (Step 0 inspection), and must be
something the buyer accomplishes — not something the product
displays.

### Step 2: Design three milestones earning activation

Each milestone is a buyer action with a definition, a friction
audit, and a default outcome.

1. **Milestone definition** — one sentence in buyer-action form
   (*"buyer has imported one record"*, not *"buyer has seen the
   import screen"*).
2. **Friction audit** — name the three highest-friction steps the
   buyer must clear; each gets a *cheapest-fix* hypothesis.
3. **Default outcome** — if the buyer does nothing, what does the
   product do for them? A milestone with no default is a milestone
   the busy half of the segment will miss.

### Step 3: Audit friction at each milestone

For each milestone, time the buyer journey: clicks, fields, decision
points, wait states. Tag each as *blocker* (cannot proceed without
it), *toll* (proceed but slow), or *fog* (buyer unsure what to do
next). Fog kills more onboarding than blockers — fog is silent.

### Step 4: Diagnose drop-off by segment × milestone

The drop-off is rarely uniform. Segment by segment × milestone;
the cell with the steepest below-band drop is the binding fix.
Two cells dropping at once usually means a shared upstream cause
(account-provisioning failure, ICP mismatch) — fix upstream, not
in the milestone.

### Step 5: Hand back

Hand the time-to-first-value definition, the three milestones with
friction audits, and the segment × milestone drop-off table to the
implementing team and to
[`churn-prevention`](../churn-prevention/SKILL.md) for downstream
health-score signal definition. Onboarding owns days 0–30;
churn-prevention owns the signals after.

## Related Skills

**WHEN to use this**

- Designing or auditing days 0–30 of the customer lifecycle.
- Defining time-to-first-value as a falsifiable event, not a sentiment.

**WHEN NOT to use this**

- Long-cycle churn diagnosis (D60+) — route to
  [`churn-prevention`](../churn-prevention/SKILL.md).
- Account expansion or upsell mechanics — route to
  [`expansion-playbook`](../expansion-playbook/SKILL.md).
- Full visitor → paid funnel diagnosis — route to
  [`funnel-analysis`](../funnel-analysis/SKILL.md).
- Activation-event redefinition or aha-moment selection — route to
  [`activation-design`](../activation-design/SKILL.md).

## When the agent should load this

- "Fix our onboarding — new accounts churn fast."
- "Why does cohort-9 drop at milestone-2?"
- "Define time-to-first-value for the mid-market segment."
- "Wie viele Klicks bis zum ersten Wert?"

## Output

1. **`time-to-first-value.md`** — falsifiable definition: segment × observable action × target time × correlation with paid retention.
2. **`milestones.md`** — three milestones, each with definition · friction audit (blocker / toll / fog) · default outcome.
3. **`dropoff-table.md`** — segment × milestone conversion rates with bands; binding-fix cell flagged.

## Gotcha

- An activation event that does not correlate with paid retention is a vanity event. The funnel will look healthy and D30 will keep dropping.
- *"Onboarding emails"* is not onboarding design. Emails are a surface; milestones are the system. Designing emails before milestones is rearranging deck chairs.
- A milestone without a default outcome assumes the buyer drives the journey. Half of every segment will not — design for the half that will not.

## Do NOT

- Do NOT use industry-average onboarding benchmarks as targets; segment shape and product complexity dominate them.
- Do NOT confuse signup with activation; signup is consent, activation is value.
- Do NOT redesign milestones one at a time mid-cycle without an A/B holdout — concurrent changes destroy the signal.

## Runnable example

B2B mid-market analytics tool, D30 retention sagging from 71 % to 58 % over two quarters.

- Time-to-first-value — *"Mid-market: buyer reaches first value when one connected data source returns one rendered dashboard, within 24 hours of signup."* Correlation with D90 paid retention: r = 0.62.
- Milestones — *(1)* connect data source (friction: OAuth scope confusion = fog; default: paste-CSV fallback). *(2)* save first query (friction: schema picker = toll; default: starter-template per segment). *(3)* share dashboard with one teammate (friction: invite-flow buried = blocker; default: auto-invite admin).
- Drop-off table — Mid-Market × milestone-1: 41 % conv (band 35–47, vs trailing-cohort median 62 %). Binding fix: OAuth fog at milestone-1.
- Hand-off — milestones + drop-off → eng team for OAuth-fog fix; `churn-prevention` picks up D30+ health-score signals.
