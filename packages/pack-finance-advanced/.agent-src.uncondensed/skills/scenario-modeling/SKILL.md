---
recommended_model: gpt
name: scenario-modeling
description: "Use when constructing base / upside / downside scenarios — three-statement modeling, sensitivity analysis, optionality reasoning. Triggers on 'model the scenarios', 'what if growth halves'."
status: active
tier: senior
domain: process
context_spine: [org-stage, fiscal-period, product]
recommended_for_user_types: [founder, finance]
workspaces:
  - finance
packs:
  - finance-advanced
install:
  default: false
  removable: true
---

# scenario-modeling

## When to use

- A board pack, fundraise process, or annual plan needs base / upside / downside scenarios — not a single forecast number with a sensitivity table bolted on.
- A strategic bet (build / buy / partner, geo-expansion, pricing change) needs the **shape of its downside** before it locks; *"what's the worst defensible outcome"* is the load-bearing question.
- A founder or finance-partner needs to compare two options by their optionality, not their expected value — the option whose downside is bounded wins, not the option with the highest mean.

Do NOT use for per-customer economics (route to `unit-economics-modeling` (O1)), forecast-call construction (route to `forecasting` (O2)), or runway-shape reasoning (route to `runway-cognition` (O3)). This skill **composes** all three; it doesn't replace them.

## Cognition cluster

- **Mental model 21 — Second-order thinking.** Each scenario is a chain: revenue → margin → burn → runway → fundraise → dilution. Single-statement scenarios (just revenue) skip the chain and read like wishlists. See [`mental-models.md`](../../../docs/contracts/mental-models.md) § 21.
- **Mental model 29 — Premortem.** *"It's two windows from now and the downside scenario happened. Walk back."* The premortem forces concrete failure paths into the model; without it the downside is just a 20 % discount on base. See `mental-models.md` § 29.
- **Mental model 26 — Optionality.** Optionality = preserved future choices. Read each scenario by what choices it preserves vs forecloses. Bounded downside + preserved optionality > unbounded upside with foreclosed optionality. See `mental-models.md` § 26.
- **Context-spine — org-stage + fiscal-period + product.** Read **org-stage** for which scenarios matter (pre-revenue → upside is traction speed; growth → downside is competitive pressure). Read **fiscal-period** for the modeling horizon. Read **product** for which revenue lines are real vs roadmap. See [`context-spine`](../../../docs/contracts/context-spine.md).

## Procedure

### Step 0: Inspect and pull the upstream frames

Read the three Wing-4 inputs:

1. **`unit-economics-frame.md`** from O1 — CAC, LTV, contribution margin per channel and blended; burn-multiple direction.
2. **`forecast-band.json`** from O2 — construction shape, commit / best-case / pipeline, confidence band, retro signature.
3. **`runway-frame.md`** from O3 — current cash, burn shape, band-target, fundraise verdict, cut-or-grow verdict.

If any frame is missing, STOP and route to the producing skill. Do not synthesize the upstream frame; that breaks the boundary.

### Step 1: Define the three scenario shapes

1. **Base** = O2 commit + O3 status-quo burn + O1 channel mix unchanged. The "everything you've already said" scenario.
2. **Upside** = O2 best-case + O1 channel-mix shift to highest LTV/CAC + one named tailwind (segment proof / channel scale / pricing). *Name the tailwind*; un-named upside is wishlisting.
3. **Downside** = O2 commit-band lower bound + O1 channel mix shift to declining channel + one named headwind (segment churn / channel saturation / competitive entry). *Name the headwind*; un-named downside is "everything is 20 % worse".

### Step 2: Construct three statements per scenario

For each of the three scenarios, write three statements — **not three full models, three statements**:

1. **Revenue statement** — top-line shape over the horizon. Cite which O2 inputs flex.
2. **Margin statement** — gross + contribution shape. Cite which O1 inputs flex (channel mix, pricing, COGS).
3. **Cash statement** — net burn → runway gap shape. Cite the O3 band-target it lands against.

Each scenario = nine numbers (three statements × three time slices: now / mid-horizon / end-horizon) plus a one-line "what made this scenario this scenario" explanation.

### Step 3: Premortem each scenario

1. **Base premortem** — *"if base under-delivers by 20 %, which input was the load-bearing assumption?"* If the answer is one input, the base is fragile; demote that input and recompute.
2. **Upside premortem** — *"if upside hits, did we have the operating capacity to absorb it?"* Upside without operating-capacity reasoning is a fundraise pitch, not a plan.
3. **Downside premortem** — *"if downside hits, what's the next decision and when?"* Tag the decision points; un-tagged downsides have no operational meaning.

### Step 4: Run sensitivity, not Monte Carlo

For each scenario, vary the single load-bearing input (named in Step 3) by ±20 %. Read whether the runway-gap verdict changes shape.

