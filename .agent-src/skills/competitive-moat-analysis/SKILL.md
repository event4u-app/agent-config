---
model_tier: high
name: competitive-moat-analysis
description: "Use when mapping competitors, naming defensibility, and finding white-space — moat reasoning, where-to-play, where-not-to-play. Triggers on 'who are we competing with', 'what's our moat'."
status: active
tier: senior
domain: process
context_spine: [customer-segment, product, org-stage]
recommended_for_user_types: [consultant, founder]
workspaces:
  - founder
packs:
  - founder-strategy
install:
  removable: true
---

# competitive-moat-analysis

## When to use

- A strategist needs a competitor map for a market / segment — not a feature-comparison sheet, but a *where-they-are-strong / where-we-are-strong / where-no-one-is* read.
- A board pack or fundraise narrative claims a moat; the question is *which moat*, *how durable*, and *what would erode it*.
- A market-entry decision needs white-space identification — where can we win cleanly because incumbents structurally can't follow?

Do NOT use for narrative / messaging surface (route to Wing-3 `positioning-strategy` for the outward-facing pitch; this skill produces the internal cognition that pitch rests on), per-package adoption comparisons (route to `competitive-positioning` (Wing-1 package-peer comparison)), or build-vs-buy decisions (route to `build-buy-partner` (P1)).

## Cognition cluster

- **Mental model 18 — Where to play, where not to play.** A moat is read as much from *what we refuse to do* as from what we do. Trying to win everywhere = winning nowhere. See [`mental-models.md`](../../../docs/contracts/mental-models.md) § 18.
- **Mental model 28 — Inversion.** *"What would force a customer to leave us for an incumbent?"* The inversion answer surfaces the load-bearing moat assumption. If the answer is *"nothing"*, the moat is wishful; if the answer is concrete, that's the real fragility. See `mental-models.md` § 28.
- **Mental model 21 — Second-order thinking.** Moats compound or decay; *"feature parity today"* says nothing about *"feature parity in 18 months"*. Read each moat by its compounding rate, not its current state. See `mental-models.md` § 21.
- **Context-spine — customer-segment + product + org-stage.** Read **customer-segment** for which incumbent matters in which segment (the enterprise incumbent is rarely the SMB incumbent). Read **product** for which moats are real vs roadmap. Read **org-stage** for moat realism (pre-revenue moats are claims; growth-stage moats are evidence).

## Procedure

### Step 0: Frame the competitive set honestly

Most "competitor lists" are too broad. For each candidate competitor, ask:

1. *Do they sell to our customer-segment slot, or an adjacent one?* Different segments = different competitive set.
2. *Do customers actually evaluate them against us, or are they a "we sometimes get compared" mention?* Evaluation-set ≠ market-set.
3. *Are they direct (same outcome) or indirect (different outcome, same budget line)?* Both matter; tag which.

Output: the *evaluated-against* set, the *adjacent* set, and the *indirect-budget-competitor* set — three distinct lists.

### Step 1: Map the moat dimensions

Pick 4–7 dimensions where moats actually live — not feature checklists. Canonical dimensions:

1. **Data network effect** — does data accumulated by each customer compound across all customers?
2. **Two-sided network effect** — does each new participant make the product more valuable to existing participants?
3. **Switching cost** — does integration depth, data lock-in, or workflow embeddedness raise the exit cost?
4. **Distribution lock-in** — do we own a channel competitors can't replicate (community, partner ecosystem, OEM)?
5. **Cost-structure advantage** — is our unit-economics floor structurally lower than competitors' (route to `unit-economics-modeling` (O1) for the read)?
6. **Domain capability** — proprietary algorithm, regulatory licence, certification stack, or proprietary dataset.
7. **Brand / trust** — only legitimate in regulated / high-stakes segments where trust is the gating factor.

Don't list dimensions where no one has a moat; those are commodities.

### Step 2: Score each competitor on each dimension

For each (competitor × dimension) cell:

1. **Their position** — `strong / moderate / weak / not-applicable`.
2. **Our position** — same scale.
3. **Evidence** — file, doc, customer quote, public artifact. Cells without evidence = *unknown*, not parity.

The output is a matrix. Cells without evidence are surfaced, not silently called ties.

### Step 3: Inspect the inversion — what would erode each moat we claim?

For each dimension where we score `strong`:

1. *What's the technical / business mechanism that holds it?*
2. *What competitor move would erode it in 18 months?* (new pricing model, new vertical entry, new tech wave, regulatory shift)
3. *What evidence would tell us it's eroding?* (leading signal, not lagging revenue)

A moat without a named erosion path is unfalsifiable — flag as "claimed-moat, unstressed".

### Step 4: Identify the white-space

White-space = (segment × need) cells where no one currently has a strong position. For each:

