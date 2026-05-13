---
complexity: structural
---


# Road to GTM and Growth (Wing 3)

> Sibling roadmap to `road-to-better-skills-and-profiles.md` (Wing 1)
> and `road-to-unified-senior-roles.md` (Foundation + Wing 2). Where
> those lift engineering and product cognition, this roadmap lifts
> the **go-to-market and growth** dimension to senior level: brand
> positioning, pipeline strategy, customer-success cognition, growth
> funnel reasoning. Goal: every GTM seat (CMO, RevOps, Customer
> Success, Growth PM) gets the same senior surface inside the package.

**Source map:** `agents/contexts/senior-personas-and-skills-map.md` v2
(post-iter1). Wing 3 owner. 4 personas, 16 skills. Map is the
universe; this roadmap sequences delivery by dependency.

## Status

`ready-for-execution` — joint council-iter2 landed
(Anthropic + GPT-4o, 2026-05-05, $0.1529).
Inherits iter-1 verdicts (Q1 content-strategist folded into CMO; Q5
split-3A/3B; Q6 founder-mode as cross-cutting stance; Q7 channel-
cognition vs channel-tooling boundary) and applies iter-2 deltas (G2
adds 4th linter test `channel-agnosticism`; H10 ↔ Wing-4 O2 adopts
interface-first-stub pattern; H1 + H7 back-cite Wing-4 P3 + P4;
persona naming locked to slug-clean + `tier: senior` frontmatter per
unified Q7).

Block sequencing: **Block G starts only after** the sibling roadmap's
Block A (personas) ships ≥ 50 % AND `road-to-unified-senior-roles.md`
Block K (cross-role foundation: context-spine, lint-skills tier-field,
mental-models reference) ships ≥ 100 %. K is the cross-role plumbing
that all Wing-3 skills compose against; racing K would force schema
re-work later.

## Scope shift vs the sibling roadmaps

The original sibling (`road-to-better-skills-and-profiles.md`) declares
a hard out-of-scope on *"Marketing skills"* and *"C-level / advisor
skills"*. The unified-senior-roles roadmap opened a narrow PO /
discovery / RevOps-maintainer lane. **This roadmap opens the GTM lane
fully** under three explicit boundaries (council Q7 linter rule):

| Lane | In | Out |
|---|---|---|
| **Senior brand & narrative cognition** | Positioning, messaging architecture, voice-and-tone, editorial cadence reasoning, fundraising narrative cognition | Channel-specific tooling (paid-ads platform configuration, SEO-audit tools, ad-creative generation, programmatic-SEO scaffolds) |
| **Senior pipeline cognition** | MEDDIC qualification, pipeline-stage reasoning, forecast-accuracy heuristics | Salesforce / HubSpot administration, CRM enrichment APIs, lead scraping tools, dialer integrations |
| **Senior funnel & retention cognition** | Funnel-stage diagnostics, retention-loop design, activation-experiment reasoning, churn-cause classification, expansion-playbook design | A/B-test platform configuration, product-analytics-tool plugins, NPS-tool integrations, segment-/Mixpanel-specific surfaces |

The line we hold: **senior cognition transfers across channels and
vendors; channel/vendor surface stays out**. A senior CMO reasons
about positioning whether the channel is paid-ads or community; we
ship the cognition, not the channel.

## Decisions (synthesized from map v2 + iter1)

Block sequencing locked by dependency. ICE table later in this file
sanity-checks the chain, not re-orders it.

