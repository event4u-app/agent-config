---
complexity: structural
---


# Road to Money, Strategy and Operations (Wing 4)

> Sibling roadmap to `road-to-better-skills-and-profiles.md` (Wing 1),
> `road-to-unified-senior-roles.md` (Foundation + Wing 2), and
> `road-to-gtm-and-growth.md` (Wing 3). Where those lift engineering,
> product, and go-to-market cognition, this roadmap lifts the
> **money, strategy, and people-operations** dimension to senior level:
> unit-economics reasoning, build-buy-partner judgment, org-design
> cognition, hiring-loop craft. Goal: every C-level / strategic seat
> (CFO-cognition, Strategist, People-Strategist, EM) gets the same
> senior surface inside the package.

**Source map:** `agents/settings/contexts/senior-personas-and-skills-map.md` v2
(post-iter1). Wing 4 owner. 4 personas, 18 skills (largest wing,
folds former Wing 5 per council Q2). Map is the universe; this
roadmap sequences delivery by dependency.

## Status

`ready-for-execution` — joint council-iter2 landed
(Anthropic + GPT-4o, 2026-05-05, $0.1529).
Inherits iter-1 verdicts (Q2 Wing-5 absorbed into Wing-4 — legal
folded into strategist, people-ops + part of EM cognition merged
into people-strategist; Q5 split-3A/3B; Q6 founder-mode as cross-
cutting stance) and applies iter-2 deltas (J2 adds 4th linter test
`stage-agnosticism`; O2 ↔ Wing-3 H10 adopts interface-first-stub
pattern; persona naming locked to slug-clean + `tier: senior`
frontmatter per unified Q7).

Block sequencing: **Block J starts only after** the sibling roadmap's
Block A (personas) ships ≥ 50 % AND `road-to-unified-senior-roles.md`
Block K (cross-role foundation: context-spine, lint-skills tier-field,
mental-models reference) ships ≥ 100 %. K is the cross-role plumbing
that all Wing-4 skills compose against; racing K would force schema
re-work later.

## Scope shift vs the sibling roadmaps

The original sibling (`road-to-better-skills-and-profiles.md`) declares
a hard out-of-scope on *"C-level / advisor skills"* and *"HR / people
ops skills"*. **This roadmap opens both lanes fully** under three
explicit boundaries (council Q7 linter rule, Wing-4-tuned):

| Lane | In | Out |
|---|---|---|
| **Senior money cognition** | Unit-economics reasoning, forecast-call construction, runway thinking, scenario-modeling craft | Accounting-system administration, payroll integrations, tax-filing tooling, expense-reporting platforms |
| **Senior strategy & legal cognition** | Build/buy/partner reasoning, competitive-positioning, contracts-cognition (read-and-redline judgment), privacy-review reasoning, data-handling judgment | Contract-management platforms, e-signature integrations, compliance-tool SaaS, board-portal administration |
| **Senior people & ops cognition** | Org-design reasoning, comp-banding judgment, onboarding-program design, perf-feedback craft, hiring-loop design, throughput-vs-morale tradeoff | HRIS configuration, ATS integrations, payroll platforms, performance-review software, surveillance / monitoring tools |

The line we hold: **senior cognition transfers across stages and
tools; tool-surface stays out**. A senior CFO-cognition reasons about
unit economics whether the accounting system is QuickBooks or NetSuite;
we ship the cognition, not the system.

## Decisions (synthesized from map v2 + iter1)

Block sequencing locked by dependency. ICE table later in this file
sanity-checks the chain, not re-orders it.

| # | Decision | Why |
|---|---|---|
| A | Foundation (Block J) before any skill | Wing-4-specific glue layers on top of unified-senior-roles K — context-spine slots for fiscal-period / org-stage / regulatory-regime, related-skills mechanics adapted for Wing-4 cross-citations |
| B | Money cluster (O1–O4) before strategy cluster (P1–P7) | Strategy reasoning (build-buy, market-entry) cites unit-economics + scenario-modeling; reverse-order would force stub references |
| C | Strategy cluster (P1–P7) before people cluster (Q1–Q4) | People-strategist skills (org-design, comp-banding) compose strategist's `build-buy-partner` (insource-vs-outsource decisions) |
| D | People cluster (Q1–Q4) before EM cluster (S1–S3) | EM skills cite people-strategist's perf-feedback-craft + hiring-loop-design (people-strategist owns generalized loops; EM owns eng-team-specific surfaces) |
| E | Personas last (Block T) | Persona = composition of skills + workflows + identity; can only stabilize after skills land |
| F | Foundation skills (J1–J3 + O1 + P1) ship first, then T1; rest follow ICE order | ICE-ranked sequencing — foundation unblocks every persona |
| G | No version-anchoring inside roadmap (per `scope-control`) | Roadmap plans work; release decisions live elsewhere |
| H | Founder-mode stance not a sub-step | Per Q6 verdict — stance documents in map only, surfaces via `vision-articulation` (P4) + persona `## Stances` frontmatter |

