---
recommended_model: inherit
name: deal-qualification-meddic
description: "Use when qualifying or disqualifying a single deal — MEDDIC slots with evidence, inversion test, disqualification heuristic. Triggers on 'is this deal real', 'should we walk away'."
status: active
tier: senior
domain: product
context_spine: [product, customer-segment]
recommended_for_user_types: [gtm]
workspaces:
  - gtm
packs:
  - gtm-sales
trust:
  level: professional
install:
  removable: true
---

# deal-qualification-meddic

## When to use

- A single deal needs a qualification call construction or a re-qualification mid-cycle — the deal is in pipeline but the team cannot answer *"who signs, on what criterion, against what pain, by when"* in writing.
- Disqualification is overdue — a deal has slipped two stages or two quarters and the team is reluctant to walk, so resources are bleeding into a cell that should not be in pipeline.
- A rep keeps reporting *"strong champion"* but the deal stalls — qualification needs to separate champion confidence from economic-buyer reality.

Do NOT use to design pipeline stages (route to
`pipeline-strategy`), construct the forecast call (route to
`forecast-accuracy`), or build cross-deal pattern libraries (out of
scope — this skill is single-deal qualification, one cycle).

## Cognition cluster

- **Mental model 30 — Inversion.** Do not ask *"why should this deal
  close?"* — ask *"name the reason this deal will not close."* If no
  answer survives, qualification is incomplete; if the answer is
  load-bearing and the team has no countermeasure, disqualification
  is the call. See
  [`docs/contracts/mental-models.md`](../../../docs/contracts/mental-models.md) § 30.
- **Mental model 9 — Hypothesis-driven thinking.** Each MEDDIC slot
  is a hypothesis with falsification evidence. *"Mary is the
  champion"* is a claim; *"Mary briefed two peers without us in the
  room and reported back unprompted"* is evidence. Slots without
  evidence are unfilled, regardless of rep confidence. See
  `mental-models.md` § 9.
- **Mental model 13 — Occam's razor.** When MEDDIC slots conflict,
  the simpler explanation is usually right: *"the buyer does not
  feel the pain on the same timeline we do"* beats *"procurement is
  unusually slow this quarter"*. Pick the simpler explanation; it
  changes the move. See `mental-models.md` § 13.
- **Context-spine — product + customer-segment.** Read the
  **product** slot for sellable scope (a deal asking for non-goal
  scope is not qualified, it is mis-sold), and the
  **customer-segment** slot for the segment's switch-event shape —
  pain claims that do not match the segment's known switch events
  are coaching opportunities, not qualifications. See
  [`context-spine`](../../../docs/contracts/context-spine.md).

## Procedure

### Step 0: Pull the deal record

Latest call notes, last three buyer messages, named contacts and
their org roles, current stage, age in stage, and the
`stage-definitions.md` from `pipeline-strategy`. Without exit
criteria you cannot test whether the deal earned its current stage.

### Step 1: Walk the six MEDDIC slots with evidence

For each slot, write the claim **plus** the evidence (a buyer
artefact, a recording, a forwarded email, a board agenda) — not
*"rep believes"*.

1. **Metrics.** *"\<Buyer\> will measure \<our value\> as
   \<quantified metric\> over \<window\>."* Evidence: buyer wrote
   the metric or quoted it back unprompted.
2. **Economic buyer.** *"\<Name, title\> signs the PO."* Evidence:
   buyer-side org chart confirmed; the EB has met the team or
   approved the project unblocked by the champion.
3. **Decision criteria.** *"\<Buyer\> chooses on \<criteria\>, in
   that order."* Evidence: criteria from the buyer's RFP, scorecard,
   or written summary — not the rep's inference.
4. **Decision process.** *"\<Steps and approvers\>, ending
   \<date\>."* Evidence: a written timeline shared by the buyer.
5. **Identify pain.** *"\<Pain\> costs \<\$\>/month;
   business event \<X\> forces resolution by \<date\>."* Evidence:
   buyer named the cost and the forcing event without prompting.
6. **Champion.** *"\<Name\> sells internally without us in the
   room; benefits if we win."* Evidence: champion forwarded an
   internal email, briefed peers, or named the personal win.

