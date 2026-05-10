---
complexity: structural
---


# Road to Unified Senior Roles

> Sibling roadmap to `road-to-better-skills-and-profiles.md`. Where the
> sibling lifts the **backend-engineering** dimension to senior level
> (Blocks A · C · D · F), this roadmap lifts the **non-engineering**
> dimensions (Marketing, Product, RevOps, Discovery, Tech-Writing) to
> the same senior bar. Goal: an end-to-end senior experience for the
> developer host — every role they collaborate with answers at senior
> level inside the same agent surface.

**Reference repo (deep-read 2026-05-05):**
[`coreyhaines31/marketingskills`](https://github.com/coreyhaines31/marketingskills)
— 40 marketing skills, 80+ tool integrations, MIT-licensed, Agent
Skills standard. Treated like AI #4 in the sibling roadmap: a
**benchmark**, not a copy target. We import patterns and senior
heuristics, not the marketing surface area.

## Status

`v2` — post-council (Anthropic `claude-sonnet-4-5` + OpenAI `gpt-4o`,
2026-05-05).
Verdicts on Q1–Q7 folded back below; sequencing locked. Block K starts
only after the sibling roadmap's **Block A (Personas) ships ≥ 50 %**
(A1–A4); Wave-2 personas (Block N here) compose on top of the same
persona spine and would bikeshed the schema if they raced A1.

## Scope shift vs the sibling roadmap

The sibling roadmap declares — and we honor — a hard **out-of-scope**
list including *"C-level / advisor skills"* and *"Marketing skills
(content-creator, SEO-audit, email-sequence)"*. This roadmap **does
not lift that line wholesale**. It opens a **narrow lane** under
three explicit boundaries:

| Lane | In | Out |
|---|---|---|
| **Senior cross-role patterns** | Context-spine, related-skills mechanic, hypothesis loops, mental-model library as reference doc | Channel-specific marketing surface (paid-ads, SEO-audit, email-sequence) |
| **PO / Discovery senior skills** | Customer-research, ICP-research, jobs-to-be-done, launch-comms (for our own releases) | C-level advisors (CEO/CTO/CFO), enterprise-deal-desk, board-comms |
| **Maintainer-side RevOps** | Issue triage, contributor lifecycle, release-comms, adoption-funnel for the package itself | Sales-pipeline tooling, CRM integrations, enrichment APIs |

The line we hold: **senior cognition and authoring discipline come in;
channel-distribution surface stays out.** The marketingskills repo's
40 skills become a *quarry*, not a *checklist*. Concretely: ~7–9
senior skills land here, not 40.

## Decisions (synthesized from deep-read)

Block sequencing locked by dependency. ICE table later in this file is
a sanity check on the chain, not a re-ordering gate.

| Block | Slot | Pre-condition | Inside 6-week plate? |
|---|---|---|---|
| **K — Cross-role foundation** | 1st | Sibling Block A ≥ 50 % (persona spine stable) | ✅ first 2 weeks (K1–K4) |
| **L — Senior PO / discovery / marketing skills** | 2nd | K1–K2 (context-spine + related-skills mechanic) | ⚠️ first **2** of 8 sub-steps inside (L1–L2); L3–L8 ready-to-start, complete in next plate (council Q6) |
| **N — Wave-2 personas (PO / RevOps / Tech-writer / Discovery-lead)** | 3rd, parallel-start with L's last sub-steps | Sibling Block A ≥ 100 % (A1–A6 shipped); K3 (cross-role glue) | ❌ first sub-step inside, rest in next plate |

The 6-week visible plate from the sibling roadmap stays load-bearing.
This roadmap's plate is **K + L1–L2 + N1 = 7 sub-steps** (post-council
Q6, sibling-velocity-honest: A1–A6 shipped at ~1 sub-step/week, so
9 sub-steps in 6 weeks was a 50 % over-commitment). Everything else
is *ready to start* but completes outside the plate by design.

## Patterns imported from `marketingskills` (locked)

These five patterns are the actual transfer. Skill count is secondary.

1. **Context-spine** — single source-of-truth doc that every role-skill
   references on entry, so users do not repeat foundational context.
   Marketingskills uses a `product-marketing-context.md` doc under
   the consumer's `.agents/` directory (external repo). We
   generalize to a `context-spine` mechanic with three slots:
   `product-context`, `team-context`, `repo-context` — composable,
   per-skill opt-in via a frontmatter field.
