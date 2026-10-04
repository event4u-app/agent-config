<!-- evidence-type: analysis -->

# Touched-file quality — shadow readings, 2026-Q4

Phase 2 step 2.1 of `road-to-touched-files-that-pass-their-own-tools`. Opened on
`drain/touched-files-own-tools-20261001`, based on `origin/main` @ `a03f60c46`,
2026-10-01.

**STATUS: THE WINDOW IS OPEN AND EMPTY.** Step 2.1 asks for one RELEASE of
shadow readings. The instrumentation that produces them landed in this change;
no release carrying it has shipped, so the three stop-counters below are
necessarily zero and the step stays `- [ ]`. This page exists now rather than
after the release because the counters have to be *defined* before they are
*counted* — a definition written after the data is a definition fitted to it.
What it does carry is a measured latency median, which needed no release.

Reading this page as if it closed 2.1 would be the failure its own roadmap names
elsewhere: a number written before the thing it describes exists.

## What `shadow` is

`hooks.verify_before_complete.touched_file_quality: shadow` makes the existing
`verify-before-complete` stop concern run the commands **the consumer's own
toolchain resolver already lists** against the files the turn edited, and record
the result in `quality_runs[]` on the per-session record. It emits nothing, it
exits 0 on every path, and nothing it records is ever read as verification. The
default is `off`, where none of the above happens and the record is byte-identical
to what it was before the field existed.

## The four counters — defined before they are counted

| Counter | Definition | Source field |
|---|---|---|
| `stops_with_edits` | stop events where the turn's recorder reported ≥ 1 edited file | `edits_this_turn ≥ 1` on the same record |
| `stops_with_entries` | stop events where `quality_runs` carries ≥ 1 row | `quality_runs.length ≥ 1` |
| `stops_with_a_verdict` | stop events where ≥ 1 row has `skipped: null` **and** `exit_code ≠ 0` | `quality_runs[].exit_code` |
| `median_wall_ms` | median wall time of the pass at stop | measured, see below |

**`skipped:*` rows are counted apart and never as verdicts.** This is the one
counting rule that is load-bearing rather than bookkeeping. A row reading
`skipped: absent` means the tool is not installed — detection upstream is by
manifest (`typescript` in `devDependencies`), not by presence on PATH — and a
counter that read absence as a red would report a clean machine as a failing one.
The same holds for `unscoped` (`tsc --noEmit` has no per-file form) and
`no_files` (the turn edited nothing this tool reads).

| Skip reason | Meaning | Counted as |
|---|---|---|
| `absent` | ENOENT or exit 127 — the tool is not installed | neither pass nor fail |
| `unscoped` | no per-file form, so it was never run | neither |
| `mutating` | the command writes files and has no known check form | neither |
| `no_files` | the turn touched nothing this tool reads | neither |

## Release-window readings

| Counter | Value | Window |
|---|---|---|
| `stops_with_edits` | 0 | no release carries the instrumentation yet |
| `stops_with_entries` | 0 | — |
| `stops_with_a_verdict` | 0 | — |

Zero here means **not yet observed**, not **observed to be zero**. The two are
different claims and only the first is supported.

## Latency — measured, pre-release

`./scripts-run src/scripts/bench_touched_file_quality` builds a consumer-shaped
throwaway project (five TypeScript files, `package.json` declaring `typescript`
and `eslint`, a flat ESLint config, `git init`, a seeded recorder state) with
`node_modules` symlinked to this repository's, so `npx eslint` is a real installed
linter running offline. It then times `collectTouchedFileQuality` — the exact
function the stop path calls, covering the recorder read, `git status`,
`resolve_toolchain` and every spawn.

Three runs on one machine (Apple Silicon, macOS 25.6):

| Date | runs | p50 ms | p95 ms | max ms |
|---|---|---|---|---|
| 2026-10-01 | 20 | 267.498 | 301.577 | 310.713 |
| 2026-10-01 | 30 | 242.969 | 443.571 | 506.567 |
| 2026-10-05 | 20 | 321.833 | 381.845 | 387.837 |

**`median_wall_ms` ≈ 243–322 ms** for this shape, and the p95 is the number worth
arguing about: across three runs of the same fixture on the same machine it reads
302, 444 and 382 ms, so the tail is dominated by process-start variance rather
than by the work. A single reading of it would have been a false precision.

The third run was taken four days later, on a tree carrying four days of
unrelated main, and it is reported because re-running a recorded figure is the
only way to learn whether it has drifted. It had not: 382 ms lands inside the
302–444 band the first two runs had already described, which is the band's own
claim surviving a test it had not yet had. The p50 moved up by ~55 ms against the
first run and ~79 ms against the second — same order as the p95 spread, and on a
two-point-versus-one-point comparison that is not a trend anyone should price.
What all three readings agree on is the shape of the answer: a few hundred
milliseconds, dominated by process start, with no project-wide typecheck in it.

What ran, and what did not:

- executed — `npx eslint mod0.ts … mod4.ts`
- skipped — `npx tsc --noEmit → unscoped`

That second line is risk 1 of the roadmap discharged in the measurement rather
than in prose: `tsc --noEmit` has no per-file form, so the pass does not run a
project-wide typecheck at every stop. Had it done so, this table would read in
seconds.

**The number is one machine's, and its dominant term is whichever tools the
fixture's resolver emits.** A consumer whose resolver lands on
`vendor/bin/phpstan analyse` over a large tree measures something else entirely.
It bounds the decision for this shape; it is not a budget, and no default should
move on it alone.

## What closes this step

A release that ships `touched_file_quality`, at least one consumer running it in
`shadow`, and the three stop-counters filled from real `quality_runs` records.
Until then 2.1 is open and 2.3 — the `shadow → warn` default flip, already
deferred to the owner — has no reading to rest on.