| # | Decision | Why |
|---|---|---|
| A | Foundation (Block G) before any skill | Wing-3-specific glue layers on top of unified-senior-roles K — context-spine slots for channel/funnel-stage/customer-segment, related-skills mechanics adapted for GTM cross-citations |
| B | Brand cluster (Q1–Q5) before pipeline cluster (Q6–Q7) | Pipeline qualification cites positioning; reverse-order would force re-write |
| C | Pipeline cluster (Q6–Q7) before funnel cluster (R1–R3) | Growth-PM funnel-analysis cites pipeline-stage reasoning; activation-design composes onboarding-design from CS lead |
| D | Customer Success (R4–R6) before Growth PM (R1–R3) | Retention-loops compose churn-prevention and expansion-playbook; reverse-order forces stub references |
| E | Personas last (Block I) | Persona = composition of skills + workflows + identity; can only stabilize after skills land |
| F | CMO cluster ships H1 + H2 first, H3–H7 follow | ICE-ranked sequencing — H1 (`positioning`) and H2 (`messaging-architecture`) are foundation for H3–H7 |
| G | No version-anchoring inside roadmap (per `scope-control`) | Roadmap plans work; release decisions live elsewhere |
| H | Founder-mode stance not a sub-step | Per Q6 verdict — stance documents in map only, surfaces via persona `## Stances` frontmatter |

## Out of scope (locked)

These are out **for the package**, not "out for now". The line is
load-bearing because the council Q7 linter test fires on every
Wing-3 skill:

- **Channel platform tooling** — paid-ads platform configuration, SEO-tool integrations, ad-creative generation, programmatic-SEO scaffolds, email-platform automation, social-scheduling tools.
- **CRM and pipeline tooling** — Salesforce / HubSpot administration, lead-enrichment APIs, dialer / call-recording integrations, deal-room tools.
- **Analytics platform plugins** — A/B-test platform configuration, Mixpanel / Amplitude / Segment SDK wrapping, NPS-tool integrations, product-analytics dashboards.
- **C-level governance** — board-deck composition, investor-update cadence, fundraising-process management (term sheets, due diligence). Fundraising **narrative cognition** stays in (CMO Q5); the **process** stays out.
- **Junior tier of any GTM skill** — onboarding-marketer, junior-SDR-playbook, etc. Senior tier only.
- **Off-stack frameworks** — package anchors on Laravel / Next.js / PHP host; GTM skills reference these stacks for examples, never expand to off-stack.

## Phase 1: GTM and Growth execution

Block-level + sub-step checklist. Order: G → H → I. Sub-steps are
shippable artefacts (one pattern, one skill, one persona), matching
the sibling-roadmap convention so `agents/roadmaps-progress.md`
scores real progress. Sub-step letter prefixes: **G** (foundation),
**H** (skills), **I** (personas).

### Block G — GTM cognition foundation (1.5 weeks, prep for H and I)

Wing-3-specific glue on top of unified-senior-roles Block K. K
established the cross-role context-spine; G adds the GTM-specific
spine slots (channel-stage, funnel-stage, customer-segment) and the
brand-versus-pipeline composition rules.

- [ ] **G** — GTM cognition foundation shipped (block marker; flips when G1–G3 are all done). Gated on unified-senior-roles K ≥ 100 % AND sibling Block A ≥ 50 %.
- [x] **G1** — `gtm-context-spine` extension: `docs/contracts/context-spine.md` adds three Wing-3 slots — `channel-stage` (awareness / consideration / decision / retention / expansion), `funnel-stage` (top / mid / bottom / activation / retention), `customer-segment` (ICP / persona / segment-by-arr-band). Tri-slot rule (council Q1 from unified-iter1) extends: GTM skills cite ≥ 1 slot or ADR for opt-out. Slot additions follow same `stable` policy.
- [x] **G2** — `lint-skills` extended for Wing-3 cognition tests: **stacks on top of suite-closure Phase 2.4 senior-tier floor** (Related Skills WHEN/NOT, Proactive Triggers, Output Artifacts — already shipped in `lint_senior_tier_blocks()`). G2 adds Wing-3-specific tests per council Q7 boundary linter + iter-2 OQ3 verdict — (a) **agent-operability** (skill executable inside agent surface, no external SaaS auth), (b) **vendor-independence** (no platform-specific scaffold — no `salesforce-*`, `hubspot-*`, `mailchimp-*` SDK), (c) **transferability** (skill text re-readable across stacks without rewrite), (d) **channel-agnosticism** (skill cannot prescribe channel-specific tactics — no "email subject lines," "ad creative specs," "LinkedIn-post cadence"; channels MAY appear as examples in runnable scenarios but MUST NOT be required for execution). Channel-agnosticism is distinct from transferability: transferability = readable across stacks; channel-agnosticism = readable across channels. One-fail-blocks-merge per `.agent-src.uncompressed/rules/skill-quality.md` (canonical contract; path corrected from `docs/contracts/skill-quality.md` in suite-closure Phase 2).
- [ ] **G3** — Cite `docs/contracts/cross-wing-handoff.md` (suite-closure Phase 3.1) for the typed-handoff contract; ship `docs/guidelines/gtm-handoff.md` for **Wing-3-specific prose** documenting three load-bearing chains from the map: brand→channel (positioning → messaging → gtm-launch → editorial-calendar → content-funnel-design); discovery→pipeline (customer-research → ICP → pipeline-strategy → MEDDIC → forecast-accuracy); funnel→retention (funnel-analysis → activation-design → onboarding-design → retention-loops → churn-prevention → expansion-playbook). Each chain: when does cognition hand off, what artefact crosses the boundary, who owns the failure mode if the chain breaks. Cycle / dangling / tier-mismatch enforcement lives in `task lint-handoffs` (Phase 3.2), not duplicated here.

