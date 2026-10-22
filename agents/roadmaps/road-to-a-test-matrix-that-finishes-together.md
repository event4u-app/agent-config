---
complexity: structural
status: ready
execution:
  mode: autonomous
estate_offset_exempt: "Round inbox-2026-10-w verified at 5dcfa13a6 that tests.yml still shards vitest by file count (`--shard=N/4`, :304; no `sequence.sequencer` in vitest.config.ts) while its own comment (:293-301) records shard 3/4 at 2.3x its siblings since 2026-08-18; PR #2569 measured the ubuntu shards at 269/318/468/325 s. The 2026-08 ci-economy round measured the imbalance and never adopted duration balancing, and its source round had proposed it — this is the second arrival with no recorded reason for dropping it. The diagnostic hook-latency comparison (continue-on-error, :465-503) still runs inside Static Checks. No active roadmap owns any of these."
relates:
  - slug: road-to-a-required-check-that-does-not-rerun-the-gates
    relation: disjoint
    note: "Edits one collector-lifecycle step in tests.yml (its 2.3). This file never touches that step."
  - slug: road-to-macos-where-the-platform-is-the-point
    relation: disjoint
    note: "Owns which macOS legs run on a PR and the install-job shape on macOS. This file balances what runs, on both OSes, and never changes which legs exist."
  - slug: road-to-ci-time-that-counts-the-queue
    relation: disjoint
    note: "Its reading is how the effect here is reported; nothing here waits for it."
---
# Road to a test matrix that finishes together

> **Source:** `agents/tmp.old/inbox-2026-10-w/` — two supplied CI-speed plans,
> both naming the count-based shard imbalance as their top in-repo lever; verified
> against `main@5dcfa13a6`. **Second arrival:** an earlier inbox round on test
> economy (2026-08-10) proposed duration-balanced shards; the 2026-08 ci-economy
> roadmap measured the imbalance and closed without adopting the fix and without
> a recorded reason.

## Goal

The four node-test shards on each OS finish within a narrow band of each other
because files are assigned by measured duration, not by hash order — every test
file still runs exactly once — and work that never gates no longer lengthens the
job it sits in.

## Context — verified at `5dcfa13a6`

- `tests.yml:304` runs `--shard=${{ matrix.shard }}/4`; vitest's `BaseSequencer`
  slices the SHA1-sorted file list by count. No custom sequencer in
  `vitest.config.ts`.
- `tests.yml:293-301`: shard 3/4 averaged 357 s ubuntu / 516 s macOS against
  147-164 s on 2026-08-18; driver `tests/scripts/build_proof.test.ts`, whose
  `render()` costs ~54 s a call and is already memoised to one call per file
  (`build_proof.test.ts:18-37`).
- PR #2569 (Actions API): ubuntu vitest steps 269 / 318 / 468 / 325 s; macOS shard
  3 701 s.
- Static Checks carries `hook-latency path comparison (diagnostic, never gates)`
  (:465, `continue-on-error: true` :503) after the blocking bench gate (:414).
- `tests.yml` uses floating `ubuntu-latest` / `macos-latest`; `ubuntu-latest`
  moves to 26.04 between 2026-10-19 and 2026-11-19, inside any measurement window.

## Phase 1 — Assign files by duration

- [x] **1.1 Timing snapshot + refresh script.** `tests/timing-manifest.json`
      maps each test file to seconds per OS; `plan_test_shards` regenerates it from
      vitest JSON reporter output of a full run.
      verify: unit tests feed a recorded reporter fixture and assert per-file
      seconds land in the manifest.
- [x] **1.2 Duration-balanced sequencer.** A custom `sequence.sequencer` overrides
      `shard()` with a deterministic longest-processing-time assignment from the
      manifest; files absent from it get the manifest median, so a new file is
      never dropped. Selected only when `VITEST_BALANCED_SHARDS=1`, which CI sets.
      verify: tests assert that over a fixture file list every file is assigned to
      exactly one of four shards, the assignment is stable across runs, and an
      unknown file is placed rather than skipped.
