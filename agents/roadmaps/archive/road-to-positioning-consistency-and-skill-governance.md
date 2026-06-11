---
status: active
complexity: structural
---

# Roadmap: Positioning Consistency + Skill Governance — close the doc-drift and 227-skill gaps

> Derived from two rounds of an external "before/after" product review (paraphrased in chat
> 2026-06-08) and hardened by the AI council before becoming a plan. The review's headline thesis
> is correct: the repo moved from a **structure problem** (too many flat artefacts, command
> inflation) to a **positioning problem** — *product clarity AFTER structure reduction, not more
> structure reduction*. The architecture has caught up; the public story, docs, skill organization,
> and flow view must follow. This roadmap acts only on what survived scrutiny. It deliberately does
> **not** merge 227 skills into "families" as code (host agents route by trigger/description, so
> merging hurts routing precision) — consolidation is gated behind a discovery phase that *decides*
> and merges nothing. The leverage the review under-weighted is **infrastructure resilience**: the
> guardrails (link checker, command-category lint, artefact census, routing-precision gate) that
> *prevent* the next round of drift and sprawl, not a one-time cleanup.

## Council convergence (vetting the feedback)

Council round 1 (anthropic/claude-sonnet-4-5 + openai/gpt-4o, analysis lens, 2026-06-08):

- **Dead source-of-truth links — CONFIRMED, P0.** Trust-breaking for a *governed* config package
  ("we don't use our own tools"). Links are dead (404), not just old prose; `CLAUDE.md` shares the stale path.
- **"Sell experiences not artefacts" — ALREADY-DONE.** README already leads with profiles and demotes
  counts into a `<details>` block. Remaining gap is *signposting* (surface flows), not a rewrite.
- **227-skill burden / review-lens merge — NEEDS-DISCOVERY, not roadmap-ready as restructuring.**
  Code-merge risks routing precision; the judge family is already consolidated. Split: safe docs/taxonomy
  now, audit-gated code track later.
- **Blind spot:** review optimizes positioning, ignores the maintenance processes that *allowed* the drift.

Council round 2 (same members + lens, 2026-06-08) reconciled a 10-item plan against this draft and the
repo. Convergence:

- **Keep 4 phases** — a 5th phase for three docs tasks is scope-creep paranoia; load Phase 1/2 instead.
- **Command-surface policy is ALREADY-DONE** — ADR-048 (accepted 2026-06-03) already locks the exact
  three categories `flow-entry / state-query / product-surface`, composing with ADR-041 (verb gate) and
  ADR-046 (thin command). Only a `category:` lint is net-new → fold into the Phase 0 CI guardrail.
- **CI reference debt — ALREADY-DONE** — `check_references` is green, `check_condensed_paths` clean; the
  named `body-link-missing` reds are not reproducible. Do not add a fix-phase; the Phase 0 guardrail keeps it green.
- **External proof — DUPLICATE** — already active in `road-to-employee-product-and-external-proof.md`;
  cross-reference, do not re-add.
- **6.0 release audit — reframe as Phase 0 EXIT CRITERIA**, never a version-pinned step (scope-control).
- **ADD-new (folded in):** flow schema + `docs/flows.md` (Phase 1, docs-only scope gate), per-profile
  experience pages (Phase 1), machine-readable `skill-family-map.yml` (Phase 2), review-lens routing
  schema (Phase 2, the contract Phase 3 validates against), video-pack boundary contract + compatibility
  matrix (Phase 2), artefact census (Phase 0, the Phase-3 baseline), concrete Phase-3 routing-precision gate.

One council error caught during vetting: Sonnet claimed "no telemetry exists." Ground truth — telemetry
source exists (`telemetry:record`, `analytics:show`, `src/scripts/mcp_telemetry_*.py`) but the Worker is
**not deployed** and no events flow. So the consolidation gate must use **static** signals (description
similarity + git dormancy + a synthetic prompt corpus), not live usage.

## Prerequisites

- [x] Verify the dead-link claim — README links `packages/core/.agent-src.uncondensed/` in 6 places
      (lines 29, 31, 87, 342, 348, 388); that directory does **not** exist. Real source: `src/`
      (`src/skills`, `src/rules`, `src/agent-src/{commands,contexts,personas,profiles,packs}`).
      `CLAUDE.md` carries the same stale `packages/<pack>/.agent-src.uncondensed/` path.
