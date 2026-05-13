---
name: market-entry-analysis
description: "Use when sequencing market entry — geo / segment / vertical, beachhead selection, regulatory-delta. Triggers on 'should we enter market X', 'which segment first'."
status: active
tier: senior
source: package
domain: process
context_spine: [customer-segment, regulatory-regime, product]
---

# market-entry-analysis

## When to use

- A new market is on the table — geographic (EU, US, APAC), segment (SMB → mid-market → enterprise), or vertical (healthcare, fintech, manufacturing) — and the question is whether to enter, where to start, and in what sequence.
- A current market is saturating and the question is which adjacent market unlocks the next growth window.
- A regulatory shift opens or closes a market; the question is whether the new constraint changes the entry case.

Do NOT use for build-vs-buy decisions on capability gaps (route to `build-buy-partner` (P1)), positioning narrative (route to `competitive-positioning` (P3); this skill composes P3), or per-customer economics within the entered market (route to `unit-economics-modeling` (O1)).

## Cognition cluster

- **Mental model 23 — Beachhead.** Pick a single segment / geo / vertical where the constraints favour winning, then expand from a position of strength. Trying to enter "the whole market" with no beachhead is the canonical failure pattern. See [`mental-models.md`](../../../docs/contracts/mental-models.md) § 23.
- **Mental model 21 — Second-order thinking.** Entry costs (sales motion, regulatory compliance, segment-specific support) compound across markets. Reading entry as *"just open the door"* misses the second-order shape of multi-market operations. See `mental-models.md` § 21.
- **Mental model 16 — Leading vs lagging.** Revenue from new market is lagging; **segment-specific pipeline coverage** + **win rates against incumbents in target segment** are leading. Reading only lagging signals = entering markets that already won't work. See `mental-models.md` § 16.
- **Context-spine — customer-segment + regulatory-regime + product.** Read **customer-segment** for which buyer cohort the entry targets; **regulatory-regime** for the compliance delta (often the load-bearing cost in geo expansion); **product** for what's GA-shippable in the target market without re-platforming.

## Procedure

### Step 0: Frame the entry axis

Pick **one** of three axes; do not mix:

1. **Geo** — new region (US → EU, EU → APAC). Load-bearing constraint = regulatory-regime delta.
2. **Segment** — new buyer cohort (SMB → mid-market → enterprise). Load-bearing constraint = sales-motion shift.
3. **Vertical** — new industry (horizontal → healthcare). Load-bearing constraint = domain knowledge + segment-specific integrations.

Mixing axes ("enter European healthcare enterprise") = three entries simultaneously. The correct framing is to pick one axis at a time and sequence the others.

### Step 1: Select the beachhead

Within the chosen axis, score 3–5 candidate beachheads on:

1. **Constraint favourability** — does the segment / geo's constraint shape favour us? (e.g. for a self-serve product, SMB favours; enterprise penalises).
2. **Reference-customer reachability** — can we land 3–5 named reference customers in the next two windows?
3. **Regulatory delta** — compliance cost to operate (read `regulatory-regime` slot; e.g. EU + B2C + processing PII = GDPR-floor; EU + B2B + no PII = thin delta).
4. **Expansion path** — does winning this beachhead unlock the adjacent ones, or is it a dead end?

The beachhead is rarely the largest segment; it's the segment where we win cleanly and from which adjacent segments become accessible.

### Step 2: Inspect the entry cost

Three concrete cost categories — each named, not estimated:

1. **Sales motion** — does the existing motion translate? (Self-serve → enterprise requires inside-sales + AE buildout; SMB → mid-market requires AE specialisation.)
2. **Product delta** — what's missing for the target segment? (Compliance certs, SSO, audit logs, locale support, segment-specific integrations.)
3. **Operating cost** — entity setup, tax, legal, segment-specific support. Geo entries add a 3–6 month operating-readiness window.

Total entry cost = these three. Compare against `runway-frame.md` (O3) for whether the band has headroom.

### Step 3: Inversion — name the failure mode

For the chosen beachhead, write the 18-month failure mode:

1. *"We entered and the incumbent's playbook neutralised us"* — incumbent's segment-specific advantage held.
2. *"We entered and the sales motion didn't translate"* — assumed motion (self-serve) didn't work in the segment (enterprise).
3. *"We entered and the regulatory cost ate the unit economics"* — compliance delta was load-bearing and under-estimated.

If the failure mode has no mitigation, the entry is not ready. Sit with it.

### Step 4: Sequence the expansion