- [ ] **1.3 Wire it into both OSes and record the effect.** `tests.yml` node-tests
      set the env var; the PR's own CI run is the measurement and the per-shard
      vitest times are recorded in the tests.yml comment that today states the
      2026-08-18 imbalance.
      verify: the PR CI run reports per-shard times and the comment cites that run id.

## Phase 2 — The critical path carries only gating work

- [x] **2.1 Hook-latency comparison in its own job.** **Outcome: kept in place** — council
      2/2 (`agents/evidence/council/ci-macos-tier-and-static-diagnostic-2026-10-22.md`,
      decision B): Static Checks is not on the critical path and a separate job would
      lose the same-job warm/cold delta for ~30-50 s net. The diagnostic comparison
      (and the composite-arming report beside it) move from Static Checks into a
      parallel, non-gating job; the blocking bench gate stays in Static Checks
      unchanged.
      verify: `grep -n "hook-latency bench gate" .github/workflows/tests.yml` -> 0
- [x] **2.2 Profile `render()` once more.** Time `build_proof`'s `render()` by
      phase; if a cacheable or repeated hotspot exists, cut it with output parity
      asserted by the existing determinism test; if not, record the measured
      phase split in `ci-cost-budget.md` and rely on 1.2 to isolate it.
      verify: the existing build_proof tests pass and the phase split is recorded.
- [x] **2.3 Pin runner images in tests.yml** (`ubuntu-24.04`, and the current
      concrete macOS label) so readings across the 26.04 rollout compare like with
      like.
      verify: `grep -c "ubuntu-latest" .github/workflows/tests.yml` -> /^0$/
- [x] **2.4 Persist the transform caches.** `NODE_COMPILE_CACHE` and vitest's
      module cache restored via `actions/cache` keyed on lockfile + tsconfig + OS,
      saved only from `main`; kept only if this PR's run shows a gain, reverted in
      the same PR otherwise.
      verify: the decision and both run ids are recorded in `ci-cost-budget.md`.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| B1 | reversible-technical | council:agents/evidence/council/ci-macos-tier-and-static-diagnostic-2026-10-22.md | The hook-latency diagnostic stays in Static Checks (2/2) | Static Checks 6m07 vs ubuntu shard 8m40 vs ~40 min run on PR #2569 | Static Checks becomes the last or a required job |
| B2 | reversible-technical | evidence | `render()`'s cost was not in `build_proof` but in `check_enforcement_coverage.mentions_as_code` (99 % of 89 s); fixed there with an oracle-equivalence test, output byte-identical | CPU profile 2026-10-22; `build_proof --check` 87 s -> 7.7 s | — |
| B3 | reversible-technical | evidence | Transform caches not adopted | local A/B on 61 files: cold 4.37 s, warm 4.24 s, none 4.60 s — inside noise; CI log split tests 90 %, import 5 %, transform 3 % | the import+transform share rises above ~20 % |
| B4 | reversible-technical | evidence | Images pinned to the rollout's destination (`ubuntu-26.04`, `macos-26`), not back to 24.04 | job logs 2026-10-21: `ubuntu-latest` already served `ubuntu-26.04`, `macos-latest` `macos-26-arm64` | an image breaks a suite |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A test file stops running | product | A sequencer bug assigns a file to no shard and coverage drops silently | 1.2 asserts each file lands in exactly one shard; unknown files get the median weight, never zero | Phase 1 — Assign files by duration |
| 2 | Snapshot goes stale | implementation | The suite drifts and balance decays back toward the count-based result | The refresh script is one command and the per-shard times are recorded each time the comment is updated | Phase 1 — Assign files by duration |
| 3 | Cache poisoning across refs | implementation | A PR writes a cache that main later restores | Saves only on `main`; PRs restore read-only | Phase 2 — The critical path carries only gating work |

## Acceptance Criteria

- [x] AC-1 — Every vitest file in the node-tests set runs in exactly one shard.
- [ ] AC-2 — The slowest-to-fastest shard ratio on this PR's run is recorded and
      lower than the count-based 2026-08-18 ratio.
- [x] AC-3 — The placement of the diagnostic-only step in Static Checks is decided on
      evidence (council 2026-10-22, decision B: it stays). Rewritten from "no diagnostic-only
      step remains", which assumed Static Checks was on the critical path; it is not.