2. **Related-skills handoff block** — every senior skill ends with a
   `## Related Skills` table that names the next skill by trigger.
   Replaces ad-hoc "see also" prose. Lintable via `lint-skills`.
3. **Hypothesis loop** — ICE-scored backlog → run → playbook entry →
   re-prioritize. Marketingskills uses this for A/B tests; we
   generalize to *any* senior skill that proposes a change
   (refactor-architect, migration-architect, perf-investigator).
4. **Tools-registry pattern** — central `tools/REGISTRY.md` with
   MCP / API / CLI / SDK columns and per-tool integration guides.
   We adopt the **shape**, not the catalog. Our registry covers the
   tools our skills *actually use* (Composer, npm, GitHub API, Jira,
   Sentry, Grafana, etc.) — not 80 marketing SaaS APIs.
5. **Skill validator** — `validate-skills-official.sh` calls
   `skills-ref validate`. We already have `lint-skills`; the
   borrowable bit is the **public spec citation** (Agent Skills
   standard) and the **per-skill exit-code-aware loop**. Strengthens
   our existing linter; does not replace it.

## Roadmap horizon — 6-week plate

Same horizon contract as the sibling. Anything below is **out-of-horizon**
and lives as backlog under the relevant block — it does *not* receive
checklist items so the dashboard does not score it as work-in-progress.

| Block | Horizon | Notes |
|---|---|---|
| **K — Cross-role foundation** | In-plate | Weeks 1–2 (4 sub-steps, K1–K4) |
| **L — Senior PO / discovery / marketing skills** | Quarter in-plate | First **2** of 8 sub-steps in weeks 3–5 (L1–L2); L3–L8 ready-to-start, complete in next plate (council Q6) |
| **N — Wave-2 personas** | Out-of-plate (1 sub-step inside) | N1 in week 6; N2–N4 schema-bound on sibling A6, bulk lands next plate |

### Out of scope (confirmed)

- C-level advisors (CEO / CTO / CFO / CMO / COO).
- Channel-specific marketing surface: paid-ads, SEO-audit,
  email-sequence, ad-creative, programmatic-SEO.
- Sales-pipeline / CRM integrations (HubSpot / Salesforce / Apollo).
- Enrichment-API integrations (Clearbit / ZoomInfo / Clay).
- Composio MCP layer — we keep our own MCP allowlist via existing
  `mcp` skill and `tool-safety` rule.
- Marketplace distribution to claude.ai web — separate decision under
  `road-to-distribution-and-adoption.md`.
- 40-skill catalogue size — target for this roadmap is **7–9 senior
  skills + 4–6 senior personas + 5 cross-role patterns**.

## Phase 1: Unified Senior Roles execution

Block-level + sub-step checklist. Order: K → L → N. Sub-steps are
shippable artefacts (one pattern, one skill, one persona), matching
the sibling roadmap convention so `agents/roadmaps-progress.md`
scores real progress.

### Block K — Cross-role foundation (2 weeks, prep for L and N)

