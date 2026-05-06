# Senior Personas and Skills Map

**Status:** v3.1 — post-suite-closure-council, four-wings alignment applied (no Wing-5 prose, four owner-roadmaps, IO1 identity anchored in `AGENTS.md`)
**Owner:** maintainer (matze4u)
**Last updated:** 2026-05-05
**Council sessions:**
- `agents/council-sessions/senior-personas-map-iter1.json` (map iter-1, Anthropic + GPT-4o, $0.0992)
- `agents/council-sessions/joint-wing3-wing4-iter2.json` (joint Wing 3 + Wing 4 iter-2, Anthropic + GPT-4o, $0.1529)
**Sibling roadmaps** live under `agents/roadmaps/` — one plate per
wing (Wing 1 — Engineering; Wing 2 — Foundation cognition core +
Product, post-iter1; Wing 3 — GTM + Growth, ready-for-execution
post-iter2; Wing 4 — Money + Strategy + Ops, ready-for-execution
post-iter2). Lookup is by wing number, not file path
(per `no-roadmap-references`).

**v3 delta** (joint iter-2 OQ6 verdict): persona handles in this map dropped the `senior-` prefix to converge with the sibling-roadmap A-block + unified-senior-roles Q7 verdict (filename = `{slug}.md`, `tier: senior` in YAML frontmatter, not in slug). Cognition-domain identifier unchanged — only the surface form. 81 replacements across 17 handles; prose terms (`senior-cognition`, `senior-individual-contributor`, `senior-people-manager`) untouched.

**v3.1 delta** (suite-closure council, IO1 verdict): the suite anchors as a **governed multi-department skill suite** in `AGENTS.md` and `road-to-suite-closure.md`. Four owner-roadmaps (Wings 1–4); Wing 5 stays merged into Wing 4 per iter-1 Q2 — the only remaining Wing-5 mentions in this file are explicit "former Wing 5" historical pointers in the iter-1 verdict table. "Five wings" → "Four wings"; "all three roadmaps" → "all four roadmaps"; stale "Next step" block replaced with a closure pointer. No persona universe changes — only wording alignment.

## Why this map exists

The two existing roadmaps each commit to a slice of senior personas. Before
slicing a third roadmap (the GTM / Revenue / Money / People wing) we need
the **complete senior-cognition universe** on one page so:

1. **No persona is missing** — gaps surface here, not after the third roadmap ships and the fourth is half-written.
2. **No two personas own the same skill** — each cognition skill has exactly one primary owner; other personas cite it.
3. **Cross-role composition is explicit** — load-bearing handoffs between personas (research → discovery → build → launch → retain) are drawn before any persona ships.
4. **Slicing is plate-realistic** — the universe can be larger than 6-week capacity; the **roadmaps** are the rate-limit, not the map.

The map is **vision-complete**, not plate-realistic. Roadmaps cut from it.

## Cognition role vs org title (Anthropic counter-frame, iter-1)

Council-iter1 surfaced the strongest counter-argument: **the map
risks confusing cognition ownership with organizational role**.
`cmo` and `revops` are org-chart titles that absorb
4–6 personas at different company stages — a Series-A "CMO" runs
content + ads + community + brand themselves; a Series-D "CMO" runs
a 40-person team where each cognition lives in a different role.

Resolution: **the map is a cognition-domain graph, not an org-chart**.
Persona names use familiar titles only as recognizable handles.
Each persona declares the **cognition skills it primarily owns** —
real teams compose those skills under whatever title the org-chart
prefers (CMO, Head of Growth, GTM-Lead, founder-doing-it-themselves).

Concretely:

- A persona is the **owner of a cognition cluster**, not a job description.
- Two real-world job titles can share a persona (e.g. "CMO" and "Head of Marketing" both load `cmo`).
- One real-world job can load multiple personas (e.g. founder-stage "Head of Product" loads `product-manager` + `product-owner` + founder-mode stance).
- Personas never claim org-chart authority — `staff-engineer` does not "manage" engineers; `cmo` does not "report to the CEO". Authority is org-political; cognition is what we model.

This frame makes Q1's persona-count tractable: we count **cognition
clusters**, not titles. 19 personas ≠ 19 hires. They are 19 distinct
mental-model surfaces a senior practitioner can load on demand.