## Out of scope (locked)

These are out **for the package**, not "out for now". The line is
load-bearing because the council Q7 linter test fires on every
Wing-4 skill:

- **Accounting and finance tooling** — QuickBooks / NetSuite / Xero administration, payroll-platform integrations, tax-filing automation, expense-management SaaS, banking-API wrappers.
- **Legal / compliance tooling** — contract-management platforms (Ironclad / DocuSign CLM), e-signature integrations (DocuSign / HelloSign SDKs), compliance-monitoring SaaS, GDPR / HIPAA audit-tool wrappers.
- **HR / people-ops tooling** — HRIS configuration (BambooHR / Workday / Rippling), ATS integrations (Greenhouse / Lever), payroll-platform wrappers, performance-review-software plugins, employee-engagement-survey SDKs, headcount-planning SaaS.
- **Board / investor process tooling** — board-portal administration, cap-table-platform plugins (Carta / Pulley), investor-CRM administration, due-diligence-data-room tooling. Strategist's `vision-articulation` (P4) and CMO's `fundraising-narrative` (Wing 3 H7) cover **narrative cognition**; the **process** stays out.
- **Junior tier of any Wing-4 skill** — junior-FP&A-playbook, junior-recruiter-screening, etc. Senior tier only.
- **Surveillance / monitoring of employees** — keystroke logging, screen-time tracking, productivity-monitoring tooling. Out for ethical-floor reasons, not just scope: senior people cognition is **trust-banking**, not surveillance.
- **Off-stack frameworks** — package anchors on Laravel / Next.js / PHP host; Wing-4 skills reference these stacks for examples, never expand to off-stack.

## Phase 1: Money, Strategy and Operations execution

Block-level + sub-step checklist. Order: J → O → P → Q → S → T.
Sub-steps are shippable artefacts (one pattern, one skill, one
persona), matching the sibling-roadmap convention so
`agents/roadmaps-progress.md` scores real progress. Sub-step letter
prefixes: **J** (foundation), **O** (finance), **P** (strategy),
**Q** (people-strategy), **S** (engineering-manager),
**T** (personas).

### Block J — Wing-4 cognition foundation (1.5 weeks, prep for O–T)

Wing-4-specific glue on top of unified-senior-roles Block K. K
established the cross-role context-spine; J adds the Wing-4-specific
spine slots (fiscal-period, org-stage, regulatory-regime) and the
money-vs-strategy-vs-people composition rules.

