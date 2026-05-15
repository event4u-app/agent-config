---
name: editorial-calendar
description: "Use when shaping cadence — evergreen / campaign / reactive split, beat-mapping across channel stages, content-debt management. Triggers on 'plan our content cadence', 'what should we publish'."
status: active
tier: senior
source: package
domain: product
context_spine: [product, customer-segment, channel-stage, funnel-stage]
recommended_for_user_types: [creator]


---

# editorial-calendar

## When to use

- A content programme is producing assets in bursts (campaign-shaped only) and the cadence is brittle the quarter the campaign rests.
- The team owes more drafts than it can ship and the backlog is functioning as content-debt rather than queue — surface and prioritise.
- A new audience-by-message matrix exists and the team needs to translate it into a repeating cadence with beat-mapping across channel stages.

Do NOT use to draft the asset itself (downstream), pick channel-
specific tactics like ad creative or email subject lines (out of
scope — channel-agnostic skill), or sequence a one-off launch wave
(route to `gtm-launch`).

## Cognition cluster

- **Mental model 3 — Pareto principle (80/20).** Roughly 20 % of
  the editorial beats produce 80 % of the audience pull. The
  calendar is the discipline of doubling down on the 20 % and
  letting the 80 % be reactive, not core. See
  [`docs/contracts/mental-models.md`](../../../docs/contracts/mental-models.md) § 3.
- **Mental model 18 — Pull vs. push systems.** Evergreen content is
  a *pull* system (the audience finds it); campaigns are a *push*
  system (we time the arrival). The calendar separates the two so
  campaign collapse does not collapse pull. See `mental-models.md`
  § 18.
- **Context-spine — product + customer-segment + channel-stage +
  funnel-stage.** Read **product** for what is shippable as proof,
  **customer-segment** for who reads which beat, **channel-stage**
  for where the audience is in the awareness arc, and
  **funnel-stage** for whether a beat is top-of-funnel reach or
  mid-funnel proof. See
  [`context-spine`](../../../docs/contracts/context-spine.md).

## Procedure

### Step 0: Inherit the message stack and audience matrix

Identify the locked `primary-message.md`, `supporting-proofs.md`,
and `audience-matrix.md` from
[`messaging-architecture`](../messaging-architecture/SKILL.md). The
editorial calendar is a cadence translation of the matrix; without
the matrix it is content-as-impulse, not content-as-system.

### Step 1: Analyze the inherited cadence

Review existing surfaces: what has the team published in the last
two quarters, what is its evergreen pull (organic traffic over
time), and what was campaign-only (a single spike and decay). The
output is two lists: *load-bearing evergreen* and *campaign
artefacts that have already paid back*. Everything else is content
debt — name it explicitly.

### Step 2: Classify each beat — evergreen · campaign · reactive

Three buckets, never collapsed:

- **Evergreen.** Beats that map to a load-bearing proof and a
  durable audience question. Authored once, refreshed quarterly.
  Pull system.
- **Campaign.** Beats keyed to a wave (launch, event, season).
  Authored to a date. Push system. Decommissioned by name when the
  wave closes.
- **Reactive.** Beats keyed to a market or competitor event. No
  pre-allocated slot; the calendar reserves *capacity*, not a
  topic.

### Step 3: Beat-map across channel-stage × funnel-stage

For each audience in the matrix, plot **one** evergreen beat per
*(channel-stage, funnel-stage)* cell that the audience actually
lives in. Empty cells are explicit gaps; they do not auto-fill.
Beats per cell beyond one are content noise, not coverage.

### Step 4: Validate against the Pareto cut and the pull-vs-push line

Validate the calendar on three checks:

1. **Pareto cut.** Identify the 20 % of beats that, if dropped,
   would visibly shrink audience pull. Verify exactly that 20 % has
   the highest authoring investment. If high investment is going
   into the 80 %, the calendar is upside-down — rebalance.