## Scope discipline

This map covers **senior cognition** — the mental models, decision frames,
and judgment patterns a senior practitioner uses across roles. It does
**not** cover:

- **Channel tooling** — SEO platform configs, ad-platform setup, CRM workflow editors, analytics dashboard wiring. Tooling sits in vendor docs, not here.
- **Junior / mid-tier skills** — onboarding, "intro to X", language tutorials. Different tier, different package.
- **Domain-specific configs** — Stripe checkout setup, Salesforce object modeling, HubSpot automation. Those are skills *of the tool*, not *of the senior*.
- **Personality traits** — charisma, public speaking, "executive presence". Not a cognition pattern, can't be skill-shaped.
- **Off-stack frameworks** — Rails, Django, Spring. The package is Laravel/Next.js/PHP-anchored.

## Senior persona universe

Four wings. Each persona has a **primary owner-roadmap** so the map maps
1:1 to roadmap slices.

### Wing 1 — Engineering & Platform (owner: sibling roadmap A)

| Persona | One-line cognition core |
|---|---|
| `backend-engineer` | Trades correctness vs speed at the query, lock, and contract level; reads stack traces like prose |
| `frontend-engineer` | Owns interaction-quality budget; treats accessibility and perf as constraints, not features |
| `platform-engineer` | Designs the deploy → run → observe → debug loop; treats infra as a product with users |
| `security-engineer` | Threat-models before code; reasons about trust boundaries, supply chain, secrets, blast radius |
| `qa-architect` | Designs test strategy across unit / integration / E2E / contract; thinks in regressions and risk classes |
| `staff-engineer` | Cross-cutting authority; writes ADRs, mediates architecture disputes, owns "why this, not that" |
| `data-engineer` | Schema-first thinker; trades batch vs streaming, freshness vs cost, schema evolution vs query stability |

### Wing 2 — Product & Discovery (owner: unified-senior-roles roadmap, Block N)

| Persona | One-line cognition core |
|---|---|
| `product-owner` | Owns ticket-shape: AC, INVEST, slicing, dependency surfacing; gatekeeper between intent and engineering |
| `product-manager` | Owns roadmap shape: opportunity → solution tree, north-star metric, prioritization under ambiguity |
| `ux-researcher` | Owns insight-shape: interview craft, JTBD synthesis, evidence-grade ranking, "what's the question behind the question" |
| `tech-writer` | Owns docs-shape: information architecture, audience-aware drafting, "what does the reader already know" |

### Wing 3 — Go-to-Market & Growth (owner: road-to-gtm-and-growth.md, NEW)

Per council Q1: content-strategist folded into cmo (only 2 distinct skills — `editorial-calendar` + `content-funnel-design` — violated ≥3 cognition-skill rule). CMO now owns the editorial cluster directly.

| Persona | One-line cognition core |
|---|---|
| `cmo` | Owns positioning + messaging + editorial cadence + campaign architecture + voice/tone; reasons about category, narrative, content-funnel — channel-agnostic. (Folds in former content-strategist cluster per Q1.) |
| `revops` | Owns pipeline-strategy + deal-qualification (MEDDIC-shaped) + forecast accuracy; thinks in conversion-rate-by-stage, leak detection |
| `customer-success-lead` | Owns onboarding-design + churn-prevention + expansion playbook; thinks in time-to-first-value, health-score signals, retention compounding |
| `growth-pm` | Owns funnel analysis + retention loops + activation experiments; thinks in cohort behavior, leading indicators, leaky-bucket vs growth-loop diagnostics |

### Wing 4 — Money, Strategy & Operations (owner: road-to-money-strategy-ops.md, NEW)

Per council Q2: former Wing 5 (People & Operations) merged into Wing 4. Legal absorbed by strategist (legal cognition is strategy under regulatory constraint). People-ops + part of EM cognition consolidated into `people-strategist`. EM kept as eng-team-specific persona.

