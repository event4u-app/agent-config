---
complexity: structural
status: ready
tree_pin: 630d97cb5b
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-12-15
estate_offset_exempt: "New plan from one owner round (inbox-2026-11-x). Owner search: grep -rlF -e solve.check -e solve_test -e tier_for_model -e 'power planner' -e 'interpretation record' -e pricing.yaml over agents/roadmaps/*.md, later/ and stubs/ returned only later/road-to-cost-parity-2-state-aware-dispatch.md, which names pricing.yaml in a byte-freeze list and owns none of these steps. No existing roadmap to fold this into; the active estate moves from 4 to 5, the WIP cap, not beyond it."
estate_growth_exempt: "One active roadmap for the owner's 2026-11-05 demand that AC's benefit be provable before more money goes into runs; every step is zero model spend and closes in the same change. The paid and domain work is parked in later/road-to-proof-where-the-owner-sees-it."
relates:
  - slug: road-to-a-graph-that-wins
    relation: disjoint
    note: "Owns the graph measurement (its step 2.5 re-scores v3 against the sealed truth). Nothing here touches the graph."
---
# Road to a bench that can tell

> **Source:** `agents/tmp.old/inbox-2026-11-x/` — an owner transcript of seven
> turns, six plan revisions from two assistants (v3, a master v8, a PR-scoped v1,
> a companion on the separate-app question, a consolidated v10) and the container
> result of 2026-11-05. Every claim below was re-verified at `main@630d97cb5b`;
> what did not hold is named in § Decisions.

## Goal

The bench tells an effect from noise and from its own defects. The subject cannot read its grader, every reported dollar
uses the served model's price, a sweep's pairs are computed before it runs, and a
bad result is read as a question about the measurement before it is read as a
verdict on an asset.

The owner set two constraints this file serves directly (transcript turns 6 and 7):

- **No separate benchmark app unless it is really needed.** Nothing here adds an
  app, a repository, a service or a dependency.
- **A bad benchmark is never a removal order.** The interpretation record in
  Phase 4 cannot recommend removal — by construction, not by convention.

## Cost rules

Zero model spend for every step. No step starts a sweep. A step that needs
existing reports reads them from `internal/bench/reports/ab-v2/` in the primary
checkout, read-only.

## Phase 1 — The grader the subject cannot read

Evidence (read): `internal/bench/corpora/ab-trackb-v2.yaml:286` · `internal/bench/ab/fixtures-v2/capH-debug-02/tests/solve.check.mjs` · `src/scripts/_lib/bench_ab_scoring_v2.ts:643-671`

The 15 `capability_oracle.solve_test` tasks in
`internal/bench/corpora/ab-trackb-v2.yaml` run a verifier (`tests/solve.check.mjs`
or `tests/integration.check.mjs`), and three `discipline_oracle.hidden_test` tasks
run `tests/hidden.check.mjs` — the corpus calls it "Hidden test (not in prompt)".
All 21 files lived inside the task fixture
(`internal/bench/ab/fixtures-v2/<task>/tests/`). The fixture is copied into the
agent's working copy, so the "hidden" tests were readable — and runnable — by the
agent under test. `_runVerifier`
(`src/scripts/_lib/bench_ab_scoring_v2.ts:643`) restored a *tampered* copy; it
never hid one.

- [x] **1.1** Move every verifier out of `fixtures-v2/<task>/` into
  `internal/bench/ab/verifiers-v2/<task>/tests/` (21 files, 18 tasks). The fixture
  keeps everything the agent is meant to see.
  verify: `git ls-files internal/bench/ab/fixtures-v2 | grep -c 'check.mjs'` -> 0 and `git ls-files internal/bench/ab/verifiers-v2 | grep -c 'check.mjs'` -> 21
- [x] **1.2** `_runVerifier` takes the oracle root (`oracleRootFor`): a file the
  command names under the oracle root is copied into a scratch copy of the clone
  at scoring time only; a file the agent left at that path is replaced and
  reported as `verifier-planted:`. A command whose file is in neither root runs
  in the clone and fails, never passes.
  verify: `npx vitest run tests/scripts/bench_ab_solve_oracle.test.ts` -> 0
- [x] **1.3** Regression test: for every verifier task, no fixture holds a file its
  commands run, and for every `solve_test` task scoring a reference-fixed clone
  still passes while an untouched clone still fails. Seen red against the pre-move
  layout.
  verify: `npx vitest run tests/scripts/bench_ab_solve_oracle.test.ts` -> 0, seen red before 1.1-1.2

