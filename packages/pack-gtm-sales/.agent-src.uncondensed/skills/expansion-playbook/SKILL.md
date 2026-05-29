---
name: expansion-playbook
description: "Use when designing account-expansion mechanics — upsell vs cross-sell, expansion-trigger signals, NRR cognition. Triggers on 'lift NRR', 'when do we upsell vs cross-sell'."
status: active
tier: senior
domain: product
context_spine: [product, customer-segment]
workspaces:
  - gtm
packs:
  - gtm-sales
trust:
  level: professional
install:
  removable: true
---

# expansion-playbook

## When to use

- Net Revenue Retention plateaued and the team cannot name *which* expansion lever drives it — upsell, cross-sell, and seat-expansion get conflated under *"NRR"* and the moves are uniform when they should be lever-specific.
- An expansion play is firing on usage signals alone — accounts using more seats are treated as expansion targets without checking the upstream pain that earned the expansion.
- A new pricing or packaging change is live and the team needs to re-key the expansion triggers to the new shape before the old triggers misfire.

Do NOT use to save churning accounts (route to
`churn-prevention`), design days 0–30 onboarding (route to
`onboarding-design`), or build product-led seat-expansion loops
unattended by a human play (route to `retention-loops`).

## Cognition cluster

- **Mental model 18 — Pull vs. push.** Expansion that the buyer
  pulls (because pain or scope grew) compounds; expansion the
  vendor pushes (because the quarter needs the number) corrodes
  the relationship and inflates churn the next cycle. Pick the
  trigger that signals pull. See
  [`docs/contracts/mental-models.md`](../../../docs/contracts/mental-models.md) § 18.
- **Mental model 9 — Hypothesis-driven thinking.** Each expansion
  trigger is a hypothesis: *"if signal X is true, the buyer will
  accept expansion Y at price Z."* Triggers without falsification
  evidence are wishes; if a trigger has misfired three times, the
  trigger is wrong, not the buyer. See `mental-models.md` § 9.
- **Mental model 3 — Pareto (80/20).** ~20 % of accounts carry
  ~80 % of expansion potential. Uniform expansion outreach across
  the book is noise; weighted outreach by pull-signal strength is
  reasoning. See `mental-models.md` § 3.
- **Context-spine — product + customer-segment.** Read the
  **product** slot for which capabilities the segment can absorb
  next (sequencing matters — a cross-sell into a feature the
  segment cannot use yet inflates churn), and the
  **customer-segment** slot for switch-event patterns that signal
  organic scope expansion. See
  [`context-spine`](../../../docs/contracts/context-spine.md).

## Procedure

### Step 0: Inspect — separate upsell, cross-sell, seat-expansion

Inspect the trailing four quarters of expansion $ and decompose:

1. **Upsell** — same product family, higher tier (more seats at same SKU, premium tier of same SKU).
2. **Cross-sell** — different product family or SKU.
3. **Seat-expansion** — same SKU, more users, no tier change.

Compute each lever's $ contribution and NRR contribution. A book
treating these as one number cannot diagnose which lever is
broken.

### Step 1: Define one expansion trigger per lever, pull-signalled

Each trigger is a *buyer-side pull signal* with falsifiable
evidence:

1. **Upsell trigger** — buyer crosses tier-defining usage ceiling
   (e.g. seats > X, or feature-X-usage > Y) sustained for ≥ 30 days.
2. **Cross-sell trigger** — buyer requests a capability that lives
   in an adjacent SKU **twice in 60 days**, by two different
   contacts, in writing.
3. **Seat-expansion trigger** — admin invites N new users in a
   rolling 30-day window AND health-score (from `churn-prevention`)
   is green.

Triggers that misfire three times in a quarter become Step 0
diagnoses next quarter; do not patch them inside the quarter.

### Step 2: Map lever → play

Each lever gets one default play and one disqualifier:

- **Upsell** — quarterly business review surfacing the usage
  ceiling; tier-upgrade proposal with proof-of-value. Disqualifier:
  account on red health score (route to `churn-prevention`).
- **Cross-sell** — capability-fit discovery call with sponsor +
  user; pilot before contract change. Disqualifier: cross-sell SKU
  not GA for the segment.
- **Seat-expansion** — admin co-pilot session + group onboarding
  for new seats. Disqualifier: utilisation on existing seats
  < 40 % (you would be selling decay).