| Persona | One-line cognition core |
|---|---|
| `finance-partner` | Owns unit economics + forecasting + runway cognition + scenario modeling; thinks in CAC/LTV, burn-multiple, cash-flow shape |
| `strategist` | Owns build/buy/partner + market-entry + competitive positioning + contracts + privacy review; thinks in second-order moves, optionality, regulatory delta. (Absorbs former legal-compliance persona per Q2.) |
| `people-strategist` | Owns org-design + comp-banding + onboarding-program + perf-feedback craft; thinks in incentive alignment, growth ladder, trust banking. (Merges former people-ops + generalist-EM cognition per Q2.) |
| `engineering-manager` | Owns 1:1 cadence + hiring-loop design + throughput-vs-morale tradeoff for engineering teams specifically; thinks in technical-team management distinct from generalist people-strategist |

### Cross-cutting stances (not personas)

Council-iter1 (Q6) ruled `founder-cognition` and `staff-engineer-cross-cutting`
not as personas but as **stances any senior tier can enter temporarily**.
A stance is a lens — it changes how a persona reads the same context,
without owning a separate cognition cluster.

| Stance | Trigger | Source skills (now distributed) |
|---|---|---|
| `founder-mode` | Decision under near-zero evidence; "why now, why us, why this" framing; fundraising or vision-pivot moments | `vision-articulation` (now under strategist), `fundraising-narrative` (now under cmo), `prioritization-under-ambiguity` (already in cognition core as `ambiguity-handling`). All three are expressions of one meta-skill: **conviction-under-zero-evidence**. |
| `staff-cross-cutting` | Architecture dispute, ADR mediation, "why this stack, not that" framing | `system-design` + `decision-records` + `refactoring-strategy` (already owned by `staff-engineer` persona). The stance is the **mode** other engineers enter when the staff-engineer is unavailable. |

Stances are documented but **do not get their own roadmap blocks**.
They surface inside persona skill citations as `## Stances` frontmatter.

## Persona overlap rule (read this before adding any persona)

A new persona is justified only if:

1. It owns **≥ 3 senior cognition skills** that no other persona in this map owns primarily.
2. The cognition is **transferable across stacks** — Laravel team, Next.js team, AWS team can all use it unchanged.
3. The owner-cognition is **distinct from the tool surface** — a "Salesforce admin" is tool-cognition; a "revops" is pipeline-cognition.
4. **(Council-iter1 Q1)** The persona is **not a re-expression of an existing persona at a different org-stage** — "Head of Marketing" and "CMO" load the same persona; "VP Eng" and "Engineering Manager" load the same persona for a 5-engineer team.

If any of the four fails: cite skills under an existing persona, or
mark the cognition as a **stance** (see Cross-cutting stances above).
Persona inflation is the most expensive refactor in the package
because persona → skills → workflows → identity are coupled.

## Senior skill universe

Six categories. Each skill has **exactly one primary owner-persona**.
Other personas may cite it, but cannot own it. Skills marked `core`
are the cross-role cognition foundation — owned by all senior tiers.

### A. Cognition core — cross-role (sibling-roadmap K block)

| Skill | Primary owner | Citing personas |
|---|---|---|
| `mental-models` | core | all senior tiers |
| `first-principles` | core | all senior tiers |
| `second-order-thinking` | core | strategist, founder, EM, finance-partner |
| `inversion` | core | security, QA, strategist |
| `premortem` | core | PM, EM, security, platform |
| `decision-records` (ADR-thinking) | core | staff-eng, strategist, EM |
| `stakeholder-tradeoff` | core | PO, PM, EM, staff-eng |
| `ambiguity-handling` | core | PM, founder, strategist |

### B. Engineering depth (Wing 1)

| Skill | Primary owner |
|---|---|
| `code-review-multi-lens` | backend-engineer (composes from B + L4 boundary, see K3) |
| `threat-modeling-deep` | security-engineer |
| `system-design` | staff-engineer |
| `incident-postmortem` | platform-engineer |
| `query-performance` | backend-engineer |
| `refactoring-strategy` | staff-engineer |
| `observability-design` | platform-engineer |
| `release-engineering` | platform-engineer |
| `test-strategy-design` | qa-architect |
| `schema-evolution` | data-engineer |

### C. Product & discovery (Wing 2)

