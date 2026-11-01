---
complexity: structural
status: later
tree_pin: 5a66c1bf19
review_by: 2026-12-15
entry_condition:
  what: "owner answers to blockers analysis-only-scope, cross-project-source-sharing and gambling-safety-line, plus the three domain-adoption gates for the trading half"
  when: "when the owner answers, and a slot among the active roadmaps is free"
  who: owner
execution:
  mode: phase-checkpoints
owner: maintainer
estate_growth_exempt: "Receiver for the owner's own demand in round inbox-2026-11-a (T2 transcript: AC must really analyse trading, know where the data comes from, learn unknown sources and remember them in its internal graphs, later betting and other sports). Written to later/ because three owner-reserved decisions gate it; grows open_blockers by three."
estate_offset_exempt: "Owner search at 5a66c1bf19 (grep -rlF for prediction-pool, pool_winsim, odds, de-vig, brier, source card, data-source, trading over agents/roadmaps, later, stubs) found no owner; stubs/road-to-typed-knowledge-graph-memory.md and later/road-to-a-knowledge-atlas.md hold no data-source item (grep 0). New trunk by necessity."
---
# Road to forecasts that know their sources

> **Source:** `agents/tmp.old/inbox-2026-11-a/` (topics T1 and T2: two transcripts, two supplied plans, two independent proposals on the same external references, merged here).
> **Arrivals:** 1 — `inbox-2026-11-a` (2026-11-01).

## Goal

AC can analyse a market or a match the way a careful analyst does: it knows
where each kind of data comes from, fetches it with a stamp, computes the
numbers in code, records the forecast before the event, and scores itself
afterwards. When it does not know a source, it finds one, proves it with a
real fetch, and remembers it — including that a source does not work.

Owner constraints, verbatim from the transcript and binding on every phase:
it will never be fully certain, and the way information is gathered is the
foundation. So no phase may report a forecast without its sources, its basis
and an honest power statement, and no phase ships order or bet placement
unless blocker `analysis-only-scope` says otherwise.

## Verified at the pin

- Building blocks exist: `src/skills/prediction-pool-optimizer/`,
  `src/scripts/prediction-pool/{poisson_sim,score_ev,pool_winsim}.ts`,
  `src/domains/fun/prediction-pool/command.md`.
- De-vig, consensus and odds→λ happen in the model's head; the scripts start
  at `<home-xg>` (`prediction-pool-optimizer/SKILL.md:56-57,133,151`).
- No prediction ledger, Brier score or calibration anywhere (grep 0); "it
  tipped well at the World Cup" has no record in the tree.
- `classify_tier` treats every data host as `proprietary`
  (`src/scripts/_lib/knowledge_global.ts:343,377-378`, ADR-119 public-only
  default at `:56-59`); knowledge cards default to `sensitivity: project`
  (`src/agent-src/templates/contexts/knowledge-card.md:14-15`).
- No trading skill exists (`ls src/skills | grep -i trad` -> 0); no rule
  mentions gambling or betting; the finance floor has no trading triggers
  (`src/rules/finance-safety-floor.md:5-15`).
- `pool_winsim --holdout-runs` (independent draw, field re-drawn, paired
  sign test) landed in `archive/road-to-numbers-a-skill-can-stand-behind` 3.2.

## Phase 1 — Odds become numbers in code

- [ ] **1.1 Odds bridge.** A script that de-vigs bookmaker odds, builds a
      weighted consensus and solves the implied λ pair by least squares, feeding
      `poisson_sim` instead of the model's head.
      verify: `npx vitest run tests/scripts/prediction-pool_odds_bridge.test.ts` -> 0 — with a
      three-book fixture reproducing the hand-computed λ pair within 0.01.
- [ ] **1.2 Sports are table rows.** A sport is a row (scoring rule, outcome
      model) in one table, never a new skill.
      verify: adding a second sport touches the table and a test only.

## Phase 2 — A forecast is recorded before the event

- [ ] **2.1 Prediction ledger.** Append-only JSONL with a hash chain, written
      before the event; location per blocker decision E7 (default
      `agents/forecasts/ledger.jsonl`).
      verify: rewriting an earlier row breaks the chain check.
- [ ] **2.2 Scoring.** Brier, log-loss, calibration buckets and, for betting,
      closing-line value; every report below n=30 resolved forecasts says
      `underpowered` (reuse `_lib/paired_verdict.ts`, `_lib/capture_rate.ts`).
      verify: `npx vitest run tests/scripts/forecast_ledger_score.test.ts` -> 0 — with a 10-row
      fixture reporting `underpowered` and a 40-row fixture reporting a Brier score.
