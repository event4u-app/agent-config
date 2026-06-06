---
model_tier: high
name: unit-economics-modeling
description: "Use when modeling CAC, LTV, payback, contribution margin, or burn-multiple per customer — SaaS, marketplace, or transactional. Triggers on 'are we unit-economic', 'what is our LTV/CAC'."
status: active
tier: senior
domain: product
context_spine: [product, fiscal-period]
recommended_for_user_types: [founder, finance]
workspaces:
  - finance
packs:
  - finance-basic
trust:
  level: professional
install:
  removable: true
---

# unit-economics-modeling

## When to use

- A board ask: "is this business unit-economic?" — needs CAC / LTV / payback, not vibes.
- A new channel is scaling and the question is whether the CAC payback period is sustainable.
- A pricing or packaging change needs to be tested against contribution margin per cohort.
- A finance-partner needs to construct burn-multiple cognition before the next forecast or scenario pass.

Do NOT use for full-business intrinsic-value modeling, OKR setting, funnel-stage diagnosis, or backlog ranking (see Related Skills).

## Cognition cluster

- **Mental model 1 — First principles.** Strip the unit to one paying
  customer and one fully-loaded acquisition dollar. Aggregate ratios
  ride on per-unit truth; if the unit is mis-defined (trial vs paid,
  household vs seat), every ratio downstream is decoration. See
  [`docs/contracts/mental-models.md`](../../../docs/contracts/mental-models.md) § 1.
- **Mental model 8 — Second-order thinking.** A CAC drop driven by
  discounting lifts LTV/CAC on paper while shortening cohort
  retention — the second-order effect lands two quarters later in
  churn. Score the second-order cost of every lever, not just the
  first-order ratio. See `mental-models.md` § 8.
- **Context-spine — product + fiscal-period.** Read the **product**
  slot for what a "customer" actually is in this scope (seat vs
  household vs paid trial vs activated free), and the
  **fiscal-period** slot for the close-window the ratios must
  reconcile against (monthly close vs quarterly board pack vs
  annual plan). See
  [`context-spine`](../../../docs/contracts/context-spine.md).

## Procedure

### Step 0: Inspect

1. Confirm the business shape — SaaS / marketplace / transactional. The three canonical cases differ in **revenue recognition** and **churn definition**, not in arithmetic.
2. Confirm a fully-loaded CAC is computable: paid spend + sales comp + content/SEO allocation + tooling. Marketing-spend-only CAC is a vanity metric.

### Step 1: Compute CAC per channel

1. CAC = `(fully-loaded acquisition spend in window) / (new paying customers acquired in same window)`. Match window to sales-cycle length, not calendar quarter.
2. Compute by channel **and** blended. Blended-only hides the channel that is breaking the average.
3. Anti-pattern: counting trial signups as customers. Customer = first paid charge cleared.

### Step 2: Compute gross margin

1. Gross margin = `(revenue − COGS) / revenue`. COGS includes hosting, payment fees, third-party APIs the customer's usage drives, and direct customer-success cost.
2. Gross margin must be **per dollar of revenue**, not per customer. Per-customer gross margin is contribution margin (Step 3).
3. SaaS healthy band: 70–85%. Marketplace: 15–40%. Transactional: 5–25%. Outside these — the business is mislabelled or the COGS allocation is wrong.

### Step 3: Compute LTV

1. Pick the canonical formula for the case:
   - **SaaS:** `LTV = ARPA × gross_margin / monthly_churn_rate`. Use net-dollar churn for self-serve, gross logo churn for high-touch.
   - **Marketplace:** `LTV = take_rate × GMV_per_user × retention_curve_AUC` over 24 months. Steady-state extrapolation is dishonest below 24 months of cohort data.
   - **Transactional:** `LTV = avg_order_value × gross_margin × purchases_per_year × avg_lifetime_years`.
2. Cap implied lifetime at 5 years for any business with < 3 years of cohort history. Anything longer is a fairy tale.
3. State the formula used inline. Do not let the reader infer.

### Step 4: Compute payback and ratio

1. **CAC payback** (months) = `CAC / (ARPA × gross_margin)` for SaaS; analogue for marketplace and transactional. Healthy SaaS: ≤ 12 months.
2. **LTV / CAC ratio**: target ≥ 3.0. Below 1.5 is acquisition-loss territory; above 5.0 means under-investment in growth (or bad LTV math).
3. Both numbers, not one. Payback drives capital efficiency; ratio drives long-run economics.

### Step 5: Compute burn-multiple judgment