- [x] **J** — Wing-4 cognition foundation shipped (block marker; flips when J1–J3 are all done). Gated on unified-senior-roles K ≥ 100 % AND sibling Block A ≥ 50 %.
- [x] **J1** — `wing4-context-spine` extension: `docs/contracts/context-spine.md` adds three Wing-4 slots — `fiscal-period` (monthly / quarterly / annual / multi-year-plan), `org-stage` (seed / series-A / series-B / growth / public — applied to people + strategy reasoning), `regulatory-regime` (none / GDPR / HIPAA / SOC2 / PCI — applied to strategist privacy-review + data-handling-judgment). Tri-slot rule (council Q1 from unified-iter1) extends: Wing-4 skills cite ≥ 1 slot or ADR for opt-out. Slot additions follow same `stable` policy.
- [x] **J2** — `lint-skills` extended for Wing-4 cognition tests: **stacks on top of suite-closure Phase 2.4 senior-tier floor** (Related Skills WHEN/NOT, Proactive Triggers, Output Artifacts — already shipped in `lint_senior_tier_blocks()`). J2 adds Wing-4-specific tests per council Q7 boundary linter + iter-2 OQ3 verdict — (a) **agent-operability** (skill executable inside agent surface, no external SaaS auth — no QuickBooks-API-key, no Carta-token), (b) **vendor-independence** (no platform-specific scaffold — no `quickbooks-*`, `bamboohr-*`, `docusign-*` SDK), (c) **transferability** (skill text re-readable across stacks without rewrite), (d) **stage-agnosticism** (skill cannot prescribe stage-specific thresholds — no "runway must be > 18 months," "revenue > $10M ARR," "team > 50 people"; stages MAY appear as examples in runnable scenarios but MUST NOT be required for execution; skill cites `org-stage` slot from J1 when stage IS load-bearing). Stage-agnosticism is distinct from transferability: transferability = readable across stacks; stage-agnosticism = readable across org-stages (seed vs series-B vs public). One-fail-blocks-merge per `.agent-src.uncondensed/rules/skill-quality.md` (canonical contract; path corrected from `docs/contracts/skill-quality.md` in suite-closure Phase 2).
- [x] **J3** — Cite `docs/contracts/cross-wing-handoff.md` (suite-closure Phase 3.1) for the typed-handoff contract; ship `docs/guidelines/wing4-handoff.md` for **Wing-4-specific prose** documenting four load-bearing chains from the map: money→strategy (`unit-economics` → `scenario-modeling` → `build-buy-partner` — strategy decisions cite money cognition); strategy→people (`build-buy-partner` → `org-design` — insource-vs-outsource is the same decision shape); people→EM (`hiring-loop-design` (general) → `hiring-loop-design` × eng-context (S2) — EM specializes the generalized loop); finance→GTM (Wing-4 `forecasting` → Wing-3 `forecast-accuracy` H10 — finance owns forecasting cognition, RevOps owns the forecast-call loop). Each chain: when does cognition hand off, what artefact crosses the boundary, who owns the failure mode if the chain breaks. Cycle / dangling / tier-mismatch enforcement lives in `task lint-handoffs` (Phase 3.2), not duplicated here.


### Block O — Money cognition skills

**Four skills** owned by `finance-partner`. O1 is the foundation
(council Q6 sibling-velocity-honest applied to Wing 4); O2–O4 follow
ICE order. Skill names are clean — `tier: senior` lives in frontmatter (council Q7
unified-iter1, FRONTMATTER-FIELD). Each skill ships with the same
six artefacts as unified-senior-roles Block L: persona link (Block T),
context-spine declaration (J1), related-skills block (K2 from
unified), one mental-model citation (K4 from unified), `tier: senior`
frontmatter, runnable example. **No skill ships without all six.**

- [x] **O** — Money cognition skills shipped (block marker; flips when O1–O4 are all done).
- [x] **O1** — `unit-economics-modeling` skill (`tier: senior`): CAC / LTV cognition, contribution-margin reasoning, payback-period analysis, burn-multiple judgment. Borrows mental-model `first-principles` + `second-order-thinking`. **Out:** accounting-system administration, P&L reporting tooling.
- [x] **O2** — `forecasting` skill (`tier: senior`, ships via interface-first-stub per iter-2 OQ4): forecast-construction reasoning (top-down vs bottom-up), confidence-band design, accuracy retro-loop. Cited by Wing-3 `forecast-accuracy` (H10) — finance owns the cognition, RevOps owns the call. **Sub-deliverable O2-interface (0.5 sub-steps, ships first):** `forecast-construction-shape` ADR locking the contract H10 composes against (top-down vs bottom-up enum, confidence-band signature, retro-loop signature). H10 starts after O2-interface ≥ 100 %, parallel to O2 implementation. Contract locked in J3 + G3 handoff guidelines; O2 drift breaks contract, not H10. **Out:** forecasting-tool plugins.
- [x] **O3** — `runway-cognition` skill (`tier: senior`): cash-flow-shape reasoning, runway-vs-burn modeling, fundraise-trigger heuristics, layoff-vs-cut-vs-grow decision tree. **Out:** banking-API integrations, cash-management SaaS.
- [x] **O4** — `scenario-modeling` skill (`tier: senior`): three-statement scenario construction, sensitivity analysis, optionality reasoning. Composes `unit-economics` (O1) + `forecasting` (O2). **Out:** spreadsheet-model authoring service.

### Block P — Strategy cognition skills (folds former legal per Q2)