- [ ] **2.3 Backfill (owner-supplied only).** If the owner provides the World Cup
      tip export, it enters as an explicitly retrospective batch.
      verify: every backfilled row carries `retrospective: true` and scores separately.

## Phase 3 — Sources are cards, and a missing source is learned

- [ ] **3.1 Data-source cards.** A `kind: external` profile under
      `agents/knowledge/`: what it supplies, key needed, rate limit, terms,
      `fetched_at`, last success, fallback.
      verify: `npx vitest run tests/scripts/source_card_schema.test.ts` -> 0 — a card missing `fetched_at` or terms fails.
- [ ] **3.2 Source graph.** A deterministic graph over the cards, modelled on
      `discovery_graph` and its confidence scale — not the code graph, whose
      vocabulary is code.
      verify: `npx vitest run tests/scripts/source_graph.test.ts` -> 0 — the same cards build the same graph byte for byte.
- [ ] **3.3 Learning loop.** No card fits -> search official and free sources
      first -> prove with one real fetch -> write the card; a source that fails
      is written as a negative fact so the next session does not pay again.
      verify: `npx vitest run tests/scripts/source_learning_loop.test.ts` -> 0 — a failed fetch writes a negative card and the next lookup skips it.
- [ ] **3.4 Cross-project sharing** — only after blocker
      `cross-project-source-sharing`.
      verify: `npx vitest run tests/scripts/knowledge_global.test.ts` -> 0 with a key-free card promoted and a keyed card refused.

## Phase 4 — Trading analysis (after the domain-adoption gates)

- [ ] **4.1 Trading-analysis skill and script bundle**: scan setups, read
      filings and disclosures, plan entry/stop/target, size by maximum loss,
      check limits, replay whole sessions with a minimum sample and an interval.
      Written fresh in TypeScript (consumers are guaranteed `node` only; a port
      of the references would be a licensed derivative).
      verify: `npx vitest run tests/scripts/trading_replay.test.ts` -> 0 — a replay below the minimum sample reports `underpowered`.
- [ ] **4.2 Safety lines**: trading triggers on the finance floor and the
      gambling line from blocker `gambling-safety-line`.
      verify: `cat src/rules/domain-safety-disclaimer.md src/rules/finance-safety-floor.md | grep -ciE "betting|odds|trading"` -> /^[1-9]/

## Blockers

### blocker: analysis-only-scope
- **Status:** open — raised 2026-11-01.
- **Owner:** owner (an external, money-moving commitment is owner-reserved).
- **Blocks:** Phase 4, and whether any phase may place an order or a bet.
- **Question:** analysis only, or also paper/real execution? One supplied plan proposes an order domain; the proposal recommends analysis only.
- **Recommendation:** analysis only — no order or bet placement, paper or real.

### blocker: cross-project-source-sharing
- **Status:** open — raised 2026-11-01.
- **Owner:** owner (lowers the ADR-119 public-only data-handling default).
- **Blocks:** step 3.4.
- **Question:** may key-free source cards become global automatically (proposal: after three successful fetches in two sessions, switchable off)?
- **Recommendation:** yes for key-free, terms-permitting sources only, with the off switch.

### blocker: gambling-safety-line
- **Status:** open — raised 2026-11-01.
- **Owner:** owner (policy wording: help resources, age, local law).
- **Blocks:** Phase 1 shipping to consumers, step 4.2.
- **Question:** add a betting/odds trigger and one gambling line to `domain-safety-disclaimer`?
- **Recommendation:** yes, before the odds bridge ships.

Domain-adoption gates for Phase 4 (per `domain-adoption-policy`): demand
signal — met by the owner turn; named maintenance owner — missing; CI-tooling
decision — missing.

## Risk Register

| Risk | Mitigation |
|---|---|
| Lucky streaks learned as rules | ledger first; no quality claim below n=30 |
| A source's terms forbid automated use | the card records terms; the learning loop refuses such sources |
| Scope drifts into execution | blocker `analysis-only-scope` gates it |

## Acceptance Criteria

- Every forecast AC emits names its sources with `fetched_at`, its method, seed and runs.
- A forecast is in the ledger before the event it predicts.
- A source AC could not use is remembered as such.