1. **Burn multiple** = `net burn / net new ARR` over the fiscal-period
   slot's reporting window (monthly close / quarterly / annual).
   It answers *"how many dollars of cash do we burn to add one
   dollar of recurring revenue?"* — a single ratio that condenses
   CAC, gross margin, and churn into capital efficiency.
2. Compute on **net** new ARR (gross new − churn − contraction).
   Burn-multiple on gross new ARR flatters the picture by exactly
   the churn rate; auditors and acquirers will recompute.
3. Read the ratio against the org-stage colour from the
   **fiscal-period** + product spine — do not hardcode a band here.
   The cognition is *"smaller is better, and the direction across
   cohorts matters more than the point estimate."* Bands belong in
   `runway-cognition` (O3) where stage context is the load-bearing
   input.

### Step 6: Cohort the answer

1. Run Steps 1–5 by signup-quarter cohort. Trends matter more than the point estimate.
2. If LTV/CAC is improving but payback is lengthening, you are buying retention with discounting — flag.
3. If both deteriorate, the channel mix has shifted to a worse channel — segment by channel to find the leak.

### Step 7: Validate

1. Sanity-check LTV against revenue retention. If implied LTV > 8× annual revenue per customer with monthly churn > 2%, the math is wrong.
2. Sanity-check CAC against fully-loaded P&L. If channel CACs sum to less than total acquisition spend, allocations are missing.

## Gotcha

- Marketing-spend-only CAC is the most common deception. Sales comp, BDR salaries, content production, and tooling all belong in fully-loaded CAC.
- Net-dollar retention > 100% does not justify ignoring logo churn — they answer different questions.
- ARPA averaged across plan tiers hides churn concentrated in one tier. Compute per tier when tiers differ in price by more than 2×.
- Payback period using contribution margin (post variable-cost) is honest; payback using gross revenue is the kind of math VCs see in pitch decks and discount on sight.

## Do NOT

- Do NOT extrapolate LTV beyond observable cohort data without saying so explicitly.
- Do NOT mix freemium activation rates with paid CAC; they live in different universes.
- Do NOT report a single LTV/CAC for a business with multiple distinct customer segments — segment first.

## Related Skills

**WHEN to use this**

- The question is per-customer economics (CAC, LTV, payback, contribution margin).
- The decision is whether to scale a channel or pricing tier.

**WHEN NOT to use this**

- Whole-business intrinsic value with terminal value — route to [`dcf-modeling`](../dcf-modeling/SKILL.md).
- Diagnosing where conversion drops — route to [`funnel-analysis`](../funnel-analysis/SKILL.md).
- Ranking competing initiatives — route to [`rice-prioritization`](../rice-prioritization/SKILL.md).
- Setting team objectives that move these metrics — route to [`okr-tree-modeling`](../okr-tree-modeling/SKILL.md).
- Cash-runway shape, fundraise-trigger heuristics, or layoff-vs-cut-vs-grow framing — route to [`runway-cognition`](../runway-cognition/SKILL.md) (O3).
- Multi-statement scenario construction over base / upside / downside — route to [`scenario-modeling`](../scenario-modeling/SKILL.md) (O4).
- Forecast-call construction (commit / best-case / pipeline) — route to [`forecasting`](../forecasting/SKILL.md) (O2).

Wing-4 handoff: this skill ships the `unit-economics-frame.md`
artifact that `scenario-modeling` (O4) reads as its money input
(`docs/guidelines/wing4-handoff.md` § Chain 1).

## When the agent should load this

- "What's our LTV / CAC?"
- "Is this channel paying back fast enough?"
- "Compute unit economics for this pricing tier."
- "Are we unit-economic at this CAC?"
- "Cohort our payback period."

## Output

1. **`unit-econ-table.md`** — table per channel and blended: CAC · ARPA · gross margin · payback months · LTV · LTV/CAC · burn-multiple. With cohort columns (last 4 quarters).
2. **`assumptions.md`** — formula chosen (SaaS / marketplace / transactional), churn definition, COGS allocation method, lifetime cap. One bullet per choice.
3. **`cohort-trend.md`** — trend chart (ASCII or markdown table) of CAC, payback, LTV/CAC, burn-multiple over the last 4–8 cohorts. Annotate channel-mix shifts.
4. **`sanity-checks.md`** — explicit cross-checks (LTV vs annual revenue, channel CAC sum vs P&L). Flag any that fail with a one-line investigation pointer.
5. **`unit-economics-frame.md`** *(Wing-4 handoff)* — the typed artifact `scenario-modeling` (O4) reads: CAC / LTV ratio, contribution margin, payback band, burn-multiple verdict, segment scope, fiscal-period the frame reconciles against. Per `docs/guidelines/wing4-handoff.md` § Chain 1.