A scenario whose verdict is stable under ±20 % sensitivity on its load-bearing input is robust. A scenario whose verdict flips is brittle; demote it into a *"what if"* footnote, not a board-pack scenario.

Monte-Carlo is over-precise for this cognition; the question is *"does the verdict survive the obvious sensitivity?"* — not *"what's the 95th percentile?"*.

### Step 5: Read the optionality, not just the mean

For each scenario, write the option-preservation note:

- *"This scenario preserves: ___ (named choices)."*
- *"This scenario forecloses: ___ (named choices)."*

The decision shape is rarely *"pick the highest mean"*. It's *"pick the scenario whose foreclosures we can live with and whose preserved options match the strategy"*.

### Step 6: Emit the scenario bundle

Produce `scenario-bundle.md` — the artifact strategist (T2 / P1 `build-buy-partner`) and finance-partner (T1) read for downstream decisions. Per `docs/guidelines/wing4-handoff.md` § Chain 1.

## Related Skills

**WHEN to use this**

- Constructing base / upside / downside for a board pack, fundraise, or strategic bet.
- Comparing two strategic options by their optionality and downside shape.

**WHEN NOT to use this**

- Per-customer economics — route to [`unit-economics-modeling`](../unit-economics-modeling/SKILL.md) (O1).
- Forecast-call construction — route to [`forecasting`](../forecasting/SKILL.md) (O2).
- Runway shape / fundraise timing — route to [`runway-cognition`](../runway-cognition/SKILL.md) (O3).
- Insource-vs-outsource-vs-acquire decisions — route to [`build-buy-partner`](../build-buy-partner/SKILL.md) (P1); P1 consumes this skill's bundle.
- Whole-business intrinsic value with terminal value — route to [`dcf-modeling`](../dcf-modeling/SKILL.md).

Wing-4 handoff: this skill reads `unit-economics-frame.md` (O1),
`forecast-band.json` (O2), `runway-frame.md` (O3); emits
`scenario-bundle.md` consumed by P1 and T1. Per
`docs/guidelines/wing4-handoff.md` § Chain 1.

## When the agent should load this

- "Model base / upside / downside for the board pack."
- "What does the downside look like if growth halves?"
- "Compare option A and option B by their downside shape."
- "Wie sehen unsere Szenarien aus?"

## Output

1. **`scenario-bundle.md`** *(Wing-4 handoff)* — three scenarios × three statements × three time slices, plus tailwind / headwind names, sensitivity-stability flag, and optionality note per scenario.
2. **`load-bearing-inputs.md`** — one input named per scenario as the load-bearing assumption; sensitivity result on each.
3. **`optionality-map.md`** — preserved / foreclosed choices per scenario; decision-shape recommendation.
4. **`premortems.md`** — base / upside / downside premortems with named failure paths and tagged decision points.

## Gotcha

- "Downside = base × 0.8" is the most common deception. Downside must have a *named* headwind; without it the scenario doesn't model anything.
- Upside without operating-capacity reasoning is a fundraise narrative, not a plan. Capacity (hiring lag, infrastructure, support load) is the inversion check.
- Monte-Carlo simulations on a forecast that has a typed confidence band are over-precise theatre. Sensitivity ±20 % on the load-bearing input is the honest test.
- Three-statement = three statements per scenario, not three full models. Nine numbers + one-line explanation = a readable bundle.

## Do NOT

- Do NOT construct scenarios without the three upstream frames (O1 / O2 / O3) — that breaks Wing-4 cognition boundaries.
- Do NOT name a scenario without naming its tailwind / headwind / decision points — the labels are the cognition.
- Do NOT optimise on mean; optimise on optionality + downside shape.

## Runnable example

Series-A SaaS, annual plan window.

- Step 0 — frames: O1 says blended LTV/CAC 3.1, burn-multiple 1.8 decel. O2 says hybrid forecast, commit $6.3M, best-case $8.1M, band ±14 %. O3 says runway gap −5mo, fundraise=raise.
- Step 1 — Base = $6.3M revenue, status-quo burn. Upside = $8.1M, tailwind = "enterprise segment proof point closes Q2". Downside = $5.4M, headwind = "competitor enters mid-market, churn spikes 2× in Q3".
- Step 2 — three statements × three slices each. Base lands at gap −5mo; upside closes to −1mo; downside opens to −9mo.
- Step 3 — base premortem: load-bearing = enterprise segment close rate. Upside premortem: capacity = need 2 AEs by Q1 or upside is shape-wrong. Downside premortem: decision point = if churn ≥ 1.5× by mid-Q3, cut non-headcount + tighten fundraise narrative.
- Step 4 — sensitivity on close-rate ±20 %: base flips brittle (gap shape changes); demote to "fragile-base" footnote, re-run with conservative close rate.
- Step 5 — upside preserves M&A optionality; downside forecloses pricing-experiment optionality. Recommendation: plan against re-run base, raise narrative on upside, hold downside as triggered playbook.
