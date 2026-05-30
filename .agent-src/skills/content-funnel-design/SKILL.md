---
recommended_model: inherit
name: content-funnel-design
description: "Use when mapping funnel-stage to content shape — conversion-pathway, content-as-system, leverage-point selection. Triggers on 'design our content funnel', 'why does mid-funnel leak'."
status: active
tier: senior
domain: product
context_spine: [product, customer-segment, channel-stage, funnel-stage]
recommended_for_user_types: [creator, gtm]
workspaces:
  - gtm
packs:
  - gtm-marketing
trust:
  level: professional
install:
  removable: true
---

# content-funnel-design

## When to use

- A team has content but no funnel — each asset is shaped to its author's preference, not to the funnel stage the audience is in.
- The cadence (`editorial-calendar`) is locked but one funnel stage is leaking and there is no content shape that would catch it.
- A new ICP requires re-mapping content shapes per stage because the previous mapping was inherited from a previous segment.

Do NOT use to plan publishing cadence (route to `editorial-calendar`),
diagnose quantitative drop-off (route to `funnel-analysis`), or
draft the asset itself (downstream of this skill).

## Cognition cluster

- **Mental model 14 — Meadows leverage points.** Some funnel stages
  are *parameters* (small change, small ripple) and some are
  *structure* (small change, system-wide ripple). The content
  funnel design is the discipline of placing the heaviest content
  investment at the structural leverage point, not the parameter
  one. See
  [`docs/contracts/mental-models.md`](../../../docs/contracts/mental-models.md) § 14.
- **Mental model 6 — Theory of constraints.** The slow funnel stage
  caps the whole pipeline. Adding content elsewhere does not loosen
  the constraint. See `mental-models.md` § 6.
- **Mental model 16 — Leading vs. lagging indicators.** Time-to-
  proof (asset → activation question) is leading; pipeline lift is
  lagging. The funnel design is gated on leading signals, not on
  the lagging ones the board sees a quarter later. See
  `mental-models.md` § 16.
- **Context-spine — funnel-stage + channel-stage + customer-segment
  + product.** Read **funnel-stage** for which stage owns each
  content shape, **channel-stage** for where the audience meets
  the asset, **customer-segment** for whose questions the asset
  answers, and **product** for the proofs the asset can actually
  back. See
  [`context-spine`](../../../docs/contracts/context-spine.md).

## Procedure

### Step 0: Inherit the funnel diagnosis

Identify the leaking stage from
[`funnel-analysis`](../funnel-analysis/SKILL.md) and the cadence
classification from [`editorial-calendar`](../editorial-calendar/SKILL.md).
The content funnel design is a *response* to a diagnosed leak —
without the diagnosis, content investment is uniform and the
constraint stays where it is.

### Step 1: Analyze the inherited shapes

Review existing assets stage-by-stage. For each, identify *shape*
(awareness explainer, comparison, deep-dive, demo, case study,
calculator, onboarding walkthrough) and *whose question* it
answers. The output is a stage × shape grid with current investment
weight. Most teams discover their grid is bottom-heavy or
middle-empty.

### Step 2: Place the leverage-point bet

The leverage point is the **structural** stage, not the leaking
one. (The leaking stage is the *symptom*; the leverage point is
where the design choice ripples.) Often: mid-funnel proof is the
leverage point when the leak is decision-stage, because mid-funnel
proof loads the decision-stage call with conviction. Name the
leverage point explicitly; document why it is structural, not
parameter.

### Step 3: Map shape per funnel stage

For each funnel stage in the spine slot, lock the load-bearing
content shape:

- *Top — awareness:* one explainer per segment-question that earned
  pull last quarter (Pareto cut from `editorial-calendar`).
- *Mid — consideration:* one comparison or deep-dive per
  load-bearing proof from the message stack.
- *Bottom — decision:* one calculator, demo, or reference quote per
  audience-matrix cell that signals economic-buyer fear.
- *Activation:* one onboarding walkthrough keyed to the first
  switch-event the customer faces.

