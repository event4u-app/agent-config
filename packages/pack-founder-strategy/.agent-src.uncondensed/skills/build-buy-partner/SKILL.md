---
recommended_model: inherit
name: build-buy-partner
description: "Use when deciding insource vs outsource vs acquire — integration-cost analysis, dependency-risk, optionality preservation. Triggers on 'should we build', 'buy vs partner'."
status: active
tier: senior
domain: process
context_spine: [org-stage, product, customer-segment]
workspaces:
  - founder
packs:
  - founder-strategy
install:
  removable: true
---

# build-buy-partner

## When to use

- A capability gap exists and the question is whether to build internally, buy a vendor / acquisition, or partner.
- An "obviously build" choice has crept in by default; the question is whether it survives a deliberate compare.
- A vendor / partner relationship is up for renewal; the question is whether to keep buying, switch, or insource.
- An acquisition has been floated; the question is whether the integration cost justifies the speed-to-capability.

Do NOT use for vendor selection within a "buy" decision (different skill), market-entry beachhead choice (route to `market-entry-analysis` (P2)), or scenario-shape comparison (route to `scenario-modeling` (O4); P1 consumes O4's bundle).

## Cognition cluster

- **Mental model 28 — Inversion.** *"What would force us to undo this choice in 18 months?"* Inversion surfaces the dependency-risk and integration-cost that the forward case understates. See [`mental-models.md`](../../../docs/contracts/mental-models.md) § 28.
- **Mental model 21 — Second-order thinking.** Each option chains: build → ongoing maintenance + opportunity cost; buy → integration + lock-in; partner → dependency + boundary management. Single-order *"build is cheaper"* fails on the second-order. See `mental-models.md` § 21.
- **Mental model 26 — Optionality.** Read each option by which choices it preserves (switch costs, re-build optionality, re-negotiation power) vs forecloses. The option with bounded foreclosure usually wins. See `mental-models.md` § 26.
- **Context-spine — org-stage + product + customer-segment.** Read **org-stage** for capacity (pre-seed should buy almost everything non-core; growth-stage can build deeper). Read **product** for whether the capability is core-differentiation (build) or commodity (buy). Read **customer-segment** for whether enterprise-segment buyers require a build-it-yourself story.

## Procedure

### Step 0: Frame the capability as core vs commodity

Two questions:

1. *Is this capability a differentiator for our customers?* If yes → build-bias. If no → buy-bias.
2. *Does it sit on the critical path of our product?* If yes + differentiator → build. If yes + commodity → buy. If no → partner.

The matrix is the starting frame, not the answer. Override is allowed but requires writing the override reason.

### Step 1: Inventory the three options concretely

Do not compare abstractions. Each option = a concrete plan:

1. **Build** — named team, named timeline, named ongoing-maintenance cost. *"Squad of 3 engineers for 6 months + 1 FTE ongoing"* not *"we'd build it"*.
2. **Buy** — named vendor (or vendor shortlist), named pricing band, named integration scope. *"Vendor X at $80k ARR + 4-week integration"* not *"we'd find a vendor"*.
3. **Partner** — named partner, named scope of dependency, named exit clause. *"Partner Y owns the X interface with 90-day exit"* not *"we'd partner"*.

Un-named options compare to nothing.

### Step 1.5: Inspect the differentiator claim

Before locking the matrix from Step 0, inspect the claim that this is
or isn't a differentiator. Two questions: *"would a customer leave us
if a competitor had a better version of this capability?"* and *"is
the current build advantage replicable by a vendor with one quarter of
focused work?"* Both `yes` answers → the capability is less of a
differentiator than the frame suggested; bias back to buy.

### Step 2: Compute integration cost honestly

Integration cost is the most under-counted number. For each option:

1. **Build** — engineering time + management overhead + opportunity cost (what's the team *not* building?).
2. **Buy** — vendor integration (weeks to first value) + ongoing change-management cost + lock-in (cost to switch off).
3. **Partner** — boundary management + divergence cost (what happens when partner changes their roadmap?).

A buy decision with 2-week integration is rare; budget 4–8 weeks for non-trivial integrations and 3–6 months for enterprise-grade ones.

### Step 3: Inversion — name the failure mode for each option

For each option, write the 18-month failure mode:

1. **Build fails** — *"team built the wrong thing because requirements shifted under them"* / *"team left and knowledge walked"*.
2. **Buy fails** — *"vendor changed pricing 3×"* / *"vendor acquired and roadmap diverged"* / *"vendor sunset the product line"*.
3. **Partner fails** — *"partner's incentive misaligned"* / *"partner's customer became our competitor"*.

If one option's failure mode is *"can't think of one"*, the analysis is incomplete; sit with it longer.

### Step 4: Read optionality

For each option:

1. **Preserved options** — what future choices remain (switch vendor, re-build, deepen the build, expand the partnership).
2. **Foreclosed options** — what future choices are off the table (re-build after 2 years of vendor lock-in; re-vendor after a build commitment; competing against a former partner).

The decision is rarely about today's cost; it's about which option preserves the choices we'll need in 18 months.

### Step 5: Decide and emit the ADR

Pick one. Emit a build-buy-partner ADR via the `adr-create` skill, citing this skill's output. The ADR is the durable record; the artifacts here are the cognition that justify it.

## Related Skills

**WHEN to use this**

- Insource-vs-outsource-vs-acquire decisions on a capability gap.
- Vendor renewal / re-evaluation where re-building or switching is on the table.

**WHEN NOT to use this**

- Vendor selection within a locked buy decision — different skill (not in this roadmap).
- Market-entry beachhead choice — route to [`market-entry-analysis`](../market-entry-analysis/SKILL.md) (P2).
- Scenario shape comparison — route to [`scenario-modeling`](../scenario-modeling/SKILL.md) (O4); P1 consumes O4's `scenario-bundle.md`.
- Org-shape changes (reorg, team-split) — route to [`org-design`](../org-design/SKILL.md) (Q1); P1 composes Q1 for the "build" option's team shape.
- Decision-record authoring mechanics — route to [`adr-create`](../adr-create/SKILL.md); P1 emits an ADR via that skill.

## When the agent should load this

- "Should we build this or buy a vendor?"
- "Make-vs-buy on capability X."
- "Should we partner with Y or build in-house?"
- "Renew vendor Z or insource?"
- "Bauen wir das selber oder kaufen?"

## Output

1. **`build-buy-partner-frame.md`** — capability framing (core / commodity, critical-path / not), three concrete options named, integration-cost table per option.
2. **`failure-modes.md`** — 18-month inversion per option; named failure paths.
3. **`optionality-map.md`** — preserved / foreclosed options per choice; recommended option with reasoning.
4. **ADR** *(via `adr-create`)* — the durable decision record; this skill produces the cognition, `adr-create` produces the file.

## Gotcha

- "Build" defaults are the most common silent choice. Engineers' bias is to build; the absence of a buy / partner option in the inventory is the bug, not a feature.
- Integration cost is under-counted by 2–4× in buy decisions. Always budget the high-end of the band.
- "We'd lose strategic capability" is sometimes true and sometimes a rationalisation. Test against Step 0's differentiator question.
- Acquisitions that look cheap on price are expensive on integration. The integration cost is rarely less than the acquisition cost over 18 months.

## Do NOT

- Do NOT compare abstractions; each option must be concrete (named team / vendor / partner).
- Do NOT skip the inversion step — un-stressed options always look attractive.
- Do NOT collapse the three options into "build vs buy" — partner is a distinct option with distinct optionality.

## Runnable example

Series-A SaaS, capability gap: real-time data pipeline.

- Step 0 — differentiator (no, every SaaS has one), critical-path (yes). Matrix says buy.
- Step 1 — Build: 3 eng × 6 mo + 1 FTE ongoing ≈ $1.2M / yr. Buy: Confluent at $180k ARR + 4-week integration. Partner: customer's existing pipeline with 90-day exit — but no incentive alignment with our segment.
- Step 1.5 — would customers leave if competitor's pipeline was better? Probably not (commodity layer). Vendor-replicable in one quarter? Yes. Confirms buy-bias.
- Step 2 — Build integration: 6 mo to first value + 3 mo to scale. Buy: 4 weeks to first value, 12 weeks for enterprise-segment readiness ≈ 4 months total. Partner: 2 weeks, but divergence cost unknown.
- Step 3 — Build fails: team-knowledge walks. Buy fails: Confluent re-prices on usage (mitigation: 2-year contract). Partner fails: partner's roadmap diverges (mitigation: thin exit clause).
- Step 4 — Build preserves deep integration optionality (foreclosed by buy). Buy preserves capital optionality (foreclosed by build). Partner preserves nothing of consequence.
- Step 5 — Decide buy. Emit ADR via `adr-create` citing the matrix verdict + integration-cost band + Confluent-specific lock-in mitigation.
