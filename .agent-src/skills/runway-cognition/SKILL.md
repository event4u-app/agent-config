---
name: runway-cognition
description: "Use when reasoning about cash runway — burn shape, fundraise triggers, layoff-vs-cut-vs-grow decisions. Triggers on 'how long do we have', 'should we raise', 'cut or grow'."
status: active
tier: senior
source: package
domain: process
context_spine: [org-stage, fiscal-period, product]
---

# runway-cognition

## When to use

- A finance-partner or founder needs to read the cash runway as a **shape** (not a single number) and decide whether to raise, cut, or grow.
- Burn has shifted in a way the prior plan didn't anticipate; the question is whether the shift is structural (revise plan) or transient (hold).
- A fundraise window is opening or closing; the question is whether to start the process now, in one quarter, or hold and grow.
- A board / leadership debate has split between *cut to extend runway* and *invest to accelerate*; the framing — not the verdict — is what's missing.

Do NOT use for per-customer economics (route to `unit-economics-modeling` (O1)), forecast-call construction (route to `forecasting` (O2)), or multi-statement scenario construction (route to `scenario-modeling` (O4)).

## Cognition cluster

- **Mental model 21 — Second-order thinking.** *"If we cut here, then ___, and then ___."* Runway decisions are second-order by construction: the first-order effect (extended runway) is trivial; the second-order effect (slower growth → next-round terms → dilution) is the real decision. See [`mental-models.md`](../../../docs/contracts/mental-models.md) § 21.
- **Mental model 28 — Inversion.** *"What would force a down-round?"* Invert the fundraise question: instead of *"can we raise?"* ask *"what evidence would the market need to fund us at this valuation?"* and work backwards. See `mental-models.md` § 28.
- **Mental model 16 — Leading vs lagging indicators.** Cash balance is lagging; **net burn trend over the last 3 fiscal-periods** + **pipeline coverage of next-window revenue** are leading. A runway model that reads only cash balance is reading yesterday's weather. See `mental-models.md` § 16.
- **Context-spine — org-stage + fiscal-period + product.** Read the **org-stage** slot for what bands apply (pre-seed / seed / Series A / Series B+ / growth / public — each has a different "healthy runway" band; do not hardcode 18 months). Read **fiscal-period** for the cadence the runway model rolls forward against. Read **product** for what's GA-shippable in the window — pre-revenue product changes the cognition shape (extend until traction) vs post-revenue (extend until next milestone). See [`context-spine`](../../../docs/contracts/context-spine.md).

## Procedure

### Step 0: Establish the org-stage band

Read the `org-stage` slot. The band selection is the load-bearing
choice — *not the agent's*. The slot answers it. Use these shapes:

- **Pre-seed / seed** → the band is "next milestone + buffer", not a fixed month count. Milestone = the evidence the next round will fund.
- **Series A** → the band is "to product-market-fit signal + buffer". Buffer ≥ one fundraise cycle (typically 6–9 months in the org's segment).
- **Series B+ / growth** → the band is "to next funding milestone with metric-driven evidence" (NRR, gross margin, growth rate). Buffer = one quarterly cycle.
- **Public / cash-flow positive** → runway converges to "operating cash + facility headroom"; the cognition shifts to working-capital reasoning.

If the slot is missing or contested, STOP and ask once. Do not infer from prose.

### Step 1: Compute the burn shape, not the number

1. Net burn = net cash out over the last 3 fiscal-periods. Use 3 windows, not 1 — single-window burn is noise.
2. **Burn trend**: flat / accelerating / decelerating. Compute the slope. Accelerating burn is the leading indicator; flat burn at a high number is the lagging confirmation.
3. **Burn-multiple** (cross-cite O1 `unit-economics-modeling` Step 5): net burn / net new ARR over the same windows. Read direction across the 3 windows, not the point estimate.

Output is a shape: *"net burn $X/mo, decelerating over last 3 quarters; burn-multiple 2.4 → 1.8 → 1.3."*

### Step 2: Inspect runway against the band

1. Compute months-of-runway = cash / current-burn at three burn assumptions: status-quo, +20% (overspend scenario), −20% (cuts taken).
2. Compare each to the **band-appropriate target** from Step 0. Do not compare to a fixed "18 months" — that's a Series-A heuristic that mis-fires at every other stage.
3. Verdict shape: *"at status-quo burn, we have X months vs the Y-month band; gap is Z months."* Gap, not absolute number.

### Step 3: Decide on the fundraise question (or refuse to)

Three honest answers; pick one:

1. **Raise now** — gap is closing into the band's lower bound, and at least one fundraise-trigger condition fires (revenue milestone hit, segment proof point demonstrable, founder bandwidth available). Cross-cite Wing-3 `fundraising-narrative` (H7) for external-pitch shape.
2. **Hold and grow** — gap is comfortably inside the band AND the leading indicators (Step 1 burn-multiple direction + pipeline coverage of next-window revenue) are improving. Do not raise into a comfortable runway; the dilution math doesn't justify it.
3. **Refuse to answer** — the gap is in the band's noise but no leading indicator has direction. The honest answer is *"I'm not ready to call this; tell me what to measure for two windows."*

A *cut* (Step 4) is not an answer to the fundraise question; it's a separate decision.

### Step 4: Decide on layoff-vs-cut-vs-grow

1. **Grow** — leading indicators improving + band has headroom. The cut math is dilutive (every $ cut here is a $ of capacity not built).
2. **Cut non-headcount** — leading indicators flat + band tightening. Tooling / contractors / venues / paid-marketing / unused real-estate first.
3. **Cut headcount** — band tightening into the lower bound AND leading indicators flat-or-worsening for ≥ 2 windows. Smallest cut that moves the band by ≥ 1 buffer-cycle is the right cut. *"Across-the-board 10 %"* is the failure mode — it cuts what's already efficient at the same rate as what's not.

The premortem (mental-model 29): *"if we lay off and the leading indicators don't improve, what did we just lose?"* If the answer is "the people who would have moved the indicators", the cut is wrong.

### Step 5: Emit the runway frame

Produce `runway-frame.md` — the typed artifact `scenario-modeling` (O4) reads as its runway input. Per `docs/guidelines/wing4-handoff.md` § Chain 1 / Chain 3.

## Related Skills

**WHEN to use this**

- The question is cash-runway shape, fundraise-timing, or cut-vs-grow.
- The decision is whether to raise, hold, or cut — at this org-stage.

**WHEN NOT to use this**

- Per-customer economics (CAC / LTV / payback) — route to [`unit-economics-modeling`](../unit-economics-modeling/SKILL.md) (O1).
- Forecast-call construction (top-down vs bottom-up) — route to [`forecasting`](../forecasting/SKILL.md) (O2).
- Three-statement scenario construction — route to [`scenario-modeling`](../scenario-modeling/SKILL.md) (O4).
- External fundraise narrative — route to Wing-3 [`fundraising-narrative`](../fundraising-narrative/SKILL.md) (H7); cite for pitch shape.
- People decisions (layoff process, communication, severance) — route to Wing-4 [`org-design`](../org-design/SKILL.md) (Q1) for shape; people-strategist owns process.

Wing-4 handoff: this skill reads `forecast-band.json` from O2 and
`unit-economics-frame.md` from O1; emits `runway-frame.md` consumed
by O4. Per `docs/guidelines/wing4-handoff.md` § Chain 1.

## When the agent should load this

- "How long is our runway?"
- "Should we raise now or hold?"
- "Do we need to cut, and if so what?"
- "Wie lange reicht das Geld noch?"
- "Sind wir noch im sicheren Band für die Stage?"

## Output

1. **`runway-frame.md`** *(Wing-4 handoff)* — org-stage, fiscal-period, current cash, net-burn trend (flat / accel / decel), burn-multiple direction, months-of-runway at 3 burn assumptions, band-appropriate target, gap, fundraise verdict (raise / hold / refuse), cut-vs-grow verdict.
2. **`burn-shape.md`** — last 3 fiscal-periods net burn + burn-multiple, with trend annotation.
3. **`fundraise-decision.md`** — which of the three verdicts (raise / hold / refuse), leading indicators read, premortem if "raise".
4. **`cut-or-grow.md`** *(only if cut verdict)* — non-headcount cuts first, headcount-cut shape if required, premortem on each cut.

## Gotcha

- "18 months runway" is a Series-A heuristic; applying it to seed (where milestone matters more than month count) or growth (where metric milestones matter more) silently mis-frames the decision.
- Single-window net burn is noise. Always 3 windows.
- Burn-multiple direction matters more than the point estimate. A 3.0 going to 2.0 is healthier than a 1.8 going to 2.4.
- Raising into a comfortable runway is dilutive theatre — *"we have 18 months so we should raise now"* doesn't survive a second-order check.
- *Across-the-board* cuts cut efficient teams at the same rate as inefficient ones. The smallest targeted cut that moves the band wins.

## Do NOT

- Do NOT compare months-of-runway against a fixed number; always against the band-appropriate target from Step 0.
- Do NOT answer the fundraise question without checking leading indicators (Step 1 + pipeline coverage).
- Do NOT collapse cut-vs-grow into a single "extend runway" verdict — they're separate decisions with separate evidence.

## Runnable example

Series-A SaaS, $4.2M cash, fiscal-period quarterly.

- Step 0 — `org-stage = series-a`. Band: "to PMF signal + buffer 6–9 months". Target = NRR > 110 % + segment proof + 9-month cycle ≈ 12–15 months.
- Step 1 — net burn last 3 quarters: $480k / $510k / $560k → accelerating. Burn-multiple: 2.1 → 1.9 → 1.7 → improving despite accel-burn (revenue catching up).
- Step 2 — at status-quo $560k/mo: 7.5 months runway. Target band 12–15 months. Gap = 4.5–7.5 months below band.
- Step 3 — verdict = **raise now**. Gap closes into lower-bound; segment-proof demonstrable; burn-multiple direction is the credible story. Cross-cite H7 for pitch.
- Step 4 — grow (don't cut). Cutting now would kill the burn-multiple-improvement story; the cut math is dilutive vs the raise.
- Step 5 — emit `runway-frame.md`: `org-stage=series-a, gap=-5mo, fundraise=raise, cut-or-grow=grow, premortem="if raise fails by Q3, structural cut to non-headcount + extend by 4 months"`.