**Seven skills** owned by `strategist`. P1 is the foundation; P2–P7
follow ICE order. Per council Q2: legal-compliance persona absorbed into strategist —
contracts / privacy / data-handling cognition is strategy under
regulatory constraint, not a separate persona. Each skill ships with
the same six artefacts as Block O.

- [x] **P** — Strategy cognition skills shipped (block marker; flips when P1–P7 are all done).
- [x] **P1** — `build-buy-partner` skill (`tier: senior`): insource-vs-outsource-vs-acquire reasoning, integration-cost analysis, dependency-risk assessment, optionality preservation. Borrows mental-model `inversion` + `second-order-thinking`. **Out:** vendor-procurement tooling.
- [x] **P2** — `market-entry-analysis` skill (`tier: senior`): geo-vs-segment-vs-vertical entry reasoning, beachhead selection, expansion-sequencing, regulatory-delta analysis. Composes `competitive-moat-analysis` (P3). **Out:** market-research-tool integrations.
- [x] **P3** — `competitive-moat-analysis` skill (`tier: senior`, cites Wing-3 `positioning-strategy` for narrative surface; renamed from `competitive-positioning` to avoid collision with the existing Wing-1 package-peer-comparison skill of the same name): competitor-mapping reasoning, defensibility analysis, white-space identification. **Out:** competitive-intelligence-tool integrations.
- [x] **P4** — `vision-articulation` skill (`tier: senior`, cites founder-mode stance per Q6): "where we're going / why now / why us" framing distinct from Wing-3 `fundraising-narrative` (H7) — vision is internal-anchor, fundraising is external-pitch. **Out:** vision-deck-design tooling.
- [x] **P5** — `contracts-cognition` skill (`tier: senior`, folded from legal per Q2): contract-shape reading, risk-clause identification, redline-priority reasoning, "what does this contract actually constrain" framing. **Out:** contract-management-platform administration, e-signature integration.
- [x] **P6** — `privacy-review` skill (`tier: senior`, folded from legal per Q2): GDPR / CCPA / HIPAA cognition, data-flow review, consent-design reasoning, breach-impact triage. Cites J1 `regulatory-regime` slot. **Out:** privacy-tool SaaS administration, audit-platform plugins.
- [x] **P7** — `data-handling-judgment` skill (`tier: senior`, folded from legal per Q2): data-classification cognition (PII / PHI / financial / public), retention-policy reasoning, cross-border-transfer judgment, data-subject-rights workflow. Composes `privacy-review` (P6). **Out:** DLP-tool integrations.

### Block Q — People-strategy cognition skills (merges former people-ops + EM-generalist per Q2)

**Four skills** owned by `people-strategist`. Q1 is the foundation;
Q2–Q4 follow ICE order. Per council Q2: former people-ops persona merged with generalist-EM
cognition into `people-strategist`; eng-team-specific surfaces
stay under EM (Block S). Each skill ships with the same six artefacts.

- [x] **Q** — People-strategy cognition skills shipped (block marker; flips when Q1–Q4 are all done).
- [x] **Q1** — `org-design` skill (`tier: senior`): team-shape reasoning (functional vs cross-functional vs squad), span-of-control judgment, reorg-cost analysis, Conway's-law-aware structure. Composes `build-buy-partner` (P1) for insource-vs-outsource shape. Borrows mental-model `theory-of-constraints`. **Out:** org-chart software administration.
- [x] **Q2** — `comp-banding` skill (`tier: senior`): level-design, comp-band construction, equity-vs-cash tradeoff reasoning, geo-adjustment cognition, raise-vs-promotion vs market-correction judgment. **Out:** compensation-platform administration (Pave / Carta integrations).
- [x] **Q3** — `onboarding-program` skill (`tier: senior`, distinct from Wing-3 H11 `onboarding-design` which is customer-facing): time-to-productivity reasoning, role-by-role onboarding-shape, mentor-pairing logic, 30/60/90-day milestone design. **Out:** HRIS-onboarding-module configuration.
- [x] **Q4** — `perf-feedback-craft` skill (`tier: senior`, generalized from EM-only per Q2): feedback-shape reasoning (situation-behavior-impact, not generic), ladder-of-inference traversal, growth-vs-corrective separation, feedback-cadence design. **Out:** performance-review-software integrations.

### Block S — Engineering-manager skills

**Three skills** owned by `engineering-manager`. EM specializes
generalist people-strategist surfaces for engineering teams;
specialization comes after the generalized cognition ships. Each
skill ships with the same six artefacts.

