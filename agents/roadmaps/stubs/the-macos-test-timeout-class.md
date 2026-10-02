---
complexity: lightweight
review_by: 2026-12-01
probe: none
---

# Stub: the 10 s `testTimeout` measures the macOS runner, not the code

> **Stub — not active work.** Surfaced during the 2026-10-01 estate drain, on a
> branch whose own subject was unrelated (a `ci_settle` argument guard). Filed
> rather than fixed because the council that reviewed it prescribes a
> measurement step this run could not perform.

## The observation

Seven recorded instances, over five distinct test files, have crossed vitest's
global `testTimeout: 10_000` on macOS CI — across three consecutive runs of one
branch and two later lanes, in two different shards.
Each failed with `Error: Test timed out in 10000ms`; each passes locally in
2.5-3.5 s.

| Run | File | Shard |
|---|---|---|
| 1 | `lint_agent_security_coverage_floor.test.ts` (10145 ms) | 1/4 |
| 2 | `run_continuation_dispatch.test.ts` | 1/4 |
| 2 | `memory_learn_hook.test.ts` | 1/4 |
| 3 | `lint_agent_security.test.ts` | 4/4 |

A fifth instance hit an unrelated lane the same day (`lint_agent_security` at
10205 ms, PR #2135) and was resolved by re-running the job.

A sixth and a seventh landed on PR #2148 (2026-10-01), on a diff that touches
neither gate: `lint_agent_security.test.ts` at 10005 ms on shard 4/4, and then,
on the re-run of that same job, `release.test.ts:889` at 12781 ms on the same
shard. These two are why the class is recorded as a *population* rather than a
file list: the re-run did not reproduce the first file, it produced a different
one. A per-file timeout would have moved the failure, not removed it.

Every affected test either spawns a subprocess or runs a tree-scanning gate in
process. The population is **not enumerable in advance** — it is "every test
that scans the tree or spawns a process", a large and growing fraction of the
suite. That is what defeats the per-file remedy.

## Why the obvious fix is locked, and why the lock does not settle this

`vitest.config.ts` rules out the global raise in terms: *"it is a real guard on
a CLI's wall-clock, and widening it to absorb a concurrency change would retire
the guard to hide the cause"*, and names a per-test timeout on the spawn-bound
files as the next move instead.

**Mechanism-match: that lock was written against a CONCURRENCY change** — the
`maxWorkers` move to `'50%'`. The cause here is identified and different: a
macOS runner roughly 3-4x slower for subprocess work, where the ceiling
measures the platform rather than the code. A lock settles the mechanism it
tested, not every later proposal that resembles it.

Two per-describe 30 s exceptions were applied following the config's literal
instruction (`memory_learn_hook.test.ts`, `run_continuation_dispatch.test.ts`,
plus one per-case in `lint_agent_security_coverage_floor.test.ts`). Each closed
the instance it named; a new file crossed the ceiling on the next run. The
remedy was tried, twice, and is recorded here as tried rather than assumed
unworkable.

## Council verdict — 2026-10-01, 2/2 present, $0.00, both seats subscription-authed

Members `anthropic/claude-sonnet-4-5` and `openai/codex-default`, two rounds.
Convergent on direction; the second seat narrowed the first seat's proposal on
three points, and the narrowing is the finding:

1. **Scope it to macOS CI, not all CI.** `process.env.CI ? 30_000 : 10_000`
   weakens the guard on Linux and every other CI environment without evidence
   that they need it. The class fires on one platform.
2. **The 30 s figure is not empirically justified.** The two completed CI
   timings are ~10.1 and ~10.2 s; local times times the claimed multiplier
   suggest 10-14 s. The value should come from an observed p99, not from a
   round number.
3. **A subprocess needs its own timeout, and this is the half vitest cannot
   cover.** `execFileSync` blocks the JS thread, so vitest's timeout is not a
   termination mechanism for a stuck child — it can only report after control
   returns. Genuine hang protection therefore belongs on the `execFileSync`
   call, ideally via a shared helper raising a distinct error so "child hung"
   stays distinguishable from "test exceeded its budget".

Both seats rejected per-file patching and a separate vitest project, for the
same reason: the affected population has no stable enumerable boundary.

**The missing fact, named by the council rather than by this stub:** the
distribution of healthy macOS-CI test durations under normal shard contention —
p95, p99 and the maximum across several runs. Also useful, though not required
to reject per-file patching: how often a genuine hang has ever been caught
between 10 s and any proposed new ceiling. The repository records no instance
of one, which is a gap in the evidence and not evidence of absence.

## What closing this looks like

1. Collect per-test durations from several macOS CI runs.
2. Set a macOS-CI-scoped `testTimeout` to the observed p99 plus stated headroom;
   retain 10 s everywhere else.
3. Add explicit `execFileSync` timeouts through a shared helper.
4. Surface tests crossing a softer threshold, so a regression stays visible
   rather than being absorbed by the new ceiling.
5. **Remove the three per-describe and per-case exceptions** once the platform
   policy supersedes them — they are instance patches, and leaving them under a
   class policy would hide the next regression in the files that already have
   the most headroom.
6. Revisit the worker count only if duration-versus-concurrency data shows
   contention materially causes the tail.

## What this stub deliberately does NOT do

Pick the number. Doing so without step 1 would repeat the exact error the
council named in the proposal that reached it, and a value chosen to make a red
go away is the thing a wall-clock guard exists to prevent.