## Phase 2 — Prices by the model that was served

Evidence (read): `internal/bench/pricing.yaml:14-36` · `src/scripts/_lib/bench_ab_activation.ts:279-287` · `src/scripts/bench_ab_v2_stats.ts:484-509`

`cost_by_arm` (`src/scripts/bench_ab_v2_stats.ts:484`) prices by family through
`tier_for_model` (`src/scripts/_lib/bench_ab_activation.ts:279`). The `haiku`
family row carries $0.25 / $1.25 per 1M (a retired generation); `claude-haiku-4-5`
lists at $1 / $5. Every absolute dollar figure in the 2026-11-05 Haiku sweep is
4× low, and the `opus` row ($15 / $75) is wrong for every current Opus. Exact-model
rows exist (`internal/bench/pricing.yaml:38-60`) but only `tier_downshift_verdict`
reads them.

- [x] **2.1** Add exact rows for `claude-opus-4-6`, `claude-opus-4-7` and
  `claude-opus-4-8` (base input, 5-minute cache write, cache read, output;
  `sourced_on: 2026-11-05`, source the platform pricing page). `claude-haiku-4-5`
  and `claude-sonnet-4-6` already had rows (added 2026-11-04 for the sweep cap);
  `cost_by_arm` never read them. Family rows stay untouched for their pinned readers.
  verify: `grep -cE 'model: claude-(haiku-4-5|sonnet-4-6|opus-4-[678])$' internal/bench/pricing.yaml` -> 5
- [x] **2.2** `cost_by_arm` resolves an exact model row first and falls back to the
  family row, and records which one priced the arm (`priced_by: model | family`).
  Test: a `claude-haiku-4-5` report prices at the exact row; an unknown model falls
  back and says so.
  verify: `npx vitest run tests/scripts/bench_ab_v2_stats.test.ts` -> 0

## Phase 3 — Size the sweep before paying for it

Evidence (read): `src/scripts/_lib/paired_verdict.ts:54-65` · `docs/benchmark.md:74`

`paired_verdict.ts` already derives the minimum discordant count for the one-sided
sign test; nothing turns that into "how many pairs do I need". The 2026-11-05 A/A
control measured about one discordant pair in six.

- [x] **3.1** `src/scripts/bench_ab_power.ts`: given a discordance rate (the A/A
  figure as published, `--aa 2/12`, or `--discordance`), the share of discordant
  pairs expected to favour one arm, α and the target power, print the discordant
  pairs required and the total pairs per arm. Uses the same exact one-sided sign
  test as `paired_verdict`. (Reading an A/A report directly would need win/loss
  counts the discipline block does not carry; the published figure is enough.)
  verify: `./scripts-run src/scripts/bench_ab_power --discordance 0.167 --share 1` exits 0 and prints required pairs
- [x] **3.2** Tests: at a 100 % one-directional share the planner returns exactly
  the `paired_verdict` floor; at 50 % it reports "not reachable" instead of a
  number; required pairs fall as the discordance rate rises.
  verify: `npx vitest run tests/scripts/bench_ab_power.test.ts` -> 0
- [x] **3.3** `task bench:ab:power` in `taskfiles/bench-ab.yml`, and one paragraph
  in `docs/benchmark.md` § container sweep that says a paid sweep is sized with it
  first.
  verify: `task --list | grep -c bench:ab:power` -> 1

## Phase 4 — A bad result is a question first

Evidence (claimed): `agents/tmp.old/inbox-2026-11-x/chat.txt:1712` (owner turn 7)

The owner, turn 7: do not throw something away because one bench is bad; ask
whether the right benefit was measured and whether the cost is really that high.

- [ ] **4.1** `src/scripts/bench_ab_interpret.ts` reads an ab-v2 analysis JSON and
  writes a Benchmark Interpretation Record: for each comparison, the deterministic
  labels the data supports — `ceiling` (control capability or discipline ≥ 0.90),
  `underpowered` (discordant below the `paired_verdict` floor), `not-delivered`
  (load-check errors in the package arm), `cost-overhead` (priced cost factor
  above 2×) — and the questions it cannot answer from data (construct, real-world
  use), listed as open.
  verify: `npx vitest run tests/scripts/bench_ab_interpret.test.ts` -> 0
- [ ] **4.2** The record has no removal field. It carries
  `removal_supported: false` and the sentence "a benchmark result alone never
  supports removing an asset" on every output, and a test asserts no input can
  change either.
  verify: `npx vitest run tests/scripts/bench_ab_interpret.test.ts` -> 0 (removal-invariant case)