| Skill | Primary owner |
|---|---|
| `customer-research` | ux-researcher |
| `jobs-to-be-done` | ux-researcher |
| `opportunity-solution-tree` | product-manager |
| `north-star-metric` | product-manager |
| `pricing-cognition` | product-manager (cites finance-partner) |
| `ac-design` | product-owner |
| `invest-decomposition` | product-owner |
| `voc-extract` | ux-researcher (PR + Sentry + GitHub feeds; chat-export deferred per unified-senior-roles R30) |
| `developer-docs-architecture` | tech-writer |
| `rice-prioritization` | product-manager (suite-closure Phase 4 — Bundle β port) |
| `okr-tree-modeling` | product-manager (W2/W4 boundary; cites strategist & finance-partner; suite-closure Phase 4) |

### D. Go-to-market & Growth (Wing 3)

Per council Q1: content-strategist folded into cmo (only 2 distinct skills, violated ≥3 rule); editorial cluster now lives under cmo.

| Skill | Primary owner |
|---|---|
| `positioning` | cmo |
| `messaging-architecture` | cmo |
| `gtm-launch` | cmo (cites growth-pm + revops) |
| `editorial-calendar` | cmo (folded from content-strategist per Q1) |
| `content-funnel-design` | cmo (folded from content-strategist per Q1) |
| `voice-and-tone-design` | cmo |
| `fundraising-narrative` | cmo (cites founder-mode stance) |
| `funnel-analysis` | growth-pm |
| `retention-loops` | growth-pm |
| `activation-design` | growth-pm |
| `pipeline-strategy` | revops |
| `deal-qualification-meddic` | revops |
| `forecast-accuracy` | revops (cites finance-partner forecasting) |
| `onboarding-design` | customer-success-lead |
| `churn-prevention` | customer-success-lead (now feeds back into Money loop, see cross-skill map) |
| `expansion-playbook` | customer-success-lead |

### E. Money, Strategy & Operations (Wing 4)

Per council Q1+Q2: legal absorbed by strategist; people-ops merged with EM cognition into people-strategist (general) + EM (eng-specific); founder-cognition skills redistributed (now expressions of `founder-mode` stance).

| Skill | Primary owner |
|---|---|
| `unit-economics-modeling` | finance-partner (suite-closure Phase 4 — Bundle β port; was `unit-economics` placeholder) |
| `dcf-modeling` | finance-partner (suite-closure Phase 4 — Bundle β port) |
| `forecasting` | finance-partner |
| `runway-cognition` | finance-partner |
| `scenario-modeling` | finance-partner |
| `build-buy-partner` | strategist |
| `market-entry-analysis` | strategist |
| `competitive-positioning` | strategist (cites cmo for narrative surface) |
| `vision-articulation` | strategist (cites founder-mode stance) |
| `contracts-cognition` | strategist (folded from legal per Q2) |
| `privacy-review` | strategist (folded from legal per Q2) |
| `data-handling-judgment` | strategist (folded from legal per Q2) |
| `org-design` | people-strategist |
| `comp-banding` | people-strategist |
| `onboarding-program` | people-strategist (vs `onboarding-design` D = customer-facing) |
| `perf-feedback-craft` | people-strategist (generalized from EM-only per Q2) |
| `one-on-one-cadence` | engineering-manager |
| `hiring-loop-design` | engineering-manager (cites people-strategist for ladder) |
| `throughput-vs-morale-tradeoff` | engineering-manager (eng-team-specific) |

## Cross-skill reference map (load-bearing handoffs)

These are the handoffs that must work end-to-end for the package to
deliver "perfect tool for every senior role". A break in any chain
means a persona can't ship without leaning on a tool we don't own.

```
Discovery → Build chain
  customer-research → jobs-to-be-done → opportunity-solution-tree
                   → ac-design → invest-decomposition → engineering hand-off

Brand → Channel chain
  positioning → messaging-architecture → gtm-launch → editorial-calendar
                                                  → content-funnel-design

Growth funnel chain
  funnel-analysis → activation-design → retention-loops → expansion-playbook
                                                       ↑
                                              churn-prevention

Engineering lifecycle chain (extended per Q4 — incident feeds back into threat-model)
  system-design → threat-modeling-deep → release-engineering
       ↑                               → observability-design → incident-postmortem
       │                                                              │
       └──────────────── feedback loop (NEW per Q4) ──────────────────┘

Money loop (extended per Q4 — pricing↔funnel + churn→forecasting close the loop)
  unit-economics ↔ pricing-cognition ↔ forecasting → runway-cognition
                          ↓                ↑
                    funnel-analysis    churn-prevention
                    (pricing change ripples into conversion data;
                     churn signal feeds forecasting accuracy)

Boundary lines (hard edges, decided in unified-senior-roles K3)
  stakeholder-tradeoff (Wing 2/4 cognition core) ↔ code-review-multi-lens (Wing 1, sibling C8)
  positioning (Wing 3, cmo) ↔ vision-articulation (Wing 4, strategist + founder-mode stance)
  onboarding-design (Wing 3, customer-facing) ↔ onboarding-program (Wing 4, employee-facing)
```

