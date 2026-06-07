---
model_tier: inherit
name: positioning-strategy
description: "Use when locking the market frame — category, segment, alternative, point-of-view — before messaging, launch, or pricing rides on it. Triggers on 'who are we for', 'opposable audit'."
status: active
tier: senior
domain: product
context_spine: [product, customer-segment]
workspaces:
  - gtm
packs:
  - gtm-marketing
trust:
  level: professional
install:
  removable: true
---

# positioning-strategy

## When to use

- A category sentence is missing or contested and the next artefact (messaging, launch, pricing page) is about to inherit the ambiguity.
- The team can name what the product **does** but cannot name **who it is for**, **against what alternative**, or **what it refuses to be**.
- An opposable-positioning audit is needed: every claim has to survive *"a reasonable competitor would argue the opposite"*.

Do NOT use for peer-versus-peer feature comparison (route to
`competitive-positioning`), copy generation (route to
`messaging-architecture`), or pricing-tier construction.

## Cognition cluster

- **Mental model 1 — First-principles thinking.** Strip the category to
  the underlying job: who fires what, to make what progress, under
  what pressure. Inherited category labels are the trap; the unit of
  positioning is the job, not the label. See
  [`docs/contracts/mental-models.md`](../../../docs/contracts/mental-models.md) § 1.
- **Mental model 30 — Inversion.** For every positioning claim, ask
  *"what would a competitor with a credible alternative argue against
  this?"* A claim that has no opposable counter is either trivially
  true or invented — drop it. See `mental-models.md` § 30.
- **Context-spine — product + customer-segment.** Read the **product**
  slot for non-goals and the **customer-segment** slot for the ICP
  shape before locking the frame. Positioning that contradicts either
  slot fails its own audit. See
  [`context-spine`](../../../docs/contracts/context-spine.md).

## Procedure

### Step 0: Frame the job

Write one sentence: *"\<Segment\> hires \<category\> to make progress
in \<situation\>, when motivated by \<pressure\>, expecting
\<outcome\>."* If you cannot finish the sentence, route to
[`customer-research`](../customer-research/SKILL.md); positioning
without job-evidence is invention, not earning.

### Step 1: Lock the four anchors

Each anchor is one sentence; ambiguity here propagates.

1. **Category.** *"We are a \<category\>."* The category must be a
   noun that the segment already uses to describe the budget line
   the purchase comes out of — not a coined term.
2. **Segment.** *"For \<segment\>."* Specific enough that a single
   buyer recognises themselves; broad enough that the segment has
   shared switch-events.
3. **Alternative.** *"Instead of \<alternative\>."* Name the
   single most-likely incumbent — usually a manual workflow, a
   spreadsheet, or a competing product. *"Doing nothing"* counts.
4. **Point of view.** *"Because \<load-bearing belief\>."* The
   belief must be opposable — a credible peer holds the opposite.

### Step 2: Validate via the opposable audit

For every anchor, write the **strongest counter** a credible peer
would make. Validate each anchor against the rule *"a credible peer
holds the opposite"* — if no counter exists, the anchor is
unfalsifiable (either trivially true or invented) and must be
replaced before continuing.

The four counters become the **assumption ledger**: explicit beliefs
the positioning rides on. Each gets a re-evaluation trigger (event +
metric + threshold) the team will watch for.

### Step 3: Identify non-goals

Write three sentences in the form *"We are not for \<adjacent
segment\>, even though \<surface similarity\>, because \<reason
grounded in the product slot\>."* Non-goals are how positioning
earns its category — without them every prospect looks like a fit
and the segment dissolves.

### Step 4: Stress-test the frame

For each anchor, walk the chain *"if this is true, then…"* through
two consequences. If a consequence contradicts the product slot,
the segment slot, or a shipped commitment, the anchor is wrong —
fix the anchor, not the consequence.

### Step 5: Hand back

Hand the four anchors + assumption ledger + non-goals to
[`messaging-architecture`](../messaging-architecture/SKILL.md) for
primary-message construction. Do **not** write copy inside this
skill — that is `messaging-architecture`'s job.

## Related Skills

**WHEN to use this**

- The unit of work is the four-anchor frame, not a copy block.
- A category sentence is contested and the next artefact rides on it.
- An opposable audit is overdue and the team is shipping claims on faith.

**WHEN NOT to use this**

- Peer-vs-peer ours-vs-theirs verdict table — route to
  [`competitive-positioning`](../competitive-positioning/SKILL.md).
- Primary message + supporting proofs construction — route to
  [`messaging-architecture`](../messaging-architecture/SKILL.md).
- Fundraising "why now / why us" framing under capital constraint —
  route to [`fundraising-narrative`](../fundraising-narrative/SKILL.md).
- Pricing-tier construction or unit-economics modelling — route to
  [`unit-economics-modeling`](../unit-economics-modeling/SKILL.md).

## When the agent should load this

- "Wer sind wir eigentlich für?"
- "Lock the positioning before we write the launch deck."
- "Brauche eine Category-Sentence für die Pricing-Page."
- "Run an opposable-positioning audit on the homepage frame."
- "Welche Alternative ranken wir uns gegen — Doing Nothing oder ein konkreter Wettbewerber?"

## Output

1. **`positioning.md`** — the four anchors (category · segment ·
   alternative · point-of-view), one sentence each, opposable.
2. **`assumption-ledger.md`** — one row per anchor: the strongest
   peer-counter, the load-bearing belief, the re-evaluation trigger
   (event + metric + threshold).
3. **`non-goals.md`** — three sentences naming adjacent segments the
   product refuses to serve, each grounded in the product slot.

## Gotcha

- A category sentence the segment does not already use is a coined
  term, not a category — the segment will route around it.
- *"Doing nothing"* is the most common alternative and the most
  often skipped. If the buyer's status quo is free, the alternative
  is free, and the positioning has to clear that bar.
- A positioning frame without non-goals expands until everyone is a
  prospect; that is the failure mode, not the success state.

## Do NOT

- Do NOT invent a category to differentiate — earned categories
  beat coined categories; category theatre is the council Q1
  out-of-scope.
- Do NOT collapse positioning into a tagline; the four anchors are
  the artefact, the tagline is a downstream condensation.
- Do NOT decide pricing tiers from positioning — hand off to
  pricing / unit-economics work.

## Runnable example

Mid-market HR analytics tool, contested category:

- Frame: *"\<HR leaders at 200–2000-person companies\> hire
  \<workforce-analytics\> to make progress in \<board-quarter
  retention reporting\>, when motivated by \<exec ask for cohort
  attrition\>, expecting \<one-click roll-up by tenure band\>."*
- Anchors — **category:** workforce analytics. **Segment:** HR
  leaders at 200–2000-person, growing-headcount companies.
  **Alternative:** a manually maintained spreadsheet plus the
  HRIS-vendor's basic report. **Point of view:** *retention beats
  acquisition as the lever in this segment*.
- Assumption ledger — peer counter to point of view: *"acquisition
  velocity dominates at \< 500 headcount."* Re-evaluation trigger:
  new-hire-rate > 30 % year-on-year AND retention-flat → revisit.
- Non-goals — *"We are not for enterprise (5000+); not for
  workforce-planning (capacity modelling); not for engagement-survey
  tooling."* Each grounded in the product slot's non-goals list.
- Hand-off: four anchors → `messaging-architecture` for primary
  message + audience-by-message matrix.