### Block H — GTM cognition skills

**Sixteen skills**, ICE-ranked. H1 + H2 are the foundation for the
CMO cluster (council Q6 sibling-velocity-honest applied to Wing 3);
H3–H16 follow ICE order. Skill names are
clean — `tier: senior` lives in frontmatter (council Q7 unified-iter1,
FRONTMATTER-FIELD). Each skill ships with the same six artefacts as
unified-senior-roles Block L: persona link (Block I), context-spine
declaration (G1), related-skills block (K2 from unified), one
mental-model citation (K4 from unified), `tier: senior` frontmatter,
runnable example. **No skill ships without all six.**

- [ ] **H** — GTM cognition skills shipped (block marker; flips when H1–H16 are all done).

**CMO cluster (7 skills — folds former content-strategist per Q1):**

- [ ] **H1** — `positioning` skill (`tier: senior`): category framing, "we are X for Y, not Z" articulation, point-of-view sharpening, opposable-positioning audit. Borrows mental-model `first-principles` + `inversion`. Cited by Wing-4 `competitive-positioning` (P3) — H1 owns market-positioning narrative; P3 reuses for strategic differentiation. **Out:** category-creation theatre (where positioning is invented, not earned).
- [ ] **H2** — `messaging-architecture` skill (`tier: senior`): primary message, supporting proofs, audience-by-message matrix, narrative-stack reasoning. Composes `positioning` (cites). **Out:** copy generation, ad-headline writing.
- [ ] **H3** — `gtm-launch` skill (`tier: senior`): launch sequencing (alpha → beta → GA), audience-wave logic, narrative beats per wave, dependency on engineering readiness signals. Composes `messaging-architecture` + Block-L `release-comms` (unified-senior-roles).
- [ ] **H4** — `editorial-calendar` skill (`tier: senior`, folded from former content-strategist per Q1): cadence reasoning (evergreen vs campaign vs reactive), beat-mapping, content-debt management. **Out:** content-management-system tooling.
- [ ] **H5** — `content-funnel-design` skill (`tier: senior`, folded from former content-strategist per Q1): funnel-stage-to-content-shape mapping, conversion-pathway design, content-as-system thinking. Composes `editorial-calendar` + `funnel-analysis` (H14).
- [ ] **H6** — `voice-and-tone-design` skill (`tier: senior`): voice attributes, tone-by-context matrix, brand-voice consistency review. **Out:** copy-editing service.
- [ ] **H7** — `fundraising-narrative` skill (`tier: senior`, cites founder-mode stance per Q6): "why now / why us / why this" framing for capital-raising contexts, market-size reasoning, traction-story construction. Sibling to Wing-4 `vision-articulation` (P4) — H7 = external pitch under capital constraint, P4 = internal anchor for org alignment. **Out:** investor-CRM management, due-diligence-data-room tooling.

**RevOps cluster (3 skills):**

