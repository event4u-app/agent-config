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

- [ ] Add the lookup-class rung BELOW the existing tiers in
  `src/agent-src/contexts/execution/auto-dispatch-classification.md`
  (additive section): task patterns "where is X defined / who calls or
  imports X / does string Y exist / run report Z" route to deterministic
  primitives — `code_graph query` (definition/references), FTS one-shot CLI,
  capped grep, script-run with rtk wrap per the measured allowlist — **no
  subagent spawn**. Index-miss or genuinely ambiguous question → regular
  escalation to a subagent (never silently degraded answers).
- [ ] Extend `src/scripts/_lib/auto_dispatch.ts` + corpus test
  (`_lib/auto_dispatch.corpus.test.ts`) with the lookup-class patterns;
  unknown still resolves to `inherit`, never down-guessed.
- [ ] Correctness comparison on ≥10 golden lookup tasks (including the four
  observed task shapes): primitive answer ≡ agent answer. Acceptance:
  comparison table committed under `internal/bench/lean-init/`; any mismatch
  is a routing bug, not a rounding error.

## Phase 2 — L0b: hard per-worker token stop-loss

- [ ] `max_tokens_per_worker` budget per tier in the spawn path (lookup-class
  start value ~15k, refined from Phase-3 telemetry): on hit, the worker
  returns a **structured partial result + escalation flag** to the main agent
  instead of continuing to explore. A worker overrunning its budget 20× is a
  dispatch error on the wrong rung, not diligence.
- [ ] Fixture proves the partial-result shape (what was found, what remains,
  suggested next rung); N=3 validation-loop budget and the ADR-109 response
  contract stay untouched — the stop-loss composes with them, replaces
  nothing.

## Phase 3 — Telemetry + spawn-payload truth (measure, then lint)

- [ ] Additive audit fields (schema-versioned): `init_tokens`,
  `payload_hash`, `lookup_class`, `route_taken` (primitive|subagent),
  `budget_hit`, `correctness_match`, `origin=lean-init-2026`. Acceptance:
  `readOrchestrationMetrics` reads tolerantly; lines are cleanly
  distinguishable from the scope-decision sample (council Q5 segregation).
- [ ] Pre-register claim `lean-init-cost-reduction` in `docs/CLAIMS.md` as
  `unbacked` BEFORE any savings number is cited anywhere (family-scoped:
  lookup-class only; quality definition reused, no second truth).
- [ ] `lint_spawn_payload.ts` (warn-only): payload size cap per tier derived
  from the measured baseline, forbids uncut file dumps — makes the
  `subagent-spawn-contract.md` prose iron law ("NEVER BULK-DUMP CONTEXT INTO
  A SUBAGENT") deterministic. Acceptance: warn mode wired into CI, 0 false
  positives on existing golden transcripts; sharpening warn→error only after
  a clean observation window.

## Phase 4 — Cheap payload wins (reuse-only, no new mechanisms)

- [ ] Role-scoped rule projection: extend the ACTIVE
  `road-to-request-scoped-rule-load` axis by subagent role (review worker
  gets review rules, mechanical worker mechanics rules — not the full
  projection). One scoping field. Acceptance: scoped projection measurably
  smaller for ≥2 roles; no rule needed by the role's golden tasks missing.
- [ ] rtk allowlist for worker tool loops: wrap ONLY the measured
  ~55%-savings command class from `internal/bench/rtk-savings/RESULTS.md`;
  the 0%-class stays unwrapped (wrap overhead without return). Acceptance:
  allowlist congruent with RESULTS.md, referenced not duplicated.
- [ ] Prefix-stability pass: spawn payload ordering deterministic — static
  prefix (contract, role rules) first, variable task part last; no
  timestamps/random IDs in the prefix; `cache_hit` measurement field in
  audit. Measurement only — no savings claim without provider-response
  evidence.

## Phase 5 — Disposition and closure

- [ ] Baseline gate on the risky levers: from Phase-3 telemetry, decide the
  telegraph-spawn-payload (L2) and reference-handoff (L3) bets — if p95 init
  payload is already < ~1,500 tokens/worker (the live evidence suggests cost
  mass is in-run, not init), both are DROPPED with a one-line disposition
  here; otherwise each gets its own small, benched follow-up roadmap
  (paired bench, `check_quality_regression.ts` gate). Never built ungated.
- [ ] Back or retire the `lean-init-cost-reduction` claim from real audit
  lines (n and family scope stated; negative control: a non-lookup task
  never routes to a primitive).
- [ ] Closure: results summary here; unparking of
  `later/road-to-sparring-critic-spike.md` is the recorded next step (its
  resume condition is this roadmap's closure + telemetry review).

## Explicitly NOT in this roadmap

- No sparring critic, no rubric packs, no critic transport — that is the
  parked spike roadmap's sole job.
- No auto-dispatcher that silently invokes Council/Team — tier-3+ escalation
  UX waits for `road-to-orchestration-scope-decision.md`.
- No learned/RL sequencing, no swarm topologies, no resident retrieval
  server, no second engine, no telegraph-on-rules without a paired bench.