- [x] **S** — Engineering-manager skills shipped (block marker; flips when S1–S3 are all done). Gated on Block Q ≥ 75 % (at least Q1 + Q4 done — EM specializes those).
- [x] **S1** — `one-on-one-cadence` skill (`tier: senior`): cadence reasoning (weekly vs biweekly), agenda-shape judgment, growth-vs-blocker-vs-trust mix, cancellation-anti-pattern detection. **Out:** 1:1-tooling integrations (Lattice / 15Five).
- [x] **S2** — `hiring-loop-design` skill (`tier: senior`, cites Q1 `org-design` + Q4 `perf-feedback-craft`): eng-specific hiring-loop construction (screen → take-home / system-design / coding / behavioral / leadership), calibration-session design, bar-raiser logic, signal-vs-noise audit. **Out:** ATS configuration, scheduling-tool integrations.
- [x] **S3** — `throughput-vs-morale-tradeoff` skill (`tier: senior`, eng-team-specific): velocity-vs-quality-vs-burnout cognition, on-call-load reasoning, focus-fragmentation analysis, reorg-shock vs steady-state framing. Cites `theory-of-constraints` mental model. **Out:** team-velocity-tool plugins.

### Block T — Wing 4 personas

Per the universe map, Wing 4 has four personas. Persona = composition
of skills + workflows + identity, override-friendly per the
unified-senior-roles council Q4 ABSORB pattern (defaults loaded,
project overrides allowed via `agents/overrides/`).

- [x] **T** — Wing 4 personas shipped (block marker; flips when T1–T4 are all done). Gated on Block O ≥ 50 % AND Block P ≥ 50 % AND Block Q ≥ 50 % (at least the cluster lead-skills O1, P1, Q1 done).
- [x] **T1** — `finance-partner` persona (`tier: senior`): identity = "owns the cash and the model", capabilities (default-loaded, override-friendly per unified Q4) = O1 + O2 + O3 + O4. Mental-models = `first-principles` + `second-order-thinking` + `inversion`. Workflows = monthly-close-loop + scenario-update-loop.
- [x] **T2** — `strategist` persona (`tier: senior`, absorbs former legal-compliance per Q2): identity = "owns the second-order moves", capabilities = P1 + P2 + P3 + P4 + P5 + P6 + P7. Stances: founder-mode (cited via P4). Workflows = build-buy-partner-decision-loop + privacy-review-loop.
- [x] **T3** — `people-strategist` persona (`tier: senior`, merges former people-ops + EM-generalist per Q2): identity = "owns the org and the ladder", capabilities = Q1 + Q2 + Q3 + Q4. Workflows = org-review-loop + comp-cycle-loop + perf-feedback-loop.
- [x] **T4** — `engineering-manager` persona (`tier: senior`, eng-team-specific): identity = "owns the team's flow", capabilities = S1 + S2 + S3 + (cites Q4 perf-feedback-craft for eng-team specialization). Workflows = one-on-one-loop + hiring-calibration-loop.

## Sibling cross-references (locked)

This roadmap composes with — never duplicates — the sibling roadmaps.
Each row names the **single** owner; if both sides need the artefact,
this roadmap cites, the sibling owns.

| Artefact | Owner | Wing-4 cite point |
|---|---|---|
| `context-spine` mechanic | unified-senior-roles K1 | J1 extends with three Wing-4 slots |
| `lint-skills` skeleton | unified-senior-roles K2 | J2 adds three Wing-4 boundary tests |
| mental-models reference | unified-senior-roles K4 | O1, P1, Q1, S3 cite (first-principles, second-order, inversion, theory-of-constraints) |
| decision-records cognition | unified-senior-roles core | P1, Q1 cite for ADR-shape on build-buy and reorg decisions |
| stakeholder-tradeoff cognition | unified-senior-roles core | T2 (strategist), T3 (people-strategist) cite |
| `forecast-accuracy` (Wing 3) | road-to-gtm-and-growth H10 | O2 (`forecasting`) is upstream — finance owns cognition, RevOps owns the call (cite-only, no duplication) |
| `positioning` (Wing 3) | road-to-gtm-and-growth H1 | P3 (`competitive-positioning`) cites for narrative surface |
| `fundraising-narrative` (Wing 3) | road-to-gtm-and-growth H7 | P4 (`vision-articulation`) is sibling — vision = internal anchor, fundraising = external pitch (cite-only) |
| Block A persona spine schema | sibling-roadmap A1–A6 | T1–T4 use the same six-section schema (identity / critical rules / capabilities / workflows / overrides / examples) |