- [ ] **H8** — `pipeline-strategy` skill (`tier: senior`): stage-definition, conversion-rate-by-stage targets, pipeline-coverage reasoning, leak detection. **Out:** Salesforce / HubSpot configuration.
- [ ] **H9** — `deal-qualification-meddic` skill (`tier: senior`): MEDDIC framework cognition (Metrics, Economic-buyer, Decision-criteria, Decision-process, Identify-pain, Champion), qualification-call structure, disqualification heuristics. **Out:** call-recording integrations.
- [ ] **H10** — `forecast-accuracy` skill (`tier: senior`, cites finance-partner `forecasting` (Wing-4 O2) via interface-first-stub per iter-2 OQ4): forecast-call construction, commit / best-case / pipeline categorization, accuracy retro-loop. Composes against the `forecast-construction-shape` ADR shipped by O2 (top-down vs bottom-up, confidence-band, retro-loop signature) — H10 starts only after O2-interface ≥ 100 % but parallel to O2 implementation. If O2 drifts from interface, O2 breaks contract (not H10); contract locked in J3 + G3 handoff guidelines. **Out:** forecasting-tool plugins.

**Customer Success cluster (3 skills):**

- [ ] **H11** — `onboarding-design` skill (`tier: senior`): time-to-first-value reasoning, milestone-design, friction-audit, drop-off diagnosis. Distinct from `onboarding-program` (Wing-4 employee-facing).
- [ ] **H12** — `churn-prevention` skill (`tier: senior`): health-score signal design, churn-cause classification (involuntary / value / relationship / fit), early-warning loop. Feeds back into Wing-4 forecasting per cross-skill map.
- [ ] **H13** — `expansion-playbook` skill (`tier: senior`): account-expansion patterns, upsell-vs-cross-sell reasoning, expansion-trigger signals, NRR-cognition. **Out:** PQL-tooling integrations.

**Growth PM cluster (3 skills):**

- [ ] **H14** — `funnel-analysis` skill (`tier: senior`): funnel-stage diagnostics, leaky-bucket vs growth-loop classification, leading-indicator selection, cohort-behavior reading. **Out:** Mixpanel / Amplitude SDK wrapping.
- [ ] **H15** — `retention-loops` skill (`tier: senior`): habit-formation reasoning, trigger-action-reward design, network-effect vs single-user-loop classification. Composes `onboarding-design` (H11) + `churn-prevention` (H12).
- [ ] **H16** — `activation-design` skill (`tier: senior`): aha-moment definition, activation-event selection, activation-funnel construction, leading-vs-lagging-indicator reasoning.


### Block I — Wing 3 personas

Per the universe map, Wing 3 has four personas. Persona = composition
of skills + workflows + identity, override-friendly per the
unified-senior-roles council Q4 ABSORB pattern (defaults loaded,
project overrides allowed via `agents/overrides/`).

- [ ] **I** — Wing 3 personas shipped (block marker; flips when I1–I4 are all done). Gated on Block H ≥ 50 % (at least the cluster lead-skills H1, H8, H11, H14 done).
- [ ] **I1** — `cmo` persona (`tier: senior`): identity = "owns the said and the seen", capabilities (default-loaded, override-friendly per unified Q4) = H1 + H2 + H3 + H4 + H5 + H6 + H7. Stances: founder-mode (cited via H7). Workflows = launch-sequence-loop + content-cadence-loop.
- [ ] **I2** — `revops` persona (`tier: senior`): identity = "owns the pipeline and the forecast", capabilities = H8 + H9 + H10. Mental-models = `theory-of-constraints` + `leading-vs-lagging-indicators`. Workflows = pipeline-review-loop + forecast-call-loop.
- [ ] **I3** — `customer-success-lead` persona (`tier: senior`): identity = "owns the post-signature value", capabilities = H11 + H12 + H13. Workflows = onboarding-design-loop + health-score-review-loop.
- [ ] **I4** — `growth-pm` persona (`tier: senior`): identity = "owns the funnel and the loops", capabilities = H14 + H15 + H16. Composes `customer-research` (unified L1) + `north-star-metric` (unified Wing-2 cognition). Workflows = funnel-diagnostic-loop + activation-experiment-loop.