- [ ] **4.3** Fixtures from the real 2026-11-05 shape: the Haiku sweep reads
  `ceiling` + `underpowered`; a sweep whose package arm failed the load check reads
  `not-delivered`. Both seen red before 4.1 lands.
  verify: `npx vitest run tests/scripts/bench_ab_interpret.test.ts` -> 0 (fixture cases), seen red before 4.1
- [ ] **4.4** `docs/benchmark.md` § Reading a bad result: the four labels, what
  each one sends you to do instead (harder tasks, more pairs, fix delivery, price
  the run), and the rule that removal needs the evidence named in
  `road-to-proof-where-the-owner-sees-it` Phase 4.
  verify: `grep -c 'Reading a bad result' docs/benchmark.md` -> 1

## Phase 5 — The headline says dollars

Evidence (read): `docs/benchmark.md:76` · `docs/contracts/value-dashboard-spec.md:61-62`

- [ ] **5.1** Re-run the stats for the three 2026-11-05 reports with Phase 2's
  prices (offline, $0) and add the priced cost factor and the dollars per arm next
  to the token factors in `docs/benchmark.md` § container sweep. Token factors stay
  as the secondary figure.
  verify: `grep -cE 'priced cost factor' docs/benchmark.md` -> >=1
- [ ] **5.2** Replace the ten stale `.py` script references in
  `docs/contracts/value-dashboard-spec.md` and the ones in
  `docs/contracts/benchmark-report-schema.md` with the `.ts` paths that exist.
  verify: `grep -cE 'scripts/[a-z_]+\.py' docs/contracts/value-dashboard-spec.md docs/contracts/benchmark-report-schema.md` -> 0 per file

## Decisions

| # | Decision | Alternatives | Reason | Revisit-if |
|---|---|---|---|---|
| D1 | No separate benchmark app, repository or service | `agent-bench` repo (master v8 D2) | Owner constraint (turn 6); the companion plan checked all seven reasons for an app against the tree and only a community platform needs one, with no demand recorded | someone outside asks to measure their package here, or a needed tool cannot live in this repo for licence reasons |
| D2 | Oracle files move inside this repo to a root the subject never receives, not to a private repo | private data repo (lab plan B1, v10 P0.4 "local protected dir") | The leak is to the agent under test, and the subject only sees its fixture; a second repo is outward-facing and owner-reserved, and the move closes the leak without it | a confirmatory hold-out must stay unseen by *authoring* sessions too — then the private store in the later file applies |
| D3 | Removal threshold of 3 pp is not adopted | lift-v8 E22 citing ADR-202 | ADR-202:336,343 sets 3 pp as an anchor-coverage margin derived from its own observed spread, not a task-success non-inferiority margin; v10 §9.1 also drops it for a per-family margin | — |
| D4 | Two figures from the plans are not carried | memory 27/27 and 21.5 % (master v8), trigger canary 64/134 (PR v1) | No source in the tree; 21.5 % is `unbacked` in `docs/CLAIMS.md` | a source is found |
| D5 | Price weighting is a fix, not a build | build it (v3, v8, v10) | `cost_by_arm` and Table 3b already price per bucket; what was wrong is the price table and the headline | — |

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-11-05 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Oracle move breaks scoring | implementation | A reader still expects `tests/solve.check.mjs` inside the fixture | 1.3 runs every `solve_test` task on a reference and an untouched clone; 1.1 greps `src/`, `tests/`, `internal/` for `solve.check` | Phase 1 — The grader the subject cannot read |
| 2 | Pinned cost numbers shift | implementation | Correcting prices changes figures some tests pin | Family rows stay untouched; only exact-model resolution is new | Phase 2 — Prices by the model that was served |
| 3 | The record is read as a verdict | product | A label like `cost-overhead` is taken as a reason to remove an asset | 4.2 makes removal unrepresentable in the output | Phase 4 — A bad result is a question first |

## Acceptance Criteria

- No `solve_test` file is present in any prepared agent workspace, and scoring is unchanged on reference and untouched clones.
- A `claude-haiku-4-5` sweep is priced at $1 / $5 per 1M and the report says which row priced it.
- `task bench:ab:power` prints required pairs from an A/A report.
- `bench_ab_interpret` labels the 2026-11-05 Haiku sweep `ceiling` + `underpowered` and never emits a removal recommendation.
- `docs/benchmark.md` quotes priced cost factors next to token factors.
