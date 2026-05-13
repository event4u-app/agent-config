---
name: messaging-architecture
description: "Use when shaping the primary message, supporting proofs, and audience-by-message matrix from a locked positioning frame — before any copy or launch beat. Triggers on 'tighten the message stack'."
status: active
tier: senior
source: package
domain: product
context_spine: [product, customer-segment]
---

# messaging-architecture

## When to use

- Positioning is locked (four anchors + assumption ledger) and the next artefact — launch deck, homepage, sales narrative — needs a load-bearing message stack instead of one-off copy.
- A team is shipping copy faster than it is shipping shared meaning; lines diverge across surfaces and the segment cannot recognise itself.
- An audience-by-message matrix is missing and the same primary message is being shouted at three audiences who hear three different things.

Do NOT use to write the copy itself (downstream of this skill),
peer-vs-peer comparison (route to `competitive-positioning`), or
launch sequencing (route to `gtm-launch`).

## Cognition cluster

- **Mental model 15 — Signal vs. noise.** Every message lands inside
  an inbox that is already full. The primary message must clear the
  segment's noise floor, not just be true. Estimate the noise before
  drafting; without it, every line looks distinctive in the doc and
  forgettable in market. See
  [`docs/contracts/mental-models.md`](../../../docs/contracts/mental-models.md) § 15.
- **Mental model 30 — Inversion.** Ask *"what is the strongest
  message a credible alternative would land against us?"* The answer
  exposes the proofs the message stack must carry, not the words.
  See `mental-models.md` § 30.
- **Context-spine — product + customer-segment.** Read the **product**
  slot for the proofs the team can actually back; read the
  **customer-segment** slot for the buyer's listening posture.
  Architecture that exceeds the proofs available is fiction. See
  [`context-spine`](../../../docs/contracts/context-spine.md).

## Procedure

### Step 0: Inherit the positioning frame

Open the `positioning.md` artefact ([`positioning-strategy`](../positioning-strategy/SKILL.md)
Step 1 output). If the four anchors are missing or contested, stop
and route back. Messaging architecture without a locked positioning
frame is decoration — it will be rewritten the next quarter.

### Step 1: Identify the primary message

Identify the **one** sentence — the load-bearing claim
that, if the segment remembered nothing else, would still trigger
the right switch event. Structure:

*"For \<segment\>, \<category\> that \<load-bearing benefit\>,
instead of \<alternative\>."*

The benefit must be the **switch-event benefit** — what changes the
day they buy — not a feature list and not a brand attribute.

### Step 2: Stack the supporting proofs

Three proofs, ranked. Each proof is a sentence the team can defend
with evidence (data, demo, reference, contract clause). Proofs that
need adjective amplification (*"truly seamless"*, *"radically
simple"*) are not proofs — they are the gap a proof would fill.

Rank the proofs by **closing weight**: how much each moves the
buyer's decision from *no* to *yes*. The order is the order of
appearance in every downstream surface.

### Step 3: Build the audience-by-message matrix

Audiences are not segments — they are roles inside the segment
(economic buyer, champion, end-user, finance, security). For each
audience, fill: **what they fear · what they hope · what proof
clears each.** The matrix forces the team to confront the surfaces
where the primary message lands wrong on a role even when right on
the segment.

### Step 4: Validate against the noise floor and the inversion test

Validate the stack on three checks:

1. **Noise floor.** For the primary message, name three lines a
   credible peer says today. If the primary message would not be
   distinguishable when read alongside them, it is below the noise
   floor — sharpen or drop.
2. **Inversion.** Write the strongest counter-message a credible
   alternative would land against us. Confirm at least one supporting
   proof neutralises it; if none does, the stack is missing a proof.
3. **Proof-coverage.** For every fear / hope cell in the matrix,
   verify a proof exists. Cells without a proof are explicit gaps,
   not silent omissions.

### Step 5: Hand back

Hand the three artefacts (see `## Output`) to
[`gtm-launch`](../gtm-launch/SKILL.md) for launch-wave sequencing,
[`editorial-calendar`](../editorial-calendar/SKILL.md) for cadence
mapping, or [`fundraising-narrative`](../fundraising-narrative/SKILL.md)
for capital-raising framing. Do **not** write the copy here — copy
production is a downstream artefact.

## Related Skills

**WHEN to use this**

- The unit of work is the message stack (primary + proofs + matrix), not a copy block.
- Positioning is locked and downstream surfaces need a shared anchor.
- Cross-audience messaging has scattered and the team cannot name a primary.

**WHEN NOT to use this**

- Locking the four-anchor positioning frame — route to
  [`positioning-strategy`](../positioning-strategy/SKILL.md).
- Peer-vs-peer ours-vs-theirs verdict table — route to
  [`competitive-positioning`](../competitive-positioning/SKILL.md).
- Launch-wave audience sequencing — route to
  [`gtm-launch`](../gtm-launch/SKILL.md).
- Voice attribute selection or tone-by-context matrix — route to
  [`voice-and-tone-design`](../voice-and-tone-design/SKILL.md).

## When the agent should load this

- "Lock the message stack before we draft the launch deck."
- "Wir brauchen eine primary message, keine Tagline."
- "Build the audience-by-message matrix for the security buyer."
- "Are our three proofs distinguishable from \<incumbent\>'s lines?"
- "Inversion-check our messaging against the alternative."
- "Our message has scattered across landing pages — re-anchor it."

## Output

1. **`primary-message.md`** — one sentence in the segment / category
   / benefit / alternative shape, plus the load-bearing word and
   why it is load-bearing.
2. **`supporting-proofs.md`** — three proofs ranked by closing
   weight, each with the evidence the team can defend it with.
3. **`audience-matrix.md`** — one row per audience: fear · hope ·
   proof-that-clears-each · primary-message variant if reframing is
   needed.

## Gotcha

- A primary message everyone in the room agrees with on first read
  is usually below the noise floor — agreement is consensus, not
  distinctiveness.
- Proofs that need adjectives are signals of a missing proof; replace
  the adjective with the evidence or remove the line.
- The audience matrix tempts the team to multiply primary messages.
  Resist: the segment receives one primary; the matrix shapes
  emphasis, not substitution.

## Do NOT

- Do NOT write copy in this skill — copy lives downstream.
- Do NOT inflate the stack beyond three proofs; a stack of seven is
  a wishlist, not architecture.
- Do NOT skip the noise-floor check; an internally distinctive
  message is not the same as a market-distinctive one.

## Runnable example

Mid-market HR analytics tool, positioning locked (segment: HR leaders
at 200–2000-person growing companies; alternative: spreadsheet +
HRIS report; PoV: retention beats acquisition):

- Primary message: *"For HR leaders at growing 200–2000-person
  companies, the workforce-analytics layer that turns the
  board-quarter retention conversation into a one-click roll-up,
  instead of a spreadsheet rebuild every quarter."*
- Proofs ranked by closing weight: (1) cohort attrition by tenure
  band in < 5 clicks (demo); (2) plugs into the existing HRIS,
  not a replacement (architecture diagram); (3) board-quarter
  rebuild collapses from \~ 8 hours to \~ 1 hour (reference
  customer, contractually quoted).
- Audience matrix — *Champion (HR director):* fear = another tool
  to maintain; hope = looks competent to CEO; proof = HRIS
  plug-in. *Economic buyer (CFO / COO):* fear = soft ROI; hope =
  retention saving; proof = reference quote with hours saved.
- Hand-off → `gtm-launch` sequences launch waves around the
  retention-conversation moment in board-quarter cadence.