## Sibling cross-references (locked)

This roadmap composes with — never duplicates — the sibling roadmaps.
Each row names the **single** owner; if both sides need the artefact,
this roadmap cites, the sibling owns.

| Artefact | Owner | Wing-3 cite point |
|---|---|---|
| `context-spine` mechanic | unified-senior-roles K1 | G1 extends with three Wing-3 slots |
| `lint-skills` skeleton | unified-senior-roles K2 | G2 adds three Wing-3 boundary tests |
| `mental-models` reference | unified-senior-roles K4 | H1, H8, H14 cite (first-principles, theory-of-constraints, leading-vs-lagging-indicators) |
| `customer-research` (sibling) | unified-senior-roles L1 | I4 (`growth-pm`) cites for funnel-discovery |
| `release-comms` (sibling) | unified-senior-roles L2 | H3 (`gtm-launch`) composes for launch beats |
| `north-star-metric` cognition | unified-senior-roles Block N (Wave-2 PM persona) | I4 (`growth-pm`) cites |
| `code-review-multi-lens` | sibling-roadmap C8 | H7 (`fundraising-narrative`) cites for due-diligence engineering signals — read-only |
| Block A persona spine schema | sibling-roadmap A1–A6 | I1–I4 use the same six-section schema (identity / critical rules / capabilities / workflows / overrides / examples) |

## ICE table for Phase 1

ICE-rank (Impact × Confidence ÷ Effort) for the 16 skills + 4
personas + 3 foundation steps. Plate-pick = top 6 (G1–G3, H1–H2, I1).

| ID | Title | I (1–10) | C (1–10) | E (1–10) | Score | Plate |
|---|---|---|---|---|---|---|
| G1 | gtm-context-spine extension | 9 | 9 | 2 | 40.5 | ✅ |
| G2 | Wing-3 boundary linter | 9 | 8 | 3 | 24.0 | ✅ |
| G3 | gtm-handoff guideline | 8 | 9 | 2 | 36.0 | ✅ |
| H1 | positioning | 9 | 8 | 4 | 18.0 | ✅ |
| H2 | messaging-architecture | 9 | 8 | 4 | 18.0 | ✅ |
| I1 | cmo persona | 9 | 7 | 3 | 21.0 | ✅ |
| H8 | pipeline-strategy | 8 | 8 | 5 | 12.8 | next |
| H14 | funnel-analysis | 8 | 7 | 5 | 11.2 | next |
| H11 | onboarding-design | 7 | 8 | 4 | 14.0 | next |
| H3 | gtm-launch | 8 | 7 | 5 | 11.2 | next |
| (rest) | … | — | — | — | — | tail |

Foundation set: G1 → G2 → G3 → H1 → H2 → I1 (6 sub-steps) is the
unblocking sequence; the rest follows ICE order.

## Risk register

R-numbering continues from the sibling roadmaps (sibling = R1–R20,
unified-senior-roles = R21–R30). This roadmap = R31–R36.

- **R31** — Wing-3 boundary linter false-positives. Mitigation: G2 ships with allow-list mechanism + override pattern. **Owner:** maintainer.
- **R32** — `cmo` persona over-loaded (7 capabilities). Per Q1 verdict the merge is correct, but persona may feel heavy in practice. **Mitigation:** re-evaluate after I1 ships; split via override if a project consistently disables H4+H5+H6 (content cluster). **Acceptance:** ≥ 80 % of consumer projects load all 7 capabilities without override.
- **R33** — H10 (`forecast-accuracy`) cross-Wing dependency on Wing-4 finance-partner forecasting. **Mitigation:** Block H sequenced after Wing-4 Block P-equivalent ≥ 50 % (or H10 ships as stub citing Wing-4 forecasting interface). Council-iter2 to confirm sequencing.
- **R34** — Channel-tooling pressure from real users. Users will ask "where is the `paid-ads` tooling?" — boundary holds, but messaging needs to be public-facing. **Mitigation:** README of this roadmap explains the cognition-vs-tooling line; out-of-scope table is locked, not draft.
- **R35** — Persona compositeness regression. If I1 (`cmo`) loads 7 skills as defaults, slow agent-init time may regress. **Mitigation:** persona load is lazy per existing persona infra; verify I1 measurement before merging.
- **R36** — Wave overlap with Wing-4. Both roadmaps draft concurrently; cross-citations (H10→Wing-4 forecasting, H7→founder-mode stance documented in map) need to lock before either can run council-iter2 cleanly. **Mitigation:** council-iter2 is **joint** (single prompt, both roadmaps + map sanity), not sequential.