## ICE table for Phase 1

ICE-rank (Impact × Confidence ÷ Effort) for the 18 skills + 4
personas + 3 foundation steps. Foundation set = top 6 (J1–J3, O1, P1, T1).

| ID | Title | I (1–10) | C (1–10) | E (1–10) | Score | Order |
|---|---|---|---|---|---|---|
| J1 | wing4-context-spine extension | 9 | 9 | 2 | 40.5 | foundation |
| J2 | Wing-4 boundary linter | 9 | 8 | 3 | 24.0 | foundation |
| J3 | wing4-handoff guideline | 8 | 9 | 2 | 36.0 | foundation |
| O1 | unit-economics | 9 | 8 | 4 | 18.0 | foundation |
| P1 | build-buy-partner | 8 | 8 | 4 | 16.0 | foundation |
| T1 | finance-partner persona | 9 | 7 | 3 | 21.0 | foundation |
| Q1 | org-design | 8 | 8 | 5 | 12.8 | next |
| O2 | forecasting | 8 | 8 | 4 | 16.0 | next |
| P3 | competitive-positioning | 8 | 7 | 4 | 14.0 | next |
| O3 | runway-cognition | 8 | 7 | 4 | 14.0 | next |
| (rest) | … | — | — | — | — | tail |

Foundation set: J1 → J2 → J3 → O1 → P1 → T1 unblocks every persona;
the rest follows ICE order.

## Risk register

R-numbering continues from the sibling roadmaps (sibling = R1–R20,
unified-senior-roles = R21–R30, road-to-gtm-and-growth = R31–R36).
This roadmap = R37–R45.

- **R37** — Wing-4 boundary linter false-positives. Strategist's `contracts-cognition` and `privacy-review` could trip vendor-independence test if examples cite specific regulations (GDPR, CCPA). Mitigation: J2 ships with regulation-examples allow-list (regulations are not vendor-tools); ADR for any other carve-out. **Owner:** maintainer.
- **R38** — `strategist` persona over-loaded (7 capabilities, ties Wing-3 `cmo` for largest). Per Q2 verdict the legal absorption is correct, but persona may feel heavy in practice. **Mitigation:** re-evaluate after T2 ships; split via override if a project consistently disables P5+P6+P7 (legal cluster). **Acceptance:** ≥ 80 % of consumer projects load all 7 capabilities without override.
- **R39** — Q4 (`perf-feedback-craft`) double-ownership risk. Generalized in Q2 from EM-only to people-strategist + EM-cite per Q2. EM persona (T4) cites it without owning — fragile if council-iter2 reverses Q2 verdict and re-splits people-strategist + people-ops. **Mitigation:** lock Q2 in council-iter2 first question; if reversed, Block S re-bases on owned Q4-equivalent.
- **R40** — Cross-Wing dependency on Wing-3 `forecast-accuracy` H10. O2 (`forecasting`) is cited by H10 — if Wing 3 ships H10 before O2, H10 ships as stub-with-interface. **Mitigation:** cross-roadmap sequencing rule: H10 gated on O2 ≥ 100 % OR H10 explicitly stub-flagged with O2 interface contract. Council-iter2 to confirm.
- **R41** — Compliance-creep pressure from real users. Users will ask "where is the SOC2-audit tooling?" or "where is the GDPR-compliance-platform integration?" — boundary holds, but messaging needs to be public-facing. **Mitigation:** README of this roadmap explains the cognition-vs-tooling line; out-of-scope table is locked, not draft.
- **R42** — People-cognition surveillance pressure. Users will ask "where is the productivity-monitoring skill?" — out-of-scope table explicitly excludes for ethical-floor reasons (people cognition = trust-banking, not surveillance). **Mitigation:** scope language in this roadmap, plus the sibling-roadmap `non-destructive-by-default` rule already covers any agent action that monitors developers without consent. Cite both surfaces.
- **R43** — Persona compositeness regression. If T2 (`strategist`) loads 7 skills as defaults, slow agent-init time may regress. **Mitigation:** persona load is lazy per existing persona infra; verify T2 measurement before merging (parity check with Wing-3 I1 `cmo` measurement).
- **R44** — Wing-5 ghost-resurrection. Q2 absorbed Wing 5 into Wing 4. If a future contributor re-splits, all Block-T persona compositions break (capabilities reshuffle). **Mitigation:** map v2 documents Q2 verdict explicitly; persona-overlap rule (≥ 3 distinct skills, council-iter1 Q1) requires re-justification before any re-split. Block this in `docs-sync` rule extension.
- **R45** — Wave overlap with Wing-3. Both roadmaps draft concurrently; cross-citations (O2 ↔ Wing-3 H10, P3 ↔ Wing-3 H1, P4 ↔ Wing-3 H7) need to lock before either can run council-iter2 cleanly. **Mitigation:** council-iter2 is **joint** (single prompt, both roadmaps + map sanity), not sequential.