1. *Why is no one there?* (capability gap, distribution gap, no incumbent has it as a focal job, regulatory complexity)
2. *Is the gap durable or just slow-to-fill?* (durable = structural barrier; slow = first-mover gets a 12-month window then incumbents follow)
3. *Does our context-spine slot (org-stage, product, segment) let us address it?*

White-space ≠ TAM; it's where we can plant a flag and defend it.

### Step 5: Validate the moat read before emitting

Before producing the artifact, verify three things:

1. **Evidence coverage** — confirm every `strong` cell cites concrete evidence; uncited `strong` cells are demoted to *claimed* and must be re-run.
2. **Inversion mitigation** — assert that every claimed moat has a named erosion path and at least one leading signal to monitor; un-stressed moats are unfalsifiable and must be flagged.
3. **White-space ≠ wishlist** — check that each white-space cell has a named structural reason no one is there; un-named white-space is wishful and must be demoted.

All three must pass. If any fails, return to the failing step.

### Step 6: Emit the moat read

Produce the moat-and-white-space artifact. P3 feeds P2 (`market-entry-analysis`) for beachhead defensibility, P4 (`vision-articulation`) for "why us" framing, and Wing-3 `positioning-strategy` for the outward-facing narrative.

## Related Skills

**WHEN to use this**

- Internal moat reading for board, fundraise, strategy off-site.
- Beachhead defensibility check before market entry.
- White-space identification for product / segment expansion.

**WHEN NOT to use this**

- Outward-facing positioning narrative — route to Wing-3 [`positioning-strategy`](../positioning-strategy/SKILL.md); P3 produces the internal read, positioning-strategy produces the external pitch.
- Package-vs-peer adoption comparison — route to [`competitive-positioning`](../competitive-positioning/SKILL.md) (Wing-1 meta).
- Build-vs-buy on a capability gap — route to [`build-buy-partner`](../build-buy-partner/SKILL.md) (P1).
- Market-entry sequencing — route to [`market-entry-analysis`](../market-entry-analysis/SKILL.md) (P2); P2 composes this skill for beachhead defensibility.
- Vision narrative — route to [`vision-articulation`](../vision-articulation/SKILL.md) (P4); P4 composes this skill for the "why us" frame.

## When the agent should load this

- "Who are we actually competing with?"
- "What's our moat?"
- "Where's the white-space?"
- "What would force a customer to leave us?"
- "Wo gewinnen wir wirklich?"

## Output

1. **`competitive-set.md`** — evaluated-against / adjacent / indirect-budget lists, each named with one-sentence rationale.
2. **`moat-matrix.md`** — competitor × dimension grid; evidence-cited cells; unknowns surfaced.
3. **`moat-stress-test.md`** — for each claimed moat: erosion path, leading signals, falsifiability flag.
4. **`white-space-map.md`** — (segment × need) cells no one owns; durability tag; addressability check against context-spine.

## Gotcha

- "Brand" as a moat is rarely real outside regulated / high-trust segments. Be skeptical.
- "Feature parity" today is not a moat read; it's a snapshot. Read the compounding rate.
- White-space without a named structural reason no one is there = wishlist. Push back hard on un-named white-space.
- The competitive set is usually too broad. Most "competitors" don't show up in customer evaluation sets.

## Do NOT

- Do NOT treat feature lists as moat dimensions; moats live in compounding / lock-in / structural-cost dimensions.
- Do NOT call cells parity when there's no evidence — surface as unknown.
- Do NOT claim a moat without a named erosion path and leading signals.

## Runnable example

Series-B vertical SaaS in healthcare scheduling.

- Step 0 — Evaluated-against: 2 vertical incumbents + 1 horizontal scheduling tool. Adjacent: 3 general-purpose calendar SaaS (different segment). Indirect: in-house clinic-management software custom builds.
- Step 1 — Dimensions: switching cost (workflow embeddedness), domain capability (HIPAA + state-licensure handling), distribution lock-in (EHR-integration partnerships), cost-structure, data network effect.
- Step 2 — Matrix scored with evidence: we score strong on domain capability (HIPAA certs + 50-state licensure rules) and switching cost (24-month deployment investment); incumbent A strong on distribution (5 EHR integrations); horizontal tool weak across all healthcare dimensions.
- Step 3 — Erosion path for switching-cost moat: "incumbent A ships migration-tooling that cuts switch cost by 70 %." Leading signal: incumbent A hiring senior eng for "migration platform."
- Step 4 — White-space: mid-size dental specialty groups (50–200 providers); incumbents focus on hospitals (too small) or solo practitioners (margin too thin). Structural reason: regulatory complexity per state × dental-specialty workflows mean horizontal tools don't customize enough; hospital-focused incumbents won't down-segment.
- Step 5 — Validate: every strong cell evidence-cited; switching-cost moat has erosion path + leading signal; white-space has structural reason. Pass.
- Step 6 — Emit moat-and-white-space artifact; P2 composes it for the dental-specialty beachhead defensibility read.