### Step 3: Sequence multi-lever opportunities

If two triggers fire on the same account in the same quarter:
sequence **upsell before cross-sell** (compound the contract the
buyer already believes in) **before seat-expansion** (the most
fragile lever — easiest to inflate, easiest to lose). Two plays
fired in parallel signal vendor-push and corrode the relationship.

### Step 4: Compute NRR by lever and verify against the dilution check

NRR = (start-ARR + expansion − churn − contraction) ÷ start-ARR,
per cohort. Decompose expansion into the three levers. **Verify**
each trigger's pull-signal is intact: confirm the buyer-side
artefact (usage ceiling crossed, written request, admin invite)
exists in instrumentation; a lever whose triggers cannot be
verified against artefacts is push-expansion mislabelled as pull,
and the next cycle's churn will return the revenue. A book hitting
115 % NRR via seat-expansion only is more fragile than a book
hitting 110 % via upsell + cross-sell — fragility shows up in the
next cycle's churn, not this one's revenue line.

### Step 5: Hand back

Hand the lever decomposition, the three pull-signalled triggers,
and the per-lever play to CS / AM operations and to
[`forecast-accuracy`](../forecast-accuracy/SKILL.md) for the
expansion side of the forecast call. NRR work without lever
separation is spending in random directions.

## Related Skills

**WHEN to use this**

- Decomposing NRR into upsell · cross-sell · seat-expansion levers.
- Defining pull-signalled triggers and per-lever plays.

**WHEN NOT to use this**

- Saving accounts likely to churn — route to
  [`churn-prevention`](../churn-prevention/SKILL.md).
- Designing days 0–30 onboarding milestones — route to
  [`onboarding-design`](../onboarding-design/SKILL.md).
- Product-led, vendor-unattended seat growth loops — route to
  [`retention-loops`](../retention-loops/SKILL.md).

## When the agent should load this

- "Lift our NRR — which lever?"
- "When do we cross-sell vs upsell account X?"
- "Why does our expansion churn back inside the next cycle?"
- "Welcher Expansion-Trigger ist eigentlich pull, nicht push?"

## Output

1. **`lever-decomposition.md`** — trailing-quarter expansion $ split into upsell · cross-sell · seat-expansion with NRR contribution per lever.
2. **`expansion-triggers.md`** — one pull-signalled trigger per lever · falsifiable evidence · misfire counter.
3. **`lever-play-map.md`** — per-lever default play · disqualifier · sequencing rule for multi-trigger accounts.

## Gotcha

- A trigger that fires on usage alone, without separating *pain growth* from *consumption growth*, will push when it should pull. Push-expansion lifts this quarter and depresses the next.
- Seat-expansion looks like the easiest lever and is the most fragile — easy to inflate by selling seats into accounts whose existing seats are under-utilised; the contraction lands one cycle later.
- *"Strategic"* cross-sell into a capability the segment is not yet ready to use buys revenue and pays for it in churn — segment-readiness is the gate, not vendor-side ambition.

## Do NOT

- Do NOT fire multiple expansion plays in parallel on one account; sequence per Step 3.
- Do NOT count seat-expansion at < 40 % existing-seat utilisation as expansion; it is selling decay.
- Do NOT chase NRR target without lever decomposition; the headline number can be hit by the most fragile lever.

## Runnable example

Mid-market SaaS, NRR 112 % last quarter, churn ticked up this quarter.

- Lever decomposition — upsell 35 %, cross-sell 18 %, seat-expansion 47 % of expansion $. Seat-expansion-led growth flagged as fragile.
- Triggers — *(1)* upsell trigger: seats > 50 sustained 30+ days (band 28–42 % conversion). *(2)* cross-sell: capability request twice in 60 days from two contacts (band 41–61 % conversion). *(3)* seat-expansion: admin invites ≥ 10 new users in 30 days AND green health (band 52–68 % conversion); misfire count for the quarter: 4 — trigger flagged for Step 0 re-diagnosis next quarter.
- Lever-play map — upsell QBR + tier proposal, disqualified for 3 red-health accounts; cross-sell pilot blocked for 2 accounts where SKU not yet GA-ready for mid-market.
- Hand-off — decomposition + triggers → CS / AM ops; sequencing rule live; expansion side of `forecast-accuracy` rebuilt on lever-weighted historical close rates.