Beachhead = first move. Map the next 2–3 expansion moves explicitly:

1. *"Win beachhead → unlock adjacent segment X (same motion, larger TAM) → unlock adjacent geo Y (same segment, regulatory delta manageable)."*
2. *"Win beachhead → unlock co-sell with vendor Z → unlock vertical W."*

Un-sequenced beachhead wins are dead-ends. The sequence is the long-game; the beachhead is just the first move.

### Step 5: Validate the entry case before emitting

Before emitting the entry plan, verify three things:

1. **Beachhead defensibility** — confirm the chosen beachhead scores higher than the runner-up on at least two of the four Step-1 dimensions; if it ties or wins on one only, the choice is brittle and must be re-run.
2. **Entry cost vs runway band** — check that the Step-2 entry cost lands inside the `runway-frame.md` (O3) band; if it doesn't, the entry is not yet financeable and must be deferred or staged.
3. **Failure-mode mitigation** — assert that the Step-3 failure mode has a named mitigation; an un-mitigated failure mode means the analysis is incomplete.

All three must pass. If any fails, the entry plan is not ready to emit; return to the failing step.

### Step 6: Emit the entry plan

Produce the entry plan artifact. P2 composes P3 (`competitive-positioning`) for the narrative against incumbents in the target segment.

## Related Skills

**WHEN to use this**

- Sequencing market entry across geo / segment / vertical axes.
- Choosing the beachhead within a chosen entry axis.

**WHEN NOT to use this**

- Build-vs-buy capability decisions — route to [`build-buy-partner`](../build-buy-partner/SKILL.md) (P1).
- Positioning narrative against incumbents — route to [`competitive-positioning`](../competitive-positioning/SKILL.md) (P3); this skill composes P3.
- Per-customer economics in the target market — route to [`unit-economics-modeling`](../unit-economics-modeling/SKILL.md) (O1).
- Channel / funnel design for the entry — route to Wing-3 [`funnel-analysis`](../funnel-analysis/SKILL.md) and [`content-funnel-design`](../content-funnel-design/SKILL.md).

## When the agent should load this

- "Should we enter the EU market?"
- "Which segment do we go to next — mid-market or enterprise?"
- "Pick the beachhead for our vertical expansion."
- "Wo greifen wir als erstes an?"

## Output

1. **`entry-axis-frame.md`** — chosen axis (geo / segment / vertical), why this axis first, what's deferred.
2. **`beachhead-scorecard.md`** — 3–5 candidate beachheads scored on the four Step-1 dimensions; named winner with reasoning.
3. **`entry-cost-table.md`** — sales-motion delta, product delta, operating cost; compared against runway band.
4. **`expansion-sequence.md`** — beachhead + next 2–3 moves, with the unlock-mechanism named per move.

## Gotcha

- "Enter the European enterprise healthcare market" mixes three axes. Pick one.
- The largest segment is rarely the right beachhead; the segment where constraints favour us is.
- Geo regulatory delta is the most under-estimated cost. Budget the high-end of the band for compliance.
- Beachhead win without sequenced expansion = isolated revenue stream that never compounds.

## Do NOT

- Do NOT mix entry axes — sequence them.
- Do NOT pick a beachhead without a named 18-month failure mode + mitigation.
- Do NOT skip the expansion sequence — the beachhead's value is which next moves it unlocks.

## Runnable example

Horizontal SaaS, US-only, mid-market, considering EU expansion.

- Step 0 — axis = geo (EU). Defer segment (stay mid-market) and vertical (stay horizontal).
- Step 1 — candidate beachheads: DACH, Nordics, UK, Benelux. Scored: UK wins on constraint-favour (English-language sales motion translates, common-law contract familiarity), reference-reachability (5 mid-market UK customers reachable via existing channels), regulatory delta (UK-GDPR ≈ EU-GDPR floor with thinner data-residency requirement), expansion path (UK → Benelux → DACH).
- Step 2 — Sales motion: existing AE motion translates to UK. Product delta: data-residency in EU (12 weeks). Operating cost: UK Ltd entity, VAT registration ≈ 3 months.
- Step 3 — failure mode: "incumbent's UK channel partnerships locked us out of mid-market." Mitigation: direct-AE motion + content-led pipeline.
- Step 4 — sequence: UK (beachhead) → Benelux (same motion, thin regulatory delta) → DACH (German-speaking sales hire required, larger TAM).
- Step 5 — emit entry plan + compose P3 for UK-vs-incumbents positioning.
