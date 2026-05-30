---
recommended_model: inherit
name: fundraising-narrative
description: "Use when shaping a capital-raise pitch — why-now / why-us / why-this framing, market-size reasoning, traction-story construction. Triggers on 'tighten the pitch', 'why-now is weak'."
status: active
tier: senior
domain: product
context_spine: [product, customer-segment]
recommended_for_user_types: [founder]
workspaces:
  - founder
packs:
  - founder-strategy
install:
  removable: true
---

# fundraising-narrative

## When to use

- A founder is preparing a capital-raise pitch and the why-now is borrowed from a deck template instead of earned from the segment-shift the team actually rides.
- A deck is landing as "interesting but not now" with investors and the team needs to diagnose whether the gap is *why-now*, *why-us*, or *why-this*.
- A traction story is being built from screenshots instead of from a coherent leading-indicator arc that explains why the next stage is reachable.

Do NOT use to manage the investor-CRM pipeline (out of scope), run
the data-room (out of scope), or draft the internal vision anchor
the org rallies behind (route to Wing-4 `vision-articulation` — the
external pitch under capital constraint and the internal anchor
are siblings, not the same artefact).

## Cognition cluster

- **Mental model 1 — First-principles thinking.** *Why-now* is
  the load-bearing claim and the one most often borrowed. Build
  it from the segment-shift up — what changed in the world, the
  customer, the technology — not from a deck template. See
  [`docs/contracts/mental-models.md`](../../../docs/contracts/mental-models.md) § 1.
- **Mental model 9 — Hypothesis-driven development.** A pitch is
  a falsifiable hypothesis: *if X is true, our round closes.*
  Name the X. Investors who disagree with the hypothesis are not
  rejecting taste — they are rejecting the falsifiable claim. See
  `mental-models.md` § 9.
- **Mental model 16 — Leading vs. lagging indicators.** Revenue
  is lagging; activation, retention curve, and qualified-pipeline
  velocity are leading. The traction story leads with the leading
  signals; revenue is the receipt, not the argument. See
  `mental-models.md` § 16.
- **Mental model 30 — Inversion.** Run the round-failure
  premortem before the deck locks: *which investor heard what we
  did not say.* Inversion surfaces the claim the deck assumes the
  room already shares and probably does not. See
  `mental-models.md` § 30.
- **Context-spine — product + customer-segment.** Read **product**
  for the proofs the traction story can actually back; read
  **customer-segment** for the TAM/SAM argument that survives a
  bottom-up scrutiny. See
  [`context-spine`](../../../docs/contracts/context-spine.md).

## Procedure

### Step 0: Inherit the positioning frame and vision anchor

Identify the locked positioning anchors from
[`positioning-strategy`](../positioning-strategy/SKILL.md) and the internal vision
anchor from `vision-articulation` if it exists. The fundraising
narrative is the *external pitch under capital constraint*; it
inherits the internal frame, it does not re-invent it. A pitch
that contradicts the internal anchor will fracture on the first
hire after the round closes.

### Step 1: Analyze the inherited why-now

Read the current why-now claim. Three checks: *is this a market
shift, a customer shift, or a technology shift?*  *Did the shift
happen in the last 24 months?*  *Would the segment recognise the
shift without prompting?* A why-now that fails two of three is
template-borrowed. Name what the inherited deck is leaning on.

### Step 2: Build why-now from first principles

Strip the inherited claim. Rebuild from the segment-shift up:

- **Market shift.** What changed in the buyer's environment that
  was not true 24 months ago? (Regulation, budget cycle, channel
  collapse, competitive exit.)
- **Customer shift.** What changed in how the ICP measures the
  problem? (New KPI, new buying committee, new procurement gate.)
- **Technology shift.** What is feasible now that was not? (Cost
  curve, model capability, infrastructure unlock.)

Pick the *one* shift the segment would name without prompting.
That is the why-now spine. The others are supporting context.

### Step 3: Construct why-us under capital constraint

Why-us is *unfair advantage under the next 18 months of capital*,
not credentials. Three anchors:

- **Earned access.** The audience the team can already reach that
  the next funded peer cannot.
- **Earned proof.** The reference customer or load-bearing
  retention curve the team owns now.
- **Capital fit.** What the round buys that competitors cannot buy
  in the same window. *"More engineers"* is not capital fit;
  *"distribution lead-time the round protects"* is.

### Step 4: Build the traction story from leading indicators

Order the traction story leading-first:

1. **Activation curve.** Time-to-first-value trend across cohorts.
2. **Retention curve.** Cohort retention at the load-bearing
   milestone, ideally non-trivial — not week 1.
3. **Pipeline velocity.** Qualified-pipeline movement, not raw
   pipeline volume.
4. **Revenue.** The receipt, last in the sequence — not first.

A traction story that opens on revenue assumes the room already
believes the leading signals; the deck must earn that belief.

### Step 5: Validate against the round-failure premortem

Validate the narrative on three checks:

1. **Premortem coverage.** Run *"the round did not close because…"*
   with five failure modes. Verify the deck explicitly neutralises
   the top three or accepts-with-mitigation; unnamed failure modes
   are silent rejection routes.
2. **Falsifiable hypothesis.** Confirm the pitch is the form
   *"if X, then our round closes."* A pitch that cannot be
   disagreed with is also a pitch that cannot be agreed with.
3. **Internal-external consistency.** Diff the external pitch
   against the internal vision anchor. Contradictions kill the
   first post-round hire round; name them now.

### Step 6: Hand back

Hand the artefacts to the founder for delivery, to
`messaging-architecture` for the post-round message-stack refresh
(why-now often shifts the primary message), and to
`vision-articulation` (Wing-4) for the internal-anchor diff if
contradictions surfaced.

## Related Skills

**WHEN to use this**

- The unit of work is the why-now / why-us / why-this triad under capital constraint, not a single deck slide.
- A diagnosed pitch gap needs a structured rebuild, not slide-polish.
- The traction story is being built screenshot-first; reorder it leading-first.

**WHEN NOT to use this**

- Internal vision-anchor authoring for org alignment — route to Wing-4 `vision-articulation`.
- Message-stack work post-round — route to [`messaging-architecture`](../messaging-architecture/SKILL.md).
- Positioning the category and segment — route to [`positioning-strategy`](../positioning-strategy/SKILL.md) first.
- Investor-CRM pipeline or data-room operations — out of scope.

## When the agent should load this

- "Tighten the why-now for the seed round."
- "Bau mir die Traction-Story für den Pitch."
- "Investors keep saying 'interesting but not now' — diagnose."
- "Run the round-failure premortem on the deck."
- "Why-us reads as a credentials list — rebuild under capital constraint."

## Output

1. **`why-now-spine.md`** — the one market / customer / technology shift the segment names without prompting, with the 24-month evidence trail.
2. **`why-us-anchors.md`** — earned-access · earned-proof · capital-fit, each with a load-bearing artefact citation.
3. **`traction-arc.md`** — activation → retention → pipeline-velocity → revenue, leading-first ordering with the leading-indicator threshold per step.
4. **`round-failure-premortem.md`** — five failure modes with neutraliser-or-accept verdict, internal-external consistency diff appended.

## Gotcha

- Why-now is the most-borrowed claim in pitches because it is the hardest to earn from first principles — the room can tell.
- Capital-fit collapses to *"hire more"* when the team has not thought through what the round protects from competitors; protect-language is the discipline.
- Internal-external contradictions read as charm in the room and as betrayal at the post-round all-hands.

## Do NOT

- Do NOT carry the internal vision anchor verbatim into the pitch — internal anchor is rally; external pitch is hypothesis under capital constraint.
- Do NOT lead the traction story with revenue when the leading signals are the actual argument.
- Do NOT make the why-now a template-shaped *"AI changes everything"* — the segment will know.
- Do NOT manage CRM or data-room operations from this skill; out of scope.

## Runnable example

Mid-market HR analytics tool raising Series A, positioning locked (retention beats acquisition):

- Why-now spine — *customer shift*: HR directors now own a board-quarter retention KPI (was true on 30 % of ICP boards 24 months ago, now 70 %; verified via 14 ICP board-decks reviewed).
- Why-us anchors — *earned access*: 200-strong HR-director community already engaged. *Earned proof*: cohort-retention curve at week-12 holding at 78 % across 9 design-partner cohorts. *Capital-fit*: round protects 18 months of distribution lead-time before two funded peers reach the same segment.
- Traction arc — activation (time-to-first-cohort-roll-up: 14 → 6 days across last 4 cohorts) → retention (78 % week-12 cohort) → pipeline-velocity (qualified-pipeline movement at 2.4× quarter-on-quarter) → revenue (the receipt).
- Round-failure premortem — top three failure modes neutralised in deck; one accepted-with-mitigation (we are pre-revenue at enterprise tier — mitigated by 3 named pilot LOIs).
- Hand-off → founder for delivery; `messaging-architecture` queued for post-round refresh.
