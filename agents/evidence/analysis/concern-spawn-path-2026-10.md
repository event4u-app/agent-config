# Concern spawn path — 2026-10

<!-- evidence-type: analysis -->

> **Pin:** `adaad0aa2` (`main`, 2026-10-07). Written by step 4.1 of
> `road-to-a-ratification-fence-that-follows-its-imports` as the receiver for
> the half of the archived plumbing roadmap's AC-3 that was carried "as the
> narrowing it is": a timeout of `sla_ms × 3` needs a spawn-path measurement,
> and the tree had none.

## Command

```bash
npx tsx src/scripts/bench_concern_spawn_path.ts --runs 20 --concern block-no-verify
```

The bench replicates `dispatch_hook._run_concern`'s isolated branch: the
`tsx` binary from `node_modules/.bin`, the envelope from `_build_envelope`,
`hardenedSpawnEnv`, the envelope on stdin and `--platform claude`. The payload
is an ordinary `Bash` call (`ls`), so the concern allows (exit 0 on every run).
It does not include the dispatcher's own start-up, which is paid once per
event rather than once per concern.

## Runner

darwin arm64 · Apple M5 Max · 18 cpus · node v26.7.0 — a developer laptop,
not the GitHub `ubuntu-latest` reference class `concern_sla_ms` was derived on.

## Reading

Concern: `block-no-verify` (`severity: blocking`, `pre_tool_use`). Three
passes, n = 20 each.

| Pass | p50 | p95 | max |
|---|---|---|---|
| 1 | 109.4 ms | 156.0 ms | 309.4 ms |
| 2 | 87.4 ms | 89.7 ms | 90.7 ms |
| 3 | 88.8 ms | 99.3 ms | 101.2 ms |

The first pass carries a cold-cache tail; passes 2 and 3 are the warm reading.

## What the reading says

`concern_sla_ms` registers `block-no-verify` at 0.921 ms, so `sla_ms × 3` is
2.8 ms. The warm spawn-path p95 here is roughly 90 to 100 ms — about thirty
times that bound, on the fastest machine class measured, before any loaded CI
runner. A spawn timeout of `sla_ms × 3` would kill every blocking concern
before its interpreter finished loading, which on the isolated route
`_resolve_execution_failure` turns into a deny. The reading therefore confirms,
with a number, what `SPAWN_TIMEOUT_MS`'s comment in
`src/scripts/hooks/concern_failure_policy.ts` argued from the bench's control
row: `sla_ms × 3` is not tenable as a spawn-path timeout.

This is a reading, not a wiring. Nothing here changes `SPAWN_TIMEOUT_MS`, and
the roadmap that asked for the measurement keeps wiring a later decision.

## Limits

- One concern, one machine class. A GitHub-runner reading is not taken here;
  the reference class measured slower than darwin on every in-process row, so
  this page understates the runner's spawn cost rather than overstating it.
- An allowing payload. A refusing path runs a few more lines of the concern
  and is not expected to move a number dominated by interpreter start.
