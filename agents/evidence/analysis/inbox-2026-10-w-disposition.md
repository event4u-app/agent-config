# Inbox round inbox-2026-10-w — disposition

<!-- evidence-type: analysis -->

> **Source:** `agents/tmp.old/inbox-2026-10-w/` — one transcript (3 turns), two
> supplied CI-speed plans (plan A English, plan B German), one topic. Both plans
> pinned at `main@95dbe28`; every claim re-verified against `main@5dcfa13a6`
> on 2026-10-21. Census: 3 files, 143 anchors, 0 revision sets.

## Recurrence

Second arrival of duration-balanced shards and shadow-mode test selection (an
inbox round on test economy, 2026-08-10, harvested into the archived 2026-08
ci-economy roadmap, which measured the shard imbalance and closed without
adopting either). Fourth arrival of the merge queue (two earlier feedback rounds,
inbox-2026-10-f, this round); its ruleset write is held by
`stubs/road-to-main-protection-ruleset-changes` (council disposition B, repo-admin).
Outcome per `recurring-criticism`: **right, recorded, unreachable** for the shard
fix (no record of why it was dropped; it now has an executable roadmap) and
**right, recorded, owner-held** for the queue (the in-repo precondition is now
executable; the toggle stays the owner's).

## Claims — verified

| Claim set | Verdict | Note |
|---|---|---|
| Plan A M1-M24 | still-true, 22 · corrected, 2 | 118 enforced gates, not 113 (5 rows default to enforced); `reportScanned` already exists with 111 callers and `assertScanned` 219, not 41 |
| Plan A D1-D7 | still-true | D3's premise "strict off" confirmed live on ruleset `17749383` |
| Plan B § 1 timings | still-true | PR #2569 Actions jobs API: ubuntu jobs started within 0 s-5m23s (first misread as 63 s; corrected from `ci-time-to-green-2026-10.md`), macOS 5.7-33 min |
| Plan B § 1 "existing optimizations" | still-true | concurrency, npm cache, 2×4 shards all present |

Found by this run, not in either plan: `ci_status.ts:35-46` requires a
`Python Version Sweep` workflow that no longer exists; `ci-cost-budget.md:56`
counts 24 jobs (now 26) and has no `svg-witness-tests` row.

## Instructions — reproduced

| Step | Verdict | Corrected step |
|---|---|---|
| Plan A 1.2 "floor travels with the gate" | **diverged** | Floors are calibrated per `argv` in `gate-coverage.yml`; only 26 of 118 rows name a CI invocation, so an in-gate floor would compare counts from a different invocation. Replaced by concurrent execution + single-boot shim + same-job floor assertion for `check_static_parity` (`corrected-from-reproduction`) |
| Plan A annex (local step timing) | out-of-bound | Needs a full clone and a Python helper not supplied; the CI figures were re-read from the Actions API instead |

## Demands — discharged

| ID | Demand | Discharge | Where |
|---|---|---|---|
| W-D01 | CI must get faster (turn 1) | adopted | all four roadmaps below |
| W-D02 | **Constraint:** without losing security/coverage (turn 1, both plans) | adopted as constraint | each roadmap's Goal + ACs (no gate, platform or required check removed) |
| W-D03 | "Matrix runner?" | declined | more macOS jobs against a 5-slot ceiling lengthen the queue (Actions API, PR #2569) |
| W-D04 | SLO targets p50 ≤ 5 / ≤ 12 min | declined as targets | estimates; ACs are stated against measured baselines instead |
| A-0.1/0.2/0.3/0.4, A-6.1/6.3, B-001, B-060 | measure time-to-green, per-OS attribution, contract re-run, ADR-223 revisit, weekly report | adopted | `road-to-ci-time-that-counts-the-queue` |
| A-1.1, A-1.3a, A-1.4, B-012 | required job: dedupe static parity, one tsx boot, timeout | adopted | `road-to-a-required-check-that-does-not-rerun-the-gates` |
| A-1.2 | in-gate floor | declined | diverged, see above |
| A-1.3b | esbuild gate bundles | declined | gain over the single-boot shim is unmeasured; revisit if 1.1's per-gate timings show boot dominating |
| A-4.1, A-4.3, A-4.4, B-010, B-011, B-020, B-052, A-2.3 (images) | balanced shards, render(), caches, diagnostics off path, pin images | adopted | `road-to-a-test-matrix-that-finishes-together` |
| A-2.1, A-2.2, A-3.3, B-030 | macOS PR tier, one macOS install job, aggregate check | adopted | `road-to-macos-where-the-platform-is-the-point` |
| A-3.1, A-3.2 | merge queue, stop `push: main` Tests | owner-decision | ruleset write held by `stubs/road-to-main-protection-ruleset-changes`; only the in-repo precondition is adopted (macOS roadmap Phase 3) |
| A-2.4, B-051 | paid / larger / self-hosted runners | owner-decision | spend; neither plan proposes it before the queue lever is measured |
| A-4.2, B-040..042 | test selection / impact CI | declined | 191 test files spawn subprocesses (2026-08 measurement), invisible to import-graph selection, and no full pre-merge suite exists without a merge queue |
| A-5.1 | `ci_settle --scope` | already-held | owned by `road-to-agent-throughput-recovery` 3.2 (council D9); arrival recorded on `stubs/the-ci-waiter-that-needs-re-arming` |
| A-6.2 | cost per gate + census red when missing | adopted in part | timings only (required-check roadmap 1.1); a new red gate without a measured false-positive rate is declined |
| A-2.3 (setup-task) | replace Node-20 action | declined | already `continue-on-error` with a curl fallback (`setup-task/action.yml:20-47`); noise, not time |
| B-002 | SLOs | declined | see W-D04 |
| B-003 | per-check owner/risk inventory | declined | `gate-coverage.yml` + `ci-cost-budget.md` carry it; a parallel inventory would drift |
| B-013 | profile enforcement-coverage / backstop-debt | declined | Rule Backstops is not required; revisit if the time-to-green reading puts it on the critical path |
| B-021 | shared build artifact | already-satisfied | rejected on measurement, `ci-cost-budget.md:179-192` |
| B-022 | cross-workflow redundancy scanner | adopted in part | the one measured redundancy (static parity) is removed; a general scanner is declined |
| B-031, B-050 | max-parallel / forks-vs-threads benchmarks | declined | subprocess-heavy suites; no evidence either lever is on the critical path |
| B-032 | nightly full matrix | already-satisfied | `push: main` runs the full matrix today |
| B-061 | CI-doctor CLI | declined | the time-to-green script is the instrument; no new CLI surface |
| B-062 | agents implement in a worktree | already-satisfied | this run |

## Ledger

```
claims        2 plans' claim sets → still-true / 2 corrected counts / 0 already-fixed
instructions  2 extracted → 1 diverged (corrected) / 1 out-of-bound
demands       51 extracted → adopted 28 / already-satisfied 3 / already-held 1 / declined 15 / owner-decision 4
anchors       143 counted → all behind a row above or the plans' prose sections they summarise
topics        1 → 4 roadmaps
```