## Roadmap slicing proposal (post-iter1)

Four roadmaps total, each plate-bounded. The map is the **vision**;
the roadmaps are the **delivery rate-limit**. Council-iter1 (Q5)
ruled the original 3-roadmap split unbalanced — Wings 3+4+5 in one
roadmap broke the 6-week plate budget.

| Roadmap | Wing(s) | Status | Plate horizon |
|---|---|---|---|
| `road-to-better-skills-and-profiles.md` | Wing 1 + early Wing 2 (PO/QA) | Active, in execution | Sibling — not retold here |
| `road-to-unified-senior-roles.md` | Foundation (cognition core) + Wing 2 Product | Council-iter1 done, ready-for-execution | K1–K4 + L1–L2 + N1 (7 sub-steps in plate; L3–L8 + N2–N4 deferred) |
| `road-to-gtm-and-growth.md` | Wing 3 (cmo + revops + customer-success + growth-pm) | NEW — drafted post-map-v2 | First plate likely 2 personas + ~8 skills (cmo + growth-pm) with revops + cs deferred to wave 2 |
| `road-to-money-strategy-ops.md` | Wing 4 (finance + strategist + people-strategist + EM) | NEW — drafted post-map-v2 | First plate likely 2 personas + ~8 skills (finance-partner + strategist) with people-strategist + EM deferred |

Slicing rules (locked, not for council debate):

1. **Foundation lives in Roadmap-2** — cognition core (`mental-models`, `first-principles`, etc.) ships once, all roadmaps cite it. No duplication.
2. **One persona, one roadmap** — a persona is born in exactly one roadmap. Other roadmaps cite, never re-create.
3. **Cross-skill handoffs are explicit** — when a Roadmap-3/4 skill cites a Roadmap-2 skill, the citation goes in `## Related Skills` frontmatter, validated by the skill linter.
4. **No release / version anchoring** — roadmaps are work-plans, not release-plans. Per `scope-control` no version numbers, target releases, or git tags inside any roadmap.
5. **Stances do not get roadmap blocks** — `founder-mode`, `staff-cross-cutting` are documented but never claim plate budget. Their source skills live under their owning persona.

## Out of scope (locked)

The map is **vision-complete for senior cognition**. The following
remain explicitly out of scope across all four roadmaps (Wings 1–4):

| Excluded | Why |
|---|---|
| Channel-tooling — SEO platforms, ad-platform editors, CRM workflow editors, marketing-automation builders | Tooling lives in vendor docs; we own the cognition, not the wiring |
| Junior / mid-tier curriculum | Different audience, different package; tier marker stays `senior` |
| Domain-specific configs — Stripe checkout, Salesforce object modeling, HubSpot automations, Figma plugin authoring | Skill of the tool, not skill of the senior |
| Personality / soft-skills — charisma, public speaking, "executive presence" | Not cognition-shaped; can't be skill-gated |
| Off-stack frameworks — Rails, Django, Spring, .NET | Package is Laravel / Next.js / PHP-anchored; sibling stacks fork their own package |
| C-suite governance — board management, M&A, exec-comp design | Out of senior-individual-contributor + senior-people-manager remit; would expand the package mission |

## Council iter-1 verdicts (resolved)

Council session: `agents/council-sessions/senior-personas-map-iter1.json`.
Verdicts folded per Anthropic-stronger heuristic where divergent;
convergent verdicts (Q3, Q5, Q6) folded directly.