## Council iter-2 verdicts (resolved)

Joint council with `road-to-money-strategy-ops.md` ran on a shared
joint-iter2 prompt; verdicts captured 2026-05-05 ($0.1529 actual).
Anthropic + GPT-4o; on the six divergent verdicts Anthropic wins —
evidence-anchored to map iter-1 + unified iter-1 locks vs. GPT
re-litigation of locked items.

- **OQ1 → CONFIRM** — H7 stays in CMO cluster. Cognition-domain frame: narrative-craft under capital constraint = brand-positioning, not financial modeling. Finance-partner (Wing 4) owns unit-economics underneath; CMO owns the narrative.
- **OQ2 → CONFIRM** — `cmo` persona stays at 7 capabilities, content cluster (H4+H5+H6) folded. Map iter-1 Q1 lock holds — content-strategy IS senior-brand-cognition at this level, not a separate discipline. Persona-overlap rule passes (≥ 3 distinct skills) but that is a floor, not a split-trigger.
- **OQ3 → REFINE → applied** — G2 adds 4th linter test **channel-agnosticism**. Distinct from transferability: transferability = readable across stacks; channel-agnosticism = readable across channels.
- **OQ4 → REFINE → applied** — Interface-first-stub pattern (not strict-gate, not loose-stub). O2 ships `forecast-construction-shape` ADR (top-down vs bottom-up, confidence-band, retro-loop signature) before H10 starts; H10 then runs parallel to O2 implementation. Contract locked in J3 + G3 handoff guidelines; if O2 drifts, O2 breaks contract.
- **OQ5 → CONFIRM** — Foundation set stays at 6 sub-steps (G1+G2+G3+H1+H2+I1). H8 (`pipeline-strategy`) ICE = 12.8 < I1 = 21.0 — adding H8 as 7th breaks sequencing (H8 depends on G3, the last foundation step).
- **OQ6 → REFINE → applied** — Filename = `{slug}.md` (no `senior-` prefix), frontmatter = `tier: senior`. I1–I4 already conform; map handles (`senior-cmo`, etc.) are internal-only and v3 of the map updates them to match.

**CC1** — Cross-citation back-references added to H1 (cited by P3) and H7 (sibling to P4). 3A H10 ↔ 3B O2 already bidirectional.
**CC2** — All 4 Wing-3 personas pass the ≥ 3 distinct-skills rule (cmo=7, revops=3, customer-success-lead=3, growth-pm=3).
**CC3** — Foundation set is realistic; tail (H3–H16 + I2–I4 + Wing-4 tail) follows ICE order after the foundation lands.

**Synthesis** — Single biggest restructure across both wings: G2/J2 4th-test linter + O2-interface-first-stub + persona naming convergence; all three are cross-roadmap and cannot apply to one wing alone. Single biggest residual risk: 7-capability personas (`cmo`, `strategist`) are an unproven pattern at this complexity — slow agent-init if lazy-load regresses, conceptual overload for users; mitigation R35/R43 exists but acceptance-threshold is untested.

## Next step

> Roadmap 3A (Wing 3) is `ready-for-execution`. Joint council-iter2
> verdicts folded in (G2 channel-agnosticism, H1+H7 back-cites,
> H10 interface-first-stub, persona naming locked).
>
> Foundation set (G1 → G2 → G3 → H1 → H2 → I1) becomes runnable behind
> the unified-senior-roles K-block + sibling Block-A gate. Cross-Wing
> sequencing: O2-interface-contract (Wing 4) must ship before H10
> starts; H1 + H7 back-cite Wing-4 P3 + P4 (no execution dependency).