- [x] **K** — Cross-role foundation shipped (block marker; flips when K1–K4 are all done). Gated on sibling roadmap Block A ≥ 50 %.
- [x] **K1** — `context-spine` mechanic locked: contract doc under `docs/contracts/context-spine.md` (slot definitions, frontmatter field `context_spine: [product, team, repo]`, opt-in semantics, no implicit reads). **Tri-slot locked at 3 (council Q1, KEEP-3)**; slot additions require ≥ 2 shipped skills citing the need + ADR under `stable` policy.
- [x] **K2** — `lint-skills` extended: validates (a) `## Related Skills` block presence + format on every senior skill, and (b) frontmatter `tier: senior` field on senior skills (council Q7 — frontmatter-field over `-senior` suffix; clean skill names, tier in metadata). **Shipped under suite-closure Phase 2.4** as `lint_senior_tier_blocks()` in `scripts/skill_linter.py` — checks `## Related Skills` (with `**WHEN to use this**` + `**WHEN NOT to use this**` two-list pattern), `## When the agent should load this`, `## Output`. Schema (`scripts/schemas/skill.schema.json`) extended with `tier: senior` enum. Block-level rollout, not auto-applied to existing 147 skills; canonical contract is `.agent-src.uncompressed/rules/skill-quality.md` § Senior-Tier Required Structure (suite-closure Phase 2 path-corrected the previous `docs/contracts/skill-quality.md` reference).
- [x] **K3** — Cross-role glue: cite `docs/contracts/cross-wing-handoff.md` (suite-closure Phase 3.1) for the typed-handoff contract (initiator-skill → delegated-skill(input-shape) → output-artifact, lint rules, worktree boundary). Ship `docs/guidelines/cross-role-handoff.md` for the **wing-specific prose** only — when does a role hand off to another role, decision-tree, naming convention for `Related Skills` entries. **Includes the L4 / C8 composition boundary (council Q3)**: L4 fires when a request crosses two stakeholder lenses (engineering ↔ PO, PO ↔ ops, ops ↔ infra) and the trade-off is **not yet code**; C8 fires when the request **is already code** (PR open or draft branch); a C8 verdict that surfaces a stakeholder conflict (e.g. test-coverage fails but PO wants to ship) becomes input to L4 for escalation.
- [x] **K4** — `docs/contracts/mental-models.md` reference doc landed: **ranked Top-30 cross-role models (council Q2)** — 1 first-principles, 2 JTBD, 3 Pareto 80/20, 4 second-order thinking, 5 opportunity cost, 6 theory of constraints, 7 MVP, 8 build-measure-learn, 9 hypothesis-driven development, 10 reversible/irreversible decisions, 11 DX as first-class concern, 12 Conway's Law, 13 Occam's Razor, 14 Meadows leverage points, 15 signal/noise, 16 leading vs lagging indicators, 17 churn as health metric, 18 pull vs push systems, 19 shift-left, 20 latency vs throughput, 21 fail-fast, 22 data-informed (not data-driven), 23 user story mapping, 24 Kano model, 25 RICE, 26 North Star metric, 27 outcome over output, 28 Eisenhower matrix, 29 pre-mortems, 30 bias toward action. Cut from marketingskills: channel-specific (CAC/LTV, ad-auction, SEO keyword), C-suite strategy (Blue Ocean, Porter's Five Forces), sales pipeline (BANT, MEDDIC). Each model: ≤ 8-line summary + 1 citation example from a shipped skill. Cited by senior skills, not auto-loaded. Hard cap 30 — additions require removing one (zero-sum, R23).

### Block L — Senior PO / discovery / marketing skills (3 weeks in plate, 4–6 weeks tail)

Eight skills, ICE-ranked. **L1 + L2 sit inside the plate (council Q6,
sibling-velocity-honest); L3–L8 are *ready-to-start* and complete in
the next plate.** Skill names are clean — `tier: senior` lives in the
frontmatter, not the slug (council Q7, FRONTMATTER-FIELD). Each skill
ships with six artefacts: (1) persona link (Block N), (2) context-spine
declaration (K1), (3) related-skills block (K2), (4) one mental-model
citation from K4, (5) frontmatter `tier: senior`, (6) at least one
runnable example. **No skill ships without all six.**

- [ ] **L** — Senior PO / discovery / marketing skills shipped (block marker; flips when L1–L8 are all done).
- [x] **L1** — `customer-research` skill (`tier: senior`): discovery interviews, jobs-to-be-done framing, ICP synthesis, transcript-to-insight loop. Borrows hypothesis-loop pattern (P3) and mental-models JTBD/Pareto (K4). **Out:** persona-CRM enrichment, channel-targeting.
- [x] **L2** — `release-comms` skill (`tier: senior`): changelog-to-narrative, what-changed-and-why-it-matters framing for our own releases (the package itself + consumer release notes). Adopts marketingskills' "value-not-feature" heuristic without the channel surface.
- [ ] **L3** — `decision-record` skill (`tier: senior`): ADR-on-demand from a chat thread, includes context, options, decision, consequences, reversal-criteria. Replaces the ad-hoc ADR habit; cites mental-models second-order-thinking + theory-of-constraints. **Out-of-plate (council Q6).**
- [ ] **L4** — `stakeholder-tradeoff` skill (`tier: senior`): forces explicit trade-off naming when a request crosses two stakeholder lenses (engineering ↔ PO, PO ↔ ops, etc.). Output: trade-off matrix + recommendation + dissent log. Composes `code-review-multi-lens` (sibling C8) when the trade-off becomes code-shaped — boundary prose lives in K3 / `docs/guidelines/cross-role-handoff.md`. **Out-of-plate (council Q6).**
- [ ] **L5** — `discovery-interview` skill (`tier: senior`): interview-prep + question-bank + bias-audit + insight extraction. Subset of marketingskills' `customer-research-interviews`, scoped to product discovery (not market research). **Out-of-plate.**
- [ ] **L6** — `competitive-positioning` skill (`tier: senior`): package-vs-package comparison framework (the existing AI-#4-style deep reads, formalized). Inputs: target repo URL + our package + comparison axes. Output: sibling-roadmap-style "ours vs theirs" decisions table. **Out-of-plate.**
- [ ] **L7** — `voc-extract` skill (`tier: senior`, Voice of Customer): scans GitHub issues + PR discussions + Sentry error patterns and extracts recurring themes with citation per theme. **Bounded scope:** read-only on artefacts the host already has; no scrape, no SaaS API. **Chat-export sourcing (Discord / Slack) deferred to v2 pending privacy review (council Q5, SHIP-WITHOUT)** — see R30. **Out-of-plate.**
- [ ] **L8** — `launch-readiness` skill (`tier: senior`): pre-merge checklist + rollout plan + rollback criteria + ops handoff for any sibling-Block-A persona's release. Composes `finishing-a-development-branch` and `requesting-code-review`. **Out-of-plate.**

### Block N — Wave-2 senior personas (1 in-plate, 3–5 in next plate)

Wave-1 personas live in the sibling roadmap (Block A: senior-backend-architect, etc.).
Wave-2 personas are the **non-engineering counterparts** that compose
the same persona spine. Same 6-section schema, same override surface.

- [ ] **N** — Wave-2 personas shipped (block marker; flips when N1–N4 are all done). Gated on sibling Block A ≥ 100 % (A1–A6). Persona slugs stay clean (no `senior-` prefix); persona schema carries `tier: senior` per Q7.
- [x] **N1** — `product-owner` persona (`tier: senior`): identity = "owns the why and the what", critical rules = no AC drift / explicit trade-offs / decision-record on every scope change. **Capabilities (default-loaded, override-friendly per council Q4 — ABSORB):** `refine-ticket`, `estimate-ticket`, L3 (`decision-record`), L4 (`stakeholder-tradeoff`). Workflows = ticket-refinement-loop + roadmap-execution. Consistency rationale: matches sibling A2 (`backend-architect`) which absorbs `code-review-security` + `refactor-architect` as defaults. **In-plate** (last sub-step of the visible plate).
- [ ] **N2** — `discovery-lead` persona (`tier: senior`): identity = "owns the who and the problem", capabilities = L1 (`customer-research`) + L5 (`discovery-interview`) + L7 (`voc-extract`), mental-models = JTBD + first-principles + Pareto. **Out-of-plate.**
- [ ] **N3** — `tech-writer` persona (`tier: senior`): identity = "owns the said and the read", capabilities = L2 (`release-comms`) + agent-docs-writing + readme-writing + readme-writing-package, workflows = release-comms-loop + docs-audit-loop. **Out-of-plate.**
- [ ] **N4** — `revops-maintainer` persona (`tier: senior`): identity = "owns contributor-lifecycle and adoption-funnel for the package", capabilities = review-routing + receiving-code-review + L6 (`competitive-positioning`) + L8 (`launch-readiness`), workflows = triage-loop + release-loop. **Out-of-plate.** **Bounded:** package-internal RevOps only; no CRM / sales surface.

## Sibling cross-references (locked)

This roadmap composes with — never duplicates — the sibling roadmaps.
Each row names the **single** owner; if both sides need the artefact,
this roadmap **cites** the sibling, never re-implements.

| Topic | Owner | This roadmap's relation |
|---|---|---|
| Persona spine (6-section schema) | Sibling Block A1 | We **cite** the schema; Block N personas use it unchanged |
| Override semantics for personas | Sibling A1 | We cite; no override changes here |
| Wave-1 personas (engineering) | Sibling Block A | We cite; Block N composes Wave-2 on the same spine |
| `code-review-multi-lens` | Sibling Block C8 | We **compose** it from L4 (`stakeholder-tradeoff`); boundary prose lives in K3 / `docs/guidelines/cross-role-handoff.md` |
| Engine / state-schema | `road-to-post-pr29-optimize.md` | No engine changes here; skills are state-schema-additive only |
| Distribution / adoption | `road-to-distribution-and-adoption.md` | We do **not** drive adoption; release-comms (L2) is for our own releases, not marketing channels |
| `domain:` taxonomy | Sibling Block B1 | New skills declare `domain:` from the locked taxonomy; no new domain values without a sibling-B1 contract bump |
| Skill-linter rules (`lint-skills` task) | Sibling Block B + this Block K2 + suite-closure Phase 2.4 | K2 **extends** the linter; canonical contract is `.agent-src.uncompressed/rules/skill-quality.md` § Senior-Tier Required Structure (path corrected from `docs/contracts/skill-quality.md` in suite-closure Phase 2) |

## ICE table for Phase 1

Impact (1–5: leverage on the unified-senior-roles goal — cross-role
depth + senior bar), Confidence (1–5: clarity of deliverable +
dependencies known), Ease (1–5: estimated effort inverted — 5 = ≤ 1
week, 1 = ≥ 5 weeks). Score = I × C × E. **Median score 36.**
Sequencing locked by dependency (K → L → N); the table is a sanity
check on the chain, not a re-ordering gate.

| Block / sub-step | I | C | E | Score | Notes |
|---|---:|---:|---:|---:|---|
| **K1 — context-spine contract** | 5 | 4 | 4 | **80** | Highest leverage; unblocks L + N + cross-cuts every senior skill |
| **K4 — mental-models reference doc** | 4 | 5 | 4 | **80** | Cheap, citation-only, unblocks senior framing across L |
| **K2 — `lint-skills` Related-Skills + `tier` check** | 4 | 4 | 4 | **64** | Lintable handoff; cheap once K1 ships |
| **K3 — cross-role glue guideline** | 3 | 4 | 4 | **48** | Documentation; carries L4/C8 boundary prose; necessary, not the blocker |
| **L1 — `customer-research`** | 4 | 3 | 3 | **36** | High value; medium effort; gates discovery work |
| **L2 — `release-comms`** | 3 | 4 | 4 | **48** | Cheap; immediate use on next release |
| **L3 — `decision-record`** *(out-of-plate)* | 4 | 4 | 4 | **64** | Most reusable single skill; deferred to next plate per Q6 |
| **L4 — `stakeholder-tradeoff`** *(out-of-plate)* | 4 | 3 | 2 | **24** | Composes sibling C8; deferred to next plate per Q6 |
| **L5–L8 — out-of-plate** | 3 | 3 | 2 | **18** | Each lands in next plate; ICE held for re-eval at plate boundary |
| **N1 — `product-owner` persona** | 4 | 4 | 3 | **48** | First Wave-2 persona; unblocks remaining N |
| **N2–N4 — out-of-plate** | 3 | 3 | 2 | **18** | Schema-bound on sibling A6; bulk lands next plate |

**Inside-plate set:** K1–K4 + L1–L2 + N1 = **7 sub-steps** (council Q6,
sibling-velocity-honest — A1–A6 shipped at ~1 sub-step/week, so the
6-week plate holds 6–7, not 9). Visible plate: K (weeks 1–2) + L1–L2
(weeks 3–5) + N1 (week 6). L3–L8 + N2–N4 are the **ready-to-start tail**
that completes in the next plate by design. L3 + L4 stay highest-ICE
candidates for the next plate's first slots.

## Risk register

Forward-looking risks for Phase 1 execution. Risk numbers are stable
identifiers — referenced by sub-step working notes. Continues the
sibling roadmap's R1–R12 numbering (this roadmap owns R20–R29) so
cross-references between roadmaps stay collision-free.

| # | Risk | Block | Likelihood | Impact | Mitigation | Owner-marker |
|---|---|---|---:|---:|---|---|
| R20 | **Marketing scope creep** — Block L drifts from "senior cognition" into channel-marketing surface (paid-ads, SEO, email) under user pressure | L | M | H | "Out of scope" table at top is **load-bearing**; new L sub-steps require explicit citation + sibling-roadmap exemption; channel-shaped requests routed to a future `road-to-marketing-distribution.md` (not yet open) | (out-of-scope table) |
| R21 | **Persona-spine bikeshed (Wave-2)** — Block N debates schema deviations to fit non-engineering identities, drains weeks before any persona ships | N | M | M | N is **schema-locked** to sibling A1; deviations require sibling-roadmap ADR, not Wave-2-only edits; N1 ships against unmodified schema as proof | A1 (sibling) |
| R22 | **Context-spine sprawl** — K1 slot count grows from 3 (product/team/repo) to 8+ as new senior skills request dedicated slots | K1 | M | H | Slot count locked at 3 in the contract; new slots require a contract bump (`stable` policy) **and** ≥ 2 skill citations as evidence of need | K1 |
| R23 | **Mental-models doc bloat** — K4 starts at ~25 models, swells to the full 60+ from marketingskills, becomes unreadable | K4 | M | M | K4 ships with hard cap of **30 models**; additions require removing one (zero-sum); each model has ≤ 8-line summary + 1 citation example | K4 |
| R24 | **Marketing-skill copy temptation** — L sub-steps drift toward verbatim adaptation of marketingskills/* SKILL.md instead of senior-cognition extraction | L | H | H | Each L sub-step PR template requires a "what we kept / what we dropped" diff vs the source skill; reviewers reject sub-steps without it | L |
| R25 | **Sibling A6 slip** — Wave-2 personas (N2–N4) blocked indefinitely if sibling A6 drags past the 6-week plate | N | L | M | N2–N4 are **explicitly out-of-plate**; if A6 slips > 4 weeks, N is deferred to the plate after, not held in limbo; N1 still ships against A1–A5 | (sibling) |
| R26 | **Related-Skills lint false-positives** — K2 check trips on legitimate exceptions (rules, contexts, templates) | K2 | L | L | K2 scope is **senior skills only** (frontmatter `tier: senior` opt-in per Q7); rules/contexts/templates exempt by construction | K2 |
| R27 | **Cross-role handoff explosion** — K3 decision-tree grows into a meta-skill that supersedes individual related-skills blocks | K3 | L | M | K3 is **reference doc**, not a skill; no auto-trigger; senior skills cite K3 in their related-skills block, not the reverse | K3 |
| R28 | **Two roadmaps, one maintainer** — sibling + this roadmap competing for the same execution slots, both stall | meta | M | H | This roadmap's plate is **K + L1–L2 + N1 = 7 sub-steps** (post-council Q6 cut); sibling stays prime; if a week's capacity slips, this roadmap defers, not the sibling | (meta) |
| R29 | **Council review re-opens settled scope** — AI #2 / AI #3 re-litigate the "channel surface stays out" line and the roadmap re-balloons | meta | M | M | Review prompt fences the question explicitly: "challenge the **execution** of the locked scope, do not re-open it"; scope changes require new ADR | (council prompt) |
| R30 | **L7 chat-export user demand** — consumers ask for Discord / Slack ingestion before privacy framework exists | L7 | M | L | L7 ships GitHub + PR + Sentry only (council Q5, SHIP-WITHOUT); chat-export deferred to v2 pending privacy review + ≥ 1 consumer citing a privacy-cleared export format | L7 |

## Council verdicts (resolved 2026-05-05)

Iter-1 review: Anthropic `claude-sonnet-4-5` + OpenAI `gpt-4o`,
2026-05-05.
Q1–Q6 resolved per Anthropic-stronger / convergent answers; Q7 resolved
per GPT-4o (Anthropic truncated at max-tokens). Out-of-scope table
stayed locked — no Q8 raised.

| # | Question | Verdict | Folded into |
|---|---|---|---|
| Q1 | K1 slot model | **KEEP-3** + contract clause: slot additions need ≥ 2 skill citations + ADR | K1 sub-step + R22 mitigation |
| Q2 | K4 mental-model selection | **Ranked Top-30** (concrete list locked in K4); cuts: channel-models, C-suite strategy, sales-pipeline | K4 sub-step + R23 mitigation |
| Q3 | L4 vs sibling C8 boundary | **4-line disambiguation prose**: L4 fires when not-yet-code, C8 when code-shaped, C8 → L4 on stakeholder conflict | K3 sub-step + L4 description |
| Q4 | N1 scope (absorb vs cite) | **ABSORB** as default-loaded, override-friendly skills (sibling A2 consistency) | N1 sub-step |
| Q5 | L7 chat-export | **SHIP-WITHOUT** — GitHub + PR + Sentry only; chat-export deferred to v2 under privacy review | L7 sub-step + new R30 |
| Q6 | Plate fit (9 vs honest) | **Drop to 7** — K1–K4 + L1–L2 + N1; L3–L4 deferred to next plate (sibling-velocity math: ~1 sub-step/week) | Plate tables + ICE table + R28 |
| Q7 | `-senior` suffix vs `tier:` field | **FRONTMATTER-FIELD** — clean skill names, `tier: senior` in metadata; no junior/senior collision later | K2 sub-step + all L/N names + R26 |

## Next step

> Status flips to `ready-for-execution`. Block K1 starts after sibling
> Block A ≥ 50 % (A1–A4 shipped). The 7 in-plate sub-steps are
> K1–K4 + L1–L2 + N1; L3–L8 + N2–N4 are ready-to-start and complete
> in the next plate. No further council round needed before execution.