2. **Pull-vs-push separation.** Confirm campaign collapse does not
   collapse evergreen — evergreen surfaces are not on the campaign
   author's critical path.
3. **Reactive capacity.** Confirm reactive slots reserve hours, not
   topics. A reactive slot with a pre-decided topic is a campaign
   in disguise.

### Step 5: Manage content debt explicitly

Inventory the debt list from Step 1. For each item: *repay*
(refresh and republish), *archive* (remove from indexed surfaces),
or *retire* (delete). Untouched debt compounds — it is not free to
leave on the shelf.

### Step 6: Hand back

Hand the artefacts to [`content-funnel-design`](../content-funnel-design/SKILL.md)
for funnel-stage-to-shape mapping, and to
[`release-comms`](../release-comms/SKILL.md) when campaign waves
land near a launch wave from
[`gtm-launch`](../gtm-launch/SKILL.md).

## Related Skills

**WHEN to use this**

- The unit of work is the *cadence* (which beats repeat at which frequency on which surface), not a single asset.
- A team is over-investing in campaigns and under-investing in evergreen pull.
- A content-debt list is silently growing and needs explicit repay / archive / retire decisions.

**WHEN NOT to use this**

- Mapping each funnel stage to a content **shape** (deep-dive, comparison, demo) — route to [`content-funnel-design`](../content-funnel-design/SKILL.md).
- Drafting voice attributes or tone-by-context matrix — route to [`voice-and-tone-design`](../voice-and-tone-design/SKILL.md).
- Sequencing a launch wave with gates and beats — route to [`gtm-launch`](../gtm-launch/SKILL.md).
- Authoring the asset copy — out of scope here (downstream).

## When the agent should load this

- "Build us an editorial calendar for the next two quarters."
- "Wir produzieren zu viele Kampagnen-Artefakte — wo ist die Evergreen-Linie?"
- "Beat-map the cadence against the audience matrix."
- "What is our content-debt list and what do we repay first?"
- "Reactive capacity is full of pre-planned topics — fix the calendar."

## Output

1. **`cadence-classification.md`** — every active beat tagged evergreen · campaign · reactive · debt, with the Pareto-cut ranking inside the evergreen bucket.
2. **`beat-map.md`** — audience × channel-stage × funnel-stage grid with one evergreen beat per occupied cell, empty cells explicitly named as gaps.
3. **`content-debt-ledger.md`** — every debt item with a *repay*, *archive*, or *retire* decision and the date it lapses.

## Gotcha

- "We are evergreen-first" is the most common self-description and almost never true on the calendar — verify by authoring investment, not intent.
- Reactive capacity that is full of pre-planned topics is campaign capacity wearing reactive clothing; the calendar will betray that mid-quarter.
- Content debt with no archive / retire date is a roadmap pretending to be a queue. Refuse the open-ended *"we will get to it"* row.

## Do NOT

- Do NOT draft channel-specific tactics (subject lines, ad creative, video specs) — the calendar is channel-agnostic; tactics live with the channel owner.
- Do NOT collapse campaign and evergreen on the same critical path — campaign delay should not stall evergreen publish.
- Do NOT inflate beats past one per matrix cell; the cadence will not survive a quarter of vacation.

## Runnable example

Mid-market HR analytics tool, audience matrix locked (HR director · CFO · IT-security):

- Cadence classification — evergreen (4 beats, Pareto-cut top 2 carry pull); campaign (2 beats keyed to board-quarter launch wave); reactive (8 hours per fortnight reserved); debt (11 items: 5 repay, 4 archive, 2 retire).
- Beat-map — HR director (mid-funnel proof): one cohort-retention deep-dive per quarter. CFO (decision-funnel proof): one ROI calculator refresh per board-quarter. IT-security (top-funnel awareness): one HRIS-integration architecture explainer evergreen.
- Hand-off → `content-funnel-design` translates each beat into its content shape; `release-comms` co-schedules board-quarter campaign with launch waves.