### Step 4: Design the conversion pathway

A pathway is **two assets in sequence** that an audience plausibly
walks. For each pathway, name the *first-asset → second-asset*
edge and the question the second answers that the first surfaced.
Pathways without a credible edge are wishful inventory, not a
funnel.

### Step 5: Validate against constraint and leverage

Validate the design on three checks:

1. **Constraint coverage.** Verify the leaking stage from
   `funnel-analysis` has a shape designed for it — not just *more*
   content, but the shape the audience asks for at that stage.
2. **Leverage-point investment.** Verify the heaviest authoring
   investment lands at the leverage point, not at the leak.
3. **Pathway plausibility.** Walk three of the designed pathways
   end-to-end with the audience-matrix lens. Verify each second
   asset earns the click; if it requires a buyer leap, the pathway
   is fiction.

### Step 6: Hand back

Hand the artefacts to [`editorial-calendar`](../editorial-calendar/SKILL.md)
for cadence assignment, to [`funnel-analysis`](../funnel-analysis/SKILL.md)
for a re-diagnosis four weeks after launch, and to
[`activation-design`](../activation-design/SKILL.md) for the
activation-stage handoff.

## Related Skills

**WHEN to use this**

- The unit of work is the funnel-stage × content-shape grid, not a single asset.
- A diagnosed funnel leak needs a content shape, not more authoring volume.
- The team is investing uniformly across stages instead of at the leverage point.

**WHEN NOT to use this**

- Planning publishing cadence and content-debt management — route to [`editorial-calendar`](../editorial-calendar/SKILL.md).
- Quantitative funnel-stage diagnostics and leak detection — route to [`funnel-analysis`](../funnel-analysis/SKILL.md).
- Activation-event selection inside the product — route to [`activation-design`](../activation-design/SKILL.md).
- Drafting the asset copy itself — out of scope; downstream of this skill.

## When the agent should load this

- "Mid-funnel leaks — design the content funnel to fix it."
- "Map our content shapes to the funnel stages for the new ICP."
- "Was ist unser Leverage-Point in der Content-Funnel?"
- "Build conversion pathways from top-of-funnel to decision."
- "Why is content investment uniform across stages?"

## Output

1. **`stage-shape-grid.md`** — stage × shape matrix, current investment vs. designed investment, leverage-point cell marked.
2. **`conversion-pathways.md`** — one row per pathway: first-asset → second-asset edge, question the second asset earns, audience-matrix cell it serves.
3. **`leverage-point-rationale.md`** — named leverage stage, *why structural, not parameter* argument, and the leading-indicator threshold the design will be re-checked against.

## Gotcha

- The leaking stage is rarely the leverage stage; treating them as identical concentrates content where it does not move the constraint.
- "More mid-funnel content" is not a design — it is volume. The shape and the question both have to land.
- Pathways are usually fictional on the first draft because the second asset assumes a buyer leap. Walk them.

## Do NOT

- Do NOT prescribe channel-specific tactics (subject lines, ad placements, video specs) — channel ownership is downstream and out of scope.
- Do NOT design uniformly across stages; uniform design encodes uniform leverage, which is leverage-blindness.
- Do NOT skip Step 0 — content funnel without a funnel diagnosis is content-as-impulse with extra steps.

## Runnable example

Mid-market HR analytics, funnel-analysis diagnosed mid-funnel leak (decision-stage conversion is fine, but mid-funnel disqualifies before reaching it):

- Stage-shape grid — top: 2 awareness explainers (current); mid: 0 comparison deep-dives (gap); bottom: 3 ROI calculators (over-invested).
- Leverage point — *mid-funnel proof*, because the decision-stage call is starved of conviction; structural ripple.
- Pathway — *"How HR directors lose 7 hours per board-quarter"* (top) → *"Cohort-retention deep-dive vs. spreadsheet rebuild"* (mid) → *ROI calculator* (decision).
- Hand-off → `editorial-calendar` re-allocates campaign weight to mid-funnel; `funnel-analysis` re-diagnoses at week 4.