## Council iter-2 verdicts (resolved)

Joint council with `road-to-gtm-and-growth.md` ran on a shared
joint-iter2 prompt; verdicts captured 2026-05-05 ($0.1529 actual).
Anthropic + GPT-4o; on the six divergent verdicts Anthropic wins —
evidence-anchored to map iter-1 + unified iter-1 locks vs. GPT
re-litigation of locked items.

- **OQ1 → CONFIRM** — Q2 Wing-5 absorption holds. Legal-into-strategist (contracts/privacy/data-handling = strategy under regulatory constraint) + people-ops-into-people-strategist (org-design/comp/onboarding/perf-feedback generalized from EM-only). Persona-overlap rule passes for all four T-personas; this is the lock-in moment.
- **OQ2 → CONFIRM** — `strategist` persona stays at 7 capabilities, legal cluster (P5+P6+P7) folded. Same shape as 3A-OQ2: legal IS strategy under regulatory-constraint, not separate discipline. R38 mitigation = re-evaluate if ≥ 80 % of projects disable P5–P7 via override (has not happened).
- **OQ3 → REFINE → applied** — J2 adds 4th linter test **stage-agnosticism**. Distinct from transferability: transferability = readable across stacks; stage-agnosticism = readable across org-stages.
- **OQ4 → REFINE → applied** — Mirror of 3A-OQ4. Interface-first-stub: O2 ships `forecast-construction-shape` ADR (0.5 sub-steps) before H10 starts; H10 then runs parallel to O2 implementation. Single answer applies both directions; locked in J3 + G3 handoff guidelines.
- **OQ5 → CONFIRM** — Foundation set stays at 6 sub-steps (J1+J2+J3+O1+P1+T1). Adding O2 as 7th creates interface-race with OQ4 (O2 must ship interface BEFORE full implementation if H10 runs parallel — interface ships in foundation, full O2 implementation follows).
- **OQ6 → REFINE → applied** — Filename = `{slug}.md` (no `senior-` prefix), frontmatter = `tier: senior`. T1–T4 already conform; map handles are internal-only and v3 of the map updates them to match. Converges with 3A-OQ6.

**CC1** — Cross-citations now bidirectional. 3A H10 ↔ 3B O2 already two-way. 3A H1 + H7 added back-cites to 3B P3 + P4 (one-way fix applied in Wing-3 sibling).
**CC2** — All 4 Wing-4 personas pass the ≥ 3 distinct-skills rule (finance-partner=4, strategist=7, people-strategist=4, engineering-manager=3 + cite Q4).
**CC3** — Foundation set is realistic; tail (O2-impl + O3 + O4 + P2–P7 + Q1–Q4 + S1–S3 + T2–T4) follows ICE order after the foundation lands.

**Synthesis** — Single biggest restructure across both wings: G2/J2 4th-test linter + O2-interface-first-stub + persona naming convergence. Single biggest residual risk: 7-capability personas (`cmo`, `strategist`) are an unproven pattern at this complexity; mitigation R35/R43 exists but acceptance-threshold is untested.

## Next step

> Roadmap 3B (Wing 4) is `ready-for-execution`. Joint council-iter2
> verdicts folded in (J2 stage-agnosticism, O2 interface-first-stub,
> persona naming locked).
>
> Foundation set (J1 → J2 → J3 → O1 → P1 → T1, plus the O2-interface
> sub-deliverable) becomes runnable behind the unified-senior-roles
> K-block + sibling Block-A gate. Cross-Wing sequencing: O2-interface
> contract must ship before Wing-3 H10 starts (Wing-3 already gates
> on this).