### Step 2: Inversion — name the reason this deal will not close

Write the one sentence that, if true, kills the deal. If no
sentence is true, the deal is qualified for its stage. If a sentence
is true and there is no countermeasure planned, the deal moves to
**disqualified-pending-evidence**.

### Step 3: Run the disqualification heuristic

Disqualify if any two of:

1. Economic buyer is unnamed or never met the team after two cycles.
2. No metric in writing after a discovery call and a follow-up.
3. No forcing event — pain exists but resolution is *"someday"*.
4. Champion cannot articulate the personal win when asked directly.

Disqualification is not failure; it is recovered selling time.

### Step 4: Set re-qualification triggers

For slots still open, set the trigger and deadline: *"\<slot\>
re-qualified when \<buyer artefact\> arrives by \<date\>."* If the
date passes without the artefact, the slot reverts to unfilled and
Step 3 runs again.

### Step 5: Hand back

Hand the MEDDIC card, the inversion sentence, and the re-qualification
triggers to the rep for the next buyer interaction and to
[`forecast-accuracy`](../forecast-accuracy/SKILL.md) for the
forecast call. A deal with two or more unfilled MEDDIC slots cannot
be **commit**, regardless of $ value or stage.

## Related Skills

**WHEN to use this**

- Qualifying or disqualifying a single deal one cycle at a time.
- Building the MEDDIC card with falsifiable evidence per slot.

**WHEN NOT to use this**

- Designing or auditing pipeline stages — route to
  [`pipeline-strategy`](../pipeline-strategy/SKILL.md).
- Constructing the quarterly forecast call — route to
  [`forecast-accuracy`](../forecast-accuracy/SKILL.md).
- Diagnosing product-led signup → activation funnels — route to
  [`funnel-analysis`](../funnel-analysis/SKILL.md).

## When the agent should load this

- "Qualify this deal — is it real?"
- "Should we walk away from \<deal\>?"
- "Why is this stuck in proposal for 60 days?"
- "Was wissen wir wirklich über den Decision Process?"

## Output

1. **`meddic-card.md`** — six slots, one claim per slot with evidence link or quote. Unfilled slots flagged.
2. **`inversion-sentence.md`** — the one reason this deal will not close; countermeasure (or *"none — disqualify"*).
3. **`requalification-triggers.md`** — per-slot trigger + deadline + revert behaviour.

## Gotcha

- *"Strong champion"* without the personal-win sentence in writing is rep optimism, not qualification.
- A metric the rep wrote on the buyer's behalf is a metric the buyer will not defend in procurement — it must come from the buyer or be quoted back unprompted.
- Decision process *"once legal signs off"* is not a process; it is a hand-wave. Demand approvers, sequence, and dates.

## Do NOT

- Do NOT call a slot filled because *"the rep is sure"* — qualification is artefact-driven, not confidence-driven.
- Do NOT keep a deal in **commit** with two or more unfilled slots regardless of size; size flatters, slots don't.
- Do NOT skip disqualification because the deal is large — large deals with weak qualification miss louder.

## Runnable example

Mid-market deal, $ 180 k ACV, stuck at Proposal for 47 days.

- MEDDIC card — **Metrics:** *"reduce ticket-handle-time by 30 %"* (buyer wrote it, ✓). **Economic buyer:** *"VP Support — never met"* (✗). **Decision criteria:** RFP scoring (✓). **Decision process:** *"procurement after legal — no dates"* (✗). **Pain:** *"reps overloaded — no forcing event"* (✗ — forcing event missing). **Champion:** *"Team lead Mary — personal win unclear"* (partial).
- Inversion sentence — *"VP Support has not seen the value case and there is no forcing event; quarter rolls and the deal slides one more cycle."* Countermeasure: book VP-Support exec session within 10 days OR disqualify.
- Disqualification heuristic — three slots unfilled → **disqualified-pending-evidence**; reverts to qualified only if exec session happens by deadline.
- Hand-off — card + inversion + triggers → rep for VP-Support outreach; `forecast-accuracy` moves the deal out of **commit** until the slots fill.
