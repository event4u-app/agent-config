---
complexity: structural
status: ready
---

# Roadmap: Lean Agent Init — tool-not-agent routing, worker stop-loss, spawn-payload truth

> **Source:** maintainer feedback session `agents/tmp.old/ai-pairing/`
> (`ai-pairing.txt` + `subagent-usage.png` live token evidence), 2026-07-28.
> The session produced five draft artifacts (sparring-critic,
> auto-orchestration, learning-loop, quality-stack consolidation,
> lean-agent-init); this roadmap is the council-cut first slice.
> **Council:** AI council debate 2026-07-28 (anthropic/claude-sonnet-4-5 +
> openai/gpt-4o, 2 rounds, converged): **three sequential roadmaps, not one
> consolidated stack** — (1) this roadmap ships first (quantified,
> zero-benchmark win), (2) `later/road-to-sparring-critic-spike.md` opens when
> this one closes, (3) an orchestration-substrate roadmap is created ONLY if
> the spike passes AND the scope decision permits. Consolidation was rejected
> as "a zombie roadmap with gate-skipping incentives"; per-question verdicts
> are inlined in § Council convergence.

## Goal

Stop the measured token bleeding in subagent usage. Live evidence
(2026-07-28 session screenshot): the main agent orchestrated a full roadmap
for **96.8k tokens** while four `general-purpose` subagents burned **308.0k /
327.1k / 299.0k / 280.8k ≈ 1.21M tokens (~12.5× the main agent)** on four
LOOKUP tasks — "Confirming ExternalApiProviderEnum definition location",
"Confirming GWInput import call sites", "Running check_enforcement_coverage
report", "Probing candidate strings with tsx".

The first two are code-graph queries (definition location, reverse
references) — `src/scripts/code_graph/sqlite_store.ts` + query exist and
answer them for <1k tokens. The third is output-filtering class (rtk,
measured 33% overall / 0–57% per command in
`internal/bench/rtk-savings/RESULTS.md`). The fourth is capped-grep class.
The cost mass is **in-run agentic exploration, not init payload** — so the
fix is routing and budgets, not (primarily) payload compression.

This roadmap needs **no benchmark** — only correctness comparisons: a
deterministic primitive that returns the same answer as a 300k-token agent
run needs no significance test.

## Council convergence (2026-07-28, claude-sonnet-4-5 + gpt-4o, 2 rounds)

- **Q1 scope cut** — THREE sequential roadmaps with structural gates beat one
  consolidated roadmap: "gates enforced by 'roadmap doesn't exist yet' are
  stronger than gates enforced by 'skip this phase'". This roadmap has ONE
  job and closes on completion.
- **Q2 priority** — L0 tool-not-agent + L0b stop-loss + telemetry MUST lead
  the whole stack: quantified 12.5× waste vs. speculative sparring work with
  two in-house honest-nulls on record (9.5.0 team-mode Δ=0, A3 Gate-A null).
  L0 is *subtractive* work — skip the spawn, route to existing primitives.
- **Q3 sparring** — demoted to a falsification spike in a SEPARATE parked
  roadmap (`later/road-to-sparring-critic-spike.md`); nothing sparring-shaped
  lands here.
- **Q5 scope-decision interaction** — lean-init telemetry is SAFE for the
  active `road-to-orchestration-scope-decision.md` sample (pure efficiency,
  orthogonal to orchestration value); dispatch/sparring telemetry would be
  contaminated (circular: building orchestration to generate the data that
  decides orchestration). All lines tagged `origin=lean-init-2026`.
- **Q6 cut-list** — C1–C7 from the consolidation note approved; **C8 added:**
  cross-provider critic transport removed from any MVP (six new complexity
  dimensions before the core loop is proven).

## Design locks

- **No second ledger:** all telemetry is additive fields on the existing
  audit stream (`agents/runtime/state/audit/YYYY-MM.jsonl`);
  `readOrchestrationMetrics` (`src/scripts/orchestration_record.ts`) reads
  new fields tolerantly. (Anti-fragmentation lesson from the external
  orchestrator-reference audit — one canonical location, never CWD-relative.)
- **ADR-124 / MCP-REJECT untouched:** no resident retrieval server, no second
  engine; `later/road-to-deferred-rule-retriever.md` stays parked — this
  roadmap only produces the demand-signal datum its parked condition asks for
  (are worker rules actually carried unused?).