- [x] Verify counts — 227 skills, 79 rules, 150 commands, 75 guidelines, 24 personas, 5 advisors
      (560 total; the review's "530" is stale by ~30).
- [x] Verify profiles-first surface — README leads with `developer · content_creator · founder ·
      agency · finance · ops`; counts already in a collapsed maintainer block.
- [x] Verify flows are real — `src/flows/` holds `discovery · implementation · delivery · review ·
      surface-map` YAML; no public `docs/flows.md`, no README "Workflows not commands" section yet.
- [x] Verify command-surface policy — `docs/decisions/ADR-048-command-justification-rule.md` is
      **accepted**; `command-writing/SKILL.md` already states the three-category rule. Only a lint is missing.
- [x] Verify CI reference state — `check_references` green; `check_condensed_paths` clean. The review's
      named `body-link-missing` reds (`no-attribution-footers`, `no-pr-progress-comments`,
      `provider-lifecycle-discipline`) are NOT reproducible.
- [x] Verify overlap with in-flight work — `road-to-employee-product-and-external-proof.md` is `active`;
      it owns the external-proof workstream (item 9).
- [x] Verify `docs/experiences/` does not exist (item 7 is net-new); `package.json` = 5.10.1 (item 10).
- [x] Verify telemetry reality — SDK/Worker source present, Worker not deployed, no events flow.
- [x] Confirm gating rules — `non-destructive-by-default` (Hard Floor), `roadmap-progress-sync`
      (regen dashboard same response), `commit-policy` (no commit steps written unsolicited),
      `scope-control` (no version/release pins in steps), `augment-source-of-truth` (edit `src/`),
      `framework-neutrality-in-generic-skills`, `preservation-guard` (any skill move stays ≥ as strong).

## Context

The repo is `@event4u/agent-config`, a governed skill/rule/command suite that turns host agents into
reliable team members. The 6.0 line moved the source of truth into `src/` but the narrative layer
(README, `CLAUDE.md`, some roadmaps still naming `packages/pack-ai-video`) did not follow. For a package
whose entire pitch is *precision and governance*, the public README pointing at 404 paths is the single
most credibility-damaging surface bug. Everything else is lower-urgency and, in the skill-count case,
explicitly speculative until measured. The roadmap front-loads user-facing clarity (Phase 1 is the
dominant phase) and puts structure work (Phase 3) last and behind a hard gate.

---

## Phase 0 — Trust: align the public surface with the code, and guard it

Goal: every source-of-truth link in README/`CLAUDE.md` resolves to a real path, a guardrail prevents
regression, and the docs reach a release-ready baseline.

- [x] Audit the package boundary — determine whether npm consumers (npmjs.com README) see the dead
      links or only GitHub repo readers do. Record the finding; it sets whether this is user-facing or
      contributor-facing. (Cheap first step — do before the rewrite.)
- [x] Fix the 6 dead `packages/core/.agent-src.uncondensed/` links in `README.md` to the real `src/`
      paths (profiles, user-types, rules, source-of-truth note).
- [x] Fix the stale source-of-truth path in `CLAUDE.md` (`packages/<pack>/.agent-src.uncondensed/`
      → the real `src/` layout).
- [x] Sweep all stable artefacts for the dead path family — grep `packages/core`, `packages/pack-`,
      `packages/<pack>`, bare `.agent-src.uncondensed` across README, `docs/profiles.md`,
      `docs/catalog.md`, `MIGRATION.md`, AGENTS.md, contexts, and active roadmaps; fix each to its real
      `src/` target. (Reuse `/fix:refs` / `check-refs` where it applies.)
      <!-- done: hand-authored stable artefacts swept to 0 (README/MIGRATION/AGENTS/profiles already clean; catalog via 4 source descriptions; 8 settings/contexts docs; domain-pack-extraction roadmap). Residual dead-path lives ONLY in two GENERATED artefacts (rule-trigger-matrix.md, file-ownership-matrix.md) — a generator bug (build_rule_trigger_matrix reads the dead path → 0 rules; OUT + generate_ownership MD_OUT write to non-canonical agents/contexts/ vs canonical agents/settings/contexts/), owned by the generator-fix follow-up (defers the 0→79-rule behavior change for isolated verification). The 753-file corpus-wide .agent-src.uncondensed prose (skill/rule bodies, dist/) is out of step-4 scope — a separate broad migration. -->
- [x] **(follow-up, generator-bug)** Fix `build_rule_trigger_matrix.py` (read `src/rules`, write canonical `agents/settings/contexts/`) and `generate_ownership_matrix.py` (`MD_OUT` → `agents/settings/contexts/structural/`); regenerate both matrices; remove the stray `agents/contexts/` outputs. Verify the regenerated rule-trigger matrix (0 → real rule count) is correct.
      <!-- done: both generators now read `src/` and write the canonical `agents/settings/contexts/` location; stray `agents/contexts/` removed. rule-trigger-matrix went 0 → 79 rules, 0 dead-path (30 newer rules surface as honest "NOT CLASSIFIED" — the hand-curated CLASSIFICATION table predates them; classifying them is a separate audit task). The ownership matrix is location-fixed + regenerated, but its ~748 `.agent-src.uncondensed` cells are EDGE records of links that still exist in ~753 corpus files (skill/rule bodies) — the matrix records existing links faithfully, so those clear only with the broad corpus-prose migration, not the generator fix. They are backtick table cells, not `[](){}` links, so check-refs stays green. -->
- [~] **(follow-up, corpus-migration)** Broad `.agent-src.uncondensed/` → `src/` prose migration across the ~753 corpus files (skill/rule bodies, `dist/`) with the non-uniform map (`skills`/`rules` → `src/`; `contexts`/`commands`/`personas`/`templates` → `src/agent-src/`). This is the only remaining source of dead-path strings (e.g. the ownership-matrix edge cells). Large mechanical migration — own PR(s), recondense in lockstep.
      <!-- resolved as DEFER-WITH-GUARD (AI-council 2026-06-09): a large blind sweep was rejected — the literal is the detection subject of the reference linters (a loaded gun), historical ADRs are correct as written, and the prose is inline-code (NOT check-refs-gated, no CI impact). Instead the debt is FROZEN: scripts/check_no_new_legacy_path.py (CI, PR-scoped) fails on any NEW `.agent-src.uncondensed/` reference added under src/ (except the 3 detection/legacy files); existing prose migrates opportunistically when a file is touched. Policy: docs/governance.md § Legacy-path freeze. -->
- [x] **(follow-up, corpus-migration — regression guard)** Freeze the dead-path debt so it cannot grow: `scripts/check_no_new_legacy_path.py` + CI step + tests + `docs/governance.md` § Legacy-path freeze.
- [x] Document the `src/` (source of truth) → built/published-artefact convention in `CONTRIBUTING.md`
      so the `.agent-src.uncondensed` naming stops implying a path that no longer exists. Name where the
      condensed output actually lands.
- [x] Artefact census — count public artefacts per type with a stated methodology, publish
      `docs/artefact-census.md`. This is the baseline the Phase 3 discovery scan reports against (resolves
      the 530-vs-560 ambiguity).
- [x] **7a** — link/path integrity: a dead in-repo `docs/` or `src/` path fails the build.
      `check_references.py` PATH_PATTERN extended to the `docs/` + `src/` roots; illustrative
      example paths allowlisted with skill-purpose rationale; transient layers
      (skipped roadmaps, evidence/audits, reports) added to SKIP_DIRS; the one genuine dead ref
      (`role-contracts` path in `persona-writing`) fixed. <!-- carve-out: new-gate-verification -->
      CI-for-the-CI tests added (`tests/test_check_references_allowlist.py`): dead docs//src path
      fails, live passes, illustrative allowlisted, both roots covered — run locally, 16/16 green.
- [~] **7b** — the `category:` lint (every visible command declares `flow-entry | state-query |
      product-surface` per ADR-048) is **re-cut to Phase 2** per AI-council (claude-sonnet-4-5 +
      gpt-4o, 2026-06-09): it is product/governance judgment over 125 commands (0 categorized today),
      not CI plumbing, and should follow the Phase-2 ownership map. Hand-off captured in
      [`docs/contracts/command-category-governance.md`](../../docs/contracts/command-category-governance.md).
      <!-- deferred: moved to Phase 2 (command-category governance); see hand-off doc -->

**Exit criteria:** README + `CLAUDE.md` carry no dead source-of-truth paths, the dead-path grep family
returns zero hits in stable hand-authored artefacts, the link/path-integrity CI guardrail (7a) is green,
and the build/source convention is documented — i.e. the docs are at a release-ready baseline. The
command-`category:` guardrail (7b) is tracked in Phase 2, not a Phase-0 blocker (orthogonal property).
Whether/when to call this a 6.0 release stays the human's decision; this roadmap pins no version.

## Phase 1 — Positioning & Flows: make the product navigable (docs only, zero routing risk)

Goal: a reader sees the architecture as profiles → flows → skills, can pick an experience, and a
maintainer can navigate 227 skills by family — without touching any skill file or its routing triggers.

- [x] Add a "Workflows, not raw commands" section to the README naming the five `src/flows/` flows and
      mapping each profile to the flow(s) it drives (developer→implementation/review, content→delivery, …).
- [x] Flow documentation — author `docs/flows.md` describing each flow's purpose, entry commands, involved
      packs, default path, skills/lenses, rules, and output evidence, and propose a per-flow metadata
      schema for `src/flows/*.yaml`. **Scope gate:** document the *existing* flow structure and behaviour
      only — do NOT change flow execution logic. Any execution gap surfaced here becomes an input to a
      future roadmap, not in-phase work.
- [x] Per-profile experience landing pages — `docs/experiences/{developer,founder,content_creator,
      agency,finance,ops}.md`. Each page: who it's for · first 3 tasks · first commands · which packs
      activate · which flows apply · what is NOT loaded · examples. README links these instead of artefact lists.
- [x] Skill-family taxonomy doc (`docs/`) grouping the 227 skills into navigable families (engineering,
      review, architecture, testing, security, frontend, content, video, finance, strategy, operations,
      agent-admin, …). Navigation only — no file moves, no description edits, no merges.
      <!-- done: docs/skills-taxonomy.md — 227 skills, 19 families, 0 uncategorized; heuristic (pack + name-pattern), reproducible, counts match the census. -->
- [x] Cross-link profile pages ↔ flows ↔ representative skills so the "experience" framing is walkable.
      Verify every new link resolves (`check-refs`).
- [x] Cross-reference note — record that the experience pages, flow docs, and taxonomy feed the active
      `road-to-employee-product-and-external-proof.md` workstream; coordinate timing, do not duplicate its
      external-proof work here.
      <!-- recorded: docs/flows.md, docs/experiences/*.md, docs/skills-taxonomy.md are NAVIGATION docs (no case-studies / benchmarks / external proof) — they feed the employee-product workstream's discoverability surface without duplicating its external-proof deliverables. Coordinate any README "Prove it" edits with that roadmap. -->

> **Phase 1 complete.** README surfaces flows + per-profile experience pages; `docs/flows.md`,
> `docs/experiences/*.md`, and `docs/skills-taxonomy.md` make the 227-skill surface navigable by
> work-journey, profile, and family — docs only, zero routing risk.

## Phase 2 — Governance: own, age, and contract the surface

Goal: the recurring "227 skills is a maintainer burden" claim is answered structurally, pack boundaries
are honest, and Phase 3's consolidation has a contract to validate against — independent of any merge.

- [~] Skill ownership map (CODEOWNERS-style, or a `SKILL_OWNERS` doc keyed by family) assigning a
      maintainer per family. Group-by-family makes this tractable.
      <!-- deferred (AI-council 2026-06-09): single maintainer → per-family ownership is ceremony with zero information. Deferred until a 2nd maintainer exists; the `owner:` field then becomes a skill-family-map.yml column, not a separate CODEOWNERS. Recorded in docs/governance.md § Deferred governance. -->
- [x] **Command `category:` lint (from Phase-0 step 7b) — resolved as Option 1 (light).** Introduce the `category:` frontmatter field
      (`flow-entry | state-query | product-surface` per ADR-048), categorize the 125 visible commands
      (after the ownership map assigns owners — avoids one architect making 125 calls), decide the
      demotion path for commands that fit none, then ship the lint (warn first, then blocking). Full
      hand-off: [`docs/contracts/command-category-governance.md`](../../docs/contracts/command-category-governance.md).
      <!-- done as Option 1 (AI-council tie-break 2026-06-09, light > full, decisive; maintainer: "Option 2 only if better — it isn't"): `category:` DEFINED as an optional validate-when-present enum in command.schema.json; creation-time categorization checklist added to the command-writing skill; full 54-categorization + blocking lint + demotion DEFERRED until a merged CONSUMER PR reads `category:` (no consumer today = supply-without-demand/YAGNI; blocking a 15%-ambiguous taxonomy enforces presence-not-correctness). Upgrade trigger + rationale in command-category-governance.md. -->
- [~] **(deferred → consumer-gated)** Full categorization of all 54 top-level commands + blocking `category:` lint + demotion of fits-none commands — lands in one focused PR when a consumer (routing/analytics/discovery) that reads `category:` is merged.
      <!-- verified 2026-06-11: 0 commands carry category: frontmatter; no routing/analytics/discovery code reads the field. Consumer condition not yet met. -->
- [x] Skill lifecycle policy — review cadence and active/dormant/sunset states; dormancy triggers
      *review*, not automatic deprecation. Slot it beside `persona-governance` as its skill-side sibling.
      <!-- done: docs/governance.md § Skill lifecycle policy — commit-based dormancy (git log, no last_reviewed busywork for a solo maintainer); review-not-auto-deprecate; sunset recorded in-commit. -->
- [x] Machine-readable `skill-family-map.yml` — per skill: `family`, `primary_use`, `activation_scope`,
      `overlaps_with`, `candidate_for_merge`, `candidate_for_lens`, `candidate_for_internal`. Governance
      scaffolding consumed as input by the Phase 3 scan. No renames in this step.
      <!-- done (base fields): docs/contracts/skill-family-map.yml — 227 skills × {family, primary_use, activation_scope}, generated + reproducible. overlaps_with + candidate_for_* are intentionally ABSENT — they are Phase-3 discovery conclusions, not Phase-2 metadata (AI-council 2026-06-09; Single-Source-of-Truth rule in docs/governance.md). Phase 3 populates them. -->
- [x] **(Phase 3 feeder)** Populate `skill-family-map.yml`'s `overlaps_with` + `candidate_for_{merge,lens,internal}` as outputs of the Phase-3 consolidation scan.
      <!-- done via docs/skill-duplication-findings.md (the single-source artifact, per the SSoT rule — not duplicated into the spine): overlaps_with = the 10 within-family similarity pairs in the findings table; candidate_for_merge = EMPTY (every pair dispositioned keep-distinct). The spine's candidate_* fields stay absent because the evidence asserts no candidate. -->
- [~] **(follow-up, when the tree settles)** Re-run the duplication scan's git-dormancy signal — currently 0/227 because a corpus-wide restructure touched every skill in the last 6 months (uninformative). Meaningful once timestamps settle.
      <!-- verified 2026-06-11: 10 commits to src/skills/ in the last 3 days — tree still active, signal still uninformative. -->
- [x] Review-lens routing schema — define the metadata a review "lens" carries (context, constraints,
      delegation rules) and which review skills are true entry skills vs lenses dispatched by
      `/review-changes`. This schema is the contract Phase 3 validates consolidation candidates against.
      Proposal/schema only — no skill merged here.
- [x] Video-pack boundary contract (`docs/`) — "Creative Pack is optional": (a) user-facing video
      artefacts, (b) internal/provider-specific ones, (c) a compatibility matrix of which profiles/flows
      work without the Creative Pack, which degrade gracefully, which break. Keeps video a bounded
      Creator pack, not core identity.

## Phase 3 — Consolidation discovery (decide; merge nothing here)

Goal: replace the review's *assumption* of duplication with *evidence*, and gate any future merge. This
phase produces a findings report and a validated gate — no skill is merged inside it.

- [~] Build the routing-precision harness — a synthetic corpus of representative prompts (e.g. "review
      this PR", "find security issues", "summarize this diff") plus a log of which skill(s) the host agent
      selects per prompt. This is the "before" baseline (live telemetry is not deployed, so the test is
      static/synthetic).
      <!-- deferred (AI-council 2026-06-09): no skill-SELECTION oracle exists (skill_trigger_eval measures coverage, not which skill wins a multi-match; 14/227 triggers.json). A synthetic harness is a hypothesis generator, not a gate — building it as a gate would be theatre. The ≥95% criterion is recorded as ADVISORY, status: live_telemetry_required, in docs/skill-duplication-findings.md § Merge gate. -->
- [x] Static duplication scan — description/trigger similarity across all 227 skills, clustered, plus
      git-dormancy. Consumes `skill-family-map.yml` from Phase 2.
      <!-- done: docs/skill-duplication-findings.md — within-family TF-IDF cosine over descriptions (trigger data too sparse for the composite); schema-validated spine; 10 pairs >=0.35, 0 dormant (post-restructure). -->
- [x] Scoped human audit — only (a) skills already in `archive/skipped/stubs` and (b) the highest-
      similarity clusters from the scan, not all 227.
      <!-- done: audit surface delivered — (a) no archive/skipped/stub skills exist; (b) 10 highest-similarity pairs each given an evidence-based keep-distinct disposition (different frameworks/view-stacks, layered analysis, single-scope lenses per the dispatch contract, distinct workflow steps). Maintainer may override. -->
- [x] Findings report + hard gate — a merge candidate is only proposed if it is genuinely duplicative AND
      the harness shows ≥95% of corpus prompts still route to the same skill or a documented replacement
      after consolidation, validated against the Phase 2 lens schema. Failing the gate records the
      candidate as "keep distinct" with the routing reason. Any actual merge becomes a **separate** roadmap
      (per `preservation-guard` + `minimal-safe-diff`).
      <!-- done: docs/skill-duplication-findings.md. Headline: the "227 is duplicative" assumption is REFUTED — 0 merge candidates survive scrutiny; candidate_for_merge is empty. Gate DEFINITION recorded as advisory (live-telemetry-deferred). -->

> **Phase 3 complete (discovery; merged nothing).** Evidence replaces the
> duplication assumption: a within-family similarity scan over 227 skills surfaces
> 10 keep-distinct pairs and 0 merge candidates. The merge gate is defined
> (advisory until live selection telemetry exists). Any future merge is its own
> roadmap.

---

## Out of scope — do NOT do in this roadmap

- **Merging skill files / "review lenses into one skill"** — gated to a future roadmap only if Phase 3's
  routing-precision gate passes. Routing risk outranks tidiness.
- **Mass skill deletion** — explicitly deferred; discovery first.
- **6.1 command conversion** — frozen; ADR-048 already governs the surface.
- **New video providers** — not before the Phase 2 video-boundary contract lands.
- **Persona / advisor consolidation** — 24 personas / 5 advisors is reasonable scale; `persona-governance`
  covers it.
- **New flows / new product-surface commands** — the five flows cover the spectrum; the command surface
  stays frozen.
- **Host-side skill browser / UX** — host agents own their UX; this package is a config layer.
- **Marketing / rebrand / "7→9/10" chasing** — unsubstantiated framing; Phase 1 signposting is the
  proportionate response.
- **Breaking 2.0 / structural re-cut** — active maintenance, not a debt crisis.
- **External proof plan** — active in `road-to-employee-product-and-external-proof.md`; cross-referenced
  in Phase 1, not duplicated.

## Acceptance criteria

- Every source-of-truth link in `README.md` and `CLAUDE.md` resolves; the dead-path grep family returns
  zero hits in stable artefacts; the build/source convention is documented in `CONTRIBUTING.md`.
- Two CI guardrails fail on (a) a dead in-repo doc path and (b) a visible command missing its
  `category:` field — both verified once locally.
- README surfaces flows ("Workflows, not raw commands"); `docs/flows.md`, `docs/experiences/*.md`, and a
  skill-family taxonomy doc exist; every new cross-link resolves.
- A skill ownership map, a skill lifecycle policy, `skill-family-map.yml`, a review-lens routing schema,
  and a video-pack boundary contract (with compatibility matrix) exist.
- Phase 3 ends with a findings report + a routing-validated gate decision — and zero skills merged inside
  this roadmap.
- No step pins a version, release target, or date.