| # | Question | Verdict | How it landed in v2 |
|---|---|---|---|
| Q1 | Persona count (was 22) | **22 → 19** — content-strategist folded into cmo (only 2 distinct skills, violated ≥3 rule); legal folded into strategist; people-ops + EM split into people-strategist (general) + EM (eng-specific) | Wing 3 → 4 personas; Wing 4 (merged) → 4 personas |
| Q2 | Wing 5 boundary | **MERGE Wing 5 → Wing 4** — rename to "Money, Strategy & Operations"; legal absorbed by strategist; people-strategist as peer of finance | Wing 4 + Wing 5 collapsed into single Wing 4 (4 personas) |
| Q3 | PO ↔ PM boundary | **3-line trigger rule** (convergent) | See "PO/PM trigger rule" below |
| Q4 | Cross-skill handoff gaps | **ADD incident → threat-model**; **EXTEND pricing → funnel** + **churn → forecasting** | Cross-skill map updated; Money loop now closes |
| Q5 | Slicing balance | **SPLIT into 4 roadmaps** (convergent) — Wing 3 separate from Wing 4 | Slicing proposal restructured |
| Q6 | Founder-cognition placement | **Cross-cutting STANCE, not persona** (convergent strong) | Removed as persona; documented under "Cross-cutting stances"; 3 source skills redistributed |
| Q7 | Channel-cognition vs tooling boundary | **3-test linter rule** (agent / vendor-independence / transfer) + 4 worked examples | See "Cognition vs tooling test" below |

### PO/PM trigger rule (Q3, Anthropic copy-paste)

| Trigger context | Persona | Why |
|---|---|---|
| **AC ambiguity** in a current ticket — what does "done" mean? | `product-owner` | Ticket-shape ownership; PO closes the AC with INVEST-decomposition |
| **Priority contested** across tickets — which of these three ships first? | `product-manager` | Roadmap-shape ownership; PM resolves via opportunity-solution-tree + north-star evidence |
| **Handoff** between the two | `opportunity-tree decision → INVEST tickets` — PM hands a tree-leaf to PO; PO renders it as ≥1 ticket with AC |

### Cognition vs tooling test (Q7, linter-citable)

A skill is **senior cognition** (in scope) iff it passes all three tests:

1. **Agent test** — could a senior practitioner do this **without any specific vendor**? (e.g. `pipeline-strategy` is YES — MEDDIC works in HubSpot, Salesforce, Pipedrive, paper.) Tooling is "the vendor's UI is the answer".
2. **Vendor-independence test** — does the cognition survive **changing the tool**? Salesforce → Pipedrive must not invalidate the skill content.
3. **Transfer test** — does the cognition transfer **across the package's anchor stacks** (Laravel + Next.js + PHP)? If a "skill" only makes sense in one ecosystem's tool ecosystem, it's tooling.

Worked examples:

| Candidate | Verdict | Reason |
|---|---|---|
| `pipeline-strategy` (MEDDIC qualifier shapes) | ✅ cognition | Vendor-independent; works in any CRM |
| `salesforce-flow-builder` | ❌ tooling | Vendor-locked; transfer fails |
| `editorial-calendar` (cadence + theme planning) | ✅ cognition | Vendor-independent; survives Notion → Airtable migration |
| `hubspot-workflow-author` | ❌ tooling | Vendor-locked; agent test fails |
| `paid-ads-targeting-cognition` | ✅ cognition | Audience-segmentation logic is platform-agnostic; channels swap, the cognition holds |
| `meta-ads-manager-ui` | ❌ tooling | Platform-specific UI navigation, not transferable |

Linter-quotable boundary prose:

> Senior cognition skills explain **how to think** about a domain;
> tooling skills explain **how to operate** a vendor product. The
> package owns cognition. Tooling lives in vendor docs.

## Next step

> Map v3.1 is locked. The four owner-roadmaps exist and are in execution:
>
> 1. `road-to-better-skills-and-profiles.md` (Wing 1 — Engineering, structural)
> 2. `road-to-unified-senior-roles.md` (Wing 2 — Product + Foundation, ready-for-execution)
> 3. `road-to-gtm-and-growth.md` (Wing 3 — GTM + Growth, ready-for-execution)
> 4. `road-to-money-strategy-ops.md` (Wing 4 — Money + Strategy + Ops, ready-for-execution)
>
> Cross-wing closure (shared identity, authoring standard, handoff
> contract, malice lint, orchestration mode) is tracked in
> `road-to-suite-closure.md`. Map updates land in v3.x deltas
> appended above; structural changes (new persona, new wing, scope
> shift) go through a fresh council round before they touch this
> file.