- **Unknown → inherit, never guess:** the lookup-class routing extends the
  deterministic v1 classifier (`src/scripts/_lib/auto_dispatch.ts`,
  `auto-dispatch-classification.md`); no LLM classifier fallback (cut C3).
- **User-spec inviolability:** routing chooses HOW a task runs, never WHAT
  was asked (the external reference's queen-agent anti-pattern).
- **Subordination:** while `road-to-orchestration-scope-decision.md` is open,
  no new PUBLIC orchestration claim is created here; the one claim below is
  an internal efficiency claim, family-scoped, modeled on
  `downshift-cost-reduction`.

## Phase 1 — L0: tool-not-agent routing for lookup-class tasks

- [x] Add the lookup-class rung BELOW the existing tiers in
  `src/agent-src/contexts/execution/auto-dispatch-classification.md`
  (additive section): task patterns "where is X defined / who calls or
  imports X / does string Y exist / run report Z" route to deterministic
  primitives — `code_graph query` (definition/references), FTS one-shot CLI,
  capped grep, script-run with rtk wrap per the measured allowlist — **no
  subagent spawn**. Index-miss or genuinely ambiguous question → regular
  escalation to a subagent (never silently degraded answers).
  <!-- done 2026-07-28: § Lookup-class rung added. DELTA vs roadmap text,
  council-debated (sonnet-4-5 + gpt-4o, 2 rounds): definition/references are
  capped-rg-FIRST, code_graph only as opportunistic accelerant when
  enabled+fresh — the code-graph-retrieval-null claim (recall 0.365 vs grep
  0.797, TS indexing gap, enabled:false permanent) makes code_graph-primary
  contradict the recorded consequence bound -->`
- [x] Extend `src/scripts/_lib/auto_dispatch.ts` + corpus test
  (`_lib/auto_dispatch.corpus.test.ts`) with the lookup-class patterns;
  unknown still resolves to `inherit`, never down-guessed.
  <!-- done 2026-07-28: classifyLookup() + LOOKUP_CORPUS (14 cases incl. the
  four live-observed shapes, 4 negative controls); 25/25 corpus + 20/20 unit
  tests green -->`
- [x] Correctness comparison on ≥10 golden lookup tasks (including the four
  observed task shapes): primitive answer ≡ agent answer. Acceptance:
  comparison table committed under `internal/bench/lean-init/`; any mismatch
  is a routing bug, not a rounding error.
  <!-- done 2026-07-28: internal/bench/lean-init/{README.md,
  results-2026-07-28.md} — 12 goldens (all four observed shapes covered,
  G09 = the exact observed script), 12/12 match, Σ primitive cost <1.6k
  tokens vs 280–327k per observed subagent lookup -->`

## Phase 2 — L0b: hard per-worker token stop-loss

- [x] `max_tokens_per_worker` budget per tier in the spawn path (lookup-class
  start value ~15k, refined from Phase-3 telemetry): on hit, the worker
  returns a **structured partial result + escalation flag** to the main agent
  instead of continuing to explore. A worker overrunning its budget 20× is a
  dispatch error on the wrong rung, not diligence.
  <!-- done 2026-07-28: src/scripts/_lib/worker_budget.ts (budgetForTier,
  evaluateWorkerBudget, seeds lite 15k / medium 60k / high 150k —
  council-confirmed) + max_tokens_per_worker field on the spawn brief +
  § Per-worker token stop-loss in subagent-spawn-contract.md -->`
- [x] Fixture proves the partial-result shape (what was found, what remains,
  suggested next rung); N=3 validation-loop budget and the ADR-109 response
  contract stay untouched — the stop-loss composes with them, replaces
  nothing.
  <!-- done 2026-07-28: tests/scripts/_lib_worker_budget.test.ts
  (PARTIAL_RESULT_FIXTURE + validateWorkerPartialResult, 13/13 green);
  partial result rides as BLOCKED-envelope body, budget_hit is the flag -->`

## Phase 3 — Telemetry + spawn-payload truth (measure, then lint)

- [x] Additive audit fields (schema-versioned): `init_tokens`,
  `payload_hash`, `lookup_class`, `route_taken` (primitive|subagent),
  `budget_hit`, `correctness_match`, `origin=lean-init-2026`. Acceptance:
  `readOrchestrationMetrics` reads tolerantly; lines are cleanly
  distinguishable from the scope-decision sample (council Q5 segregation).
  <!-- done 2026-07-28: 8 additive fields (incl. cache_hit pulled forward
  from Phase 4 — one schema pass) in _lib/orchestration_record.ts + CLI
  flags + orchestration-telemetry.md field table; schema_version stays 1;
  tolerance test on readOrchestrationMetrics green (54/54); privacy by
  construction (hash/enum/id shapes, origin id-locked) -->`
- [x] Pre-register claim `lean-init-cost-reduction` in `docs/CLAIMS.md` as
  `unbacked` BEFORE any savings number is cited anywhere (family-scoped:
  lookup-class only; quality definition reused, no second truth).
  <!-- done 2026-07-28: registered with 4 fixed falsification criteria
  (correctness floor, negative control, origin-segregated cost metric,
  Q5 sample segregation); check_claims green (37 entries) -->`
- [x] `lint_spawn_payload.ts` (warn-only): payload size cap per tier derived
  from the measured baseline, forbids uncut file dumps — makes the
  `subagent-spawn-contract.md` prose iron law ("NEVER BULK-DUMP CONTEXT INTO
  A SUBAGENT") deterministic. Acceptance: warn mode wired into CI, 0 false
  positives on existing golden transcripts; sharpening warn→error only after
  a clean observation window.
  <!-- done 2026-07-28 (sonnet subagent + verified): 3 checks
  (inline-ref-body, uncut-file-dump >40 lines, per-tier char cap
  8k/16k/32k seeds), --strict promotion path; 20/20 tests; wired in
  Taskfile ci + ci-strict; 0 findings on real golden transcripts -->`

## Phase 4 — Cheap payload wins (reuse-only, no new mechanisms)

- [x] Role-scoped rule projection: extend the ACTIVE
  `road-to-request-scoped-rule-load` axis by subagent role (review worker
  gets review rules, mechanical worker mechanics rules — not the full
  projection). One scoping field. Acceptance: scoped projection measurably
  smaller for ≥2 roles; no rule needed by the role's golden tasks missing.
  <!-- done 2026-07-28 (sonnet subagent + verified): `roles:` frontmatter
  axis (vocabulary = the existing RoleMode enum, no new taxonomy) in
  rule_in_scope() + RuleScope + rule.schema.json (closed enum) +
  rule-router.md § roles; 4 rules tagged (reviewer-awareness→reviewer,
  roadmap-progress-sync + roadmap-ci-steps-policy→planner,
  php-coding→developer,reviewer); measurably-smaller demonstrated for
  reviewer + planner (14/14 + 86/86 regression green; honest deviation:
  planner instead of "tester" — no rule has testing as primary subject,
  that discipline lives in skills) -->`
- [x] rtk allowlist for worker tool loops: wrap ONLY the measured
  ~55%-savings command class from `internal/bench/rtk-savings/RESULTS.md`;
  the 0%-class stays unwrapped (wrap overhead without return). Acceptance:
  allowlist congruent with RESULTS.md, referenced not duplicated.
  <!-- done 2026-07-28: _lib/rtk_allowlist.ts (shouldWrapWithRtk, threshold
  50%) + congruence test PARSING RESULTS.md (4/4 green — drift in a future
  re-measurement fails the test); § Worker rtk allowlist in the spawn
  contract -->`
- [x] Prefix-stability pass: spawn payload ordering deterministic — static
  prefix (contract, role rules) first, variable task part last; no
  timestamps/random IDs in the prefix; `cache_hit` measurement field in
  audit. Measurement only — no savings claim without provider-response
  evidence.
  <!-- done 2026-07-28: serializeSpawnPayload + spawnPayloadHash in
  _lib/subagent_spawn.ts (static prefix byte-identical per config, task
  last, determinism-guard tests 5/5); cache_hit + payload_hash audit
  fields landed with the Phase-3 schema pass; § Prefix stability in the
  spawn contract -->`

## Phase 5 — Disposition and closure

- [x] Baseline gate on the risky levers: from Phase-3 telemetry, decide the
  telegraph-spawn-payload (L2) and reference-handoff (L3) bets — if p95 init
  payload is already < ~1,500 tokens/worker (the live evidence suggests cost
  mass is in-run, not init), both are DROPPED with a one-line disposition
  here; otherwise each gets its own small, benched follow-up roadmap
  (paired bench, `check_quality_regression.ts` gate). Never built ungated.
  <!-- disposition 2026-07-28: L2 (telegraph-spawn-payload) and L3
  (reference-handoff) DROPPED. Evidence basis stated honestly: no
  audit-line p95 exists yet (init_tokens shipped this PR, n=0); the
  decision rests on (a) the structural bound — the spawn contract's
  refs-not-bodies caps (5×≤200-char refs) + lint_spawn_payload's lite cap
  (8k chars ≈ 2k tokens) keep any contract-conforming init payload in the
  low-hundreds-of-tokens range for typical briefs, and (b) the live
  evidence the roadmap itself cites: workers burned 280–327k tokens
  IN-RUN after small inits — init compression is not the lever.
  Revisit-if: real audit lines show p95 init_tokens ≥ ~1,500 -->`
- [x] Back or retire the `lean-init-cost-reduction` claim from real audit
  lines (n and family scope stated; negative control: a non-lookup task
  never routes to a primitive).
  <!-- disposition 2026-07-28: claim STAYS REGISTERED-UNBACKED — the exact
  repo precedent of its sibling `orchestration-dispatch-net-win` (unbacked
  = documented debt, binds to a resolving report once real lines exist).
  Backing NOW would violate its own pre-registered criterion (3): the cost
  metric reads origin-tagged audit-line pairs, and the telemetry fields
  shipped in THIS PR (n=0 real lines; recording the bench goldens into the
  live audit stream would contaminate real-events-only data). What DID
  land so lines can accrue: the spawn_count-0 exception for
  route_taken=primitive (schema was un-recordable for primitive routes —
  fixed + tested). Negative control already holds deterministically
  (LOOKUP_CORPUS lk-n1..n4, FP=0). Backing trigger: ≥10 origin-tagged
  lookup-class lines; correctness floor already 12/12 in
  internal/bench/lean-init/ -->`
- [x] Closure: results summary here; unparking of
  `later/road-to-sparring-critic-spike.md` is the recorded next step (its
  resume condition is this roadmap's closure + telemetry review).

  **Results summary (2026-07-28, single-day run, 2 council debates, 2
  sonnet implementation subagents + 3 sonnet explorers):**
  - **L0 tool-not-agent routing:** `classifyLookup` regex layer (4 classes,
    no LLM fallback) + § Lookup-class rung in the classification context;
    corpus 25/25 incl. the four live-observed shapes, FP=0 on negative
    controls. Council-decided delta vs the roadmap text: capped-rg-first
    for definition/references (code_graph demoted to an inert accelerant
    hook) — the `code-graph-retrieval-null` consequence bound wins over
    the roadmap's literal primitive choice.
  - **Correctness:** 12/12 goldens match (`internal/bench/lean-init/`),
    Σ primitive cost <1.6k tokens vs 280–327k per observed subagent lookup.
  - **L0b stop-loss:** `worker_budget.ts` seeds 15k/60k/150k
    (council-confirmed), BLOCKED-envelope partial-result shape fixed by
    fixture; brief carries `max_tokens_per_worker`.
  - **Telemetry:** 8 additive audit fields, schema_version 1 unchanged,
    tolerant reader proven; zero-spawn exception for primitive routes so
    the claim's lines can accrue; `lean-init-cost-reduction` pre-registered
    and left honestly unbacked (backing trigger: ≥10 origin-tagged
    lookup-class lines).
  - **Payload:** `lint_spawn_payload` warn-only in CI (0 FPs on goldens);
    role-scoped rule projection (`roles:` axis); measured-only rtk
    allowlist; prefix-stable payload serialization + `payload_hash`/
    `cache_hit` measurement.
  - **Dropped by gate:** L2 telegraph-spawn-payload, L3 reference-handoff
    (init payload structurally bounded far below 1,500 tokens; cost mass
    is in-run — the roadmap's own thesis, confirmed).
  - **Next step (recorded):** unpark
    `later/road-to-sparring-critic-spike.md` — resume condition is this
    closure + a telemetry review once real origin-tagged lines exist.

## Explicitly NOT in this roadmap

- No sparring critic, no rubric packs, no critic transport — that is the
  parked spike roadmap's sole job.
- No auto-dispatcher that silently invokes Council/Team — tier-3+ escalation
  UX waits for `road-to-orchestration-scope-decision.md`.
- No learned/RL sequencing, no swarm topologies, no resident retrieval
  server, no second engine, no telegraph-on-rules without a paired bench.
