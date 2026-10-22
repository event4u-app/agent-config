> **Source:** `./scripts-run src/scripts/ci_time_to_green --days 7 --highlight-run 39644704455`, read 2026-10-21 against the Actions API — every workflow, runs created 2026-10-14T22:19:24Z → 2026-10-21T22:19:24Z; full output in `agents/reports/ci-time-to-green.{json,md}`.

<!-- evidence-type: analysis -->

# CI time-to-green, queue included — October 2026

First reading of the unit nothing measured before: how long a job waits for a
runner (`started_at − created_at`) next to how long it runs, and how long a head
SHA takes from its first run to green.

## Method

- **Per job:** queue = `started_at − created_at`, execution = `completed_at −
  started_at`. Skipped and unstarted jobs are not timed. OS comes from the runner
  labels, falling back to the job name.
- **Per head SHA, per event** (`pull_request:<sha>` and `push:<sha>` are separate
  groups): *all-green* = first run created → last job completed, only when every
  run and job concluded success / skipped / neutral; *required-green* = first run
  created → the later of `Sync + Generate Tools Consistency` and `Standing
  payload delta + budget gate` completed, only when both exist and are green.
  A re-run keeps its run's original `created_at`, so time-to-green includes the
  wait before a human re-run.
- **Percentiles** are nearest-rank. Windows are listed in 6-hour slices (the
  listing API caps a query at 1000 results).
- **Two units, never compared:** per-job queue/execution and per-SHA wall time
  answer different questions.

## Sample

| Item | Value |
|---|---:|
| Window | 7 days |
| Runs listed (all workflows) | 6835 |
| Runs with jobs read | 6619 (the other 216 concluded `skipped` and asked for no runner) |
| Jobs timed | 24989 |
| Head SHAs (pull_request / push) | 476 / 204 |
| Truncated | no — the first pass stopped at the API rate floor and said so; the resumed pass read every non-skipped run from cache plus the rest |

## Queue and execution per job — OS × event

| OS | Event | Jobs | Queue p50 | Queue p90 | Exec p50 | Exec p90 |
|---|---|---:|---:|---:|---:|---:|
| macos | pull_request | 5628 | 5m34s | 25m09s | 2m18s | 9m34s |
| macos | push | 2309 | 3m08s | 15m47s | 1m59s | 8m59s |
| ubuntu | pull_request | 12117 | 29s | 3m34s | 56s | 6m06s |
| ubuntu | push | 4016 | 3s | 1m23s | 53s | 6m09s |
| windows | pull_request | 480 | 24s | 1m13s | 3m19s | 3m44s |
| windows | push | 385 | 3s | 37s | 3m15s | 3m37s |

Rows under 50 jobs (schedule, workflow_dispatch, dynamic) are in the report file
and omitted here.

## Time to green per head SHA

| Event | SHAs | All-green n | All-green p50 | All-green p90 | Required-green n | Required-green p50 | Required-green p90 |
|---|---:|---:|---:|---:|---:|---:|---:|
| pull_request | 476 | 226 | 21m17s | 51m44s | 317 | 11m36s | 13m21s |
| push | 204 | 111 | 14m51s | 28m24s | 0 | — | — |

On `pull_request`, 250 of 476 SHAs never reached all-green inside the window
(a red job somewhere, or a newer push cancelled the run) while 159 never reached
required-green. On `push` the required-green column is empty by construction:
`Standing payload delta + budget gate` does not run on push, so every push SHA
reads as *missing* a required check rather than green.

## Named row — run 39644704455 (PR #2569, `Tests`)

Head SHA `2302af8a`: required-green after **10m38s**, all-green after
**40m07s**; the `Tests` run's span is 40m07s.

| Job | OS | Queue | Exec |
|---|---|---:|---:|
| Install Script Tests (macos-latest, shard 4/4) | macos | 32m57s | 1m56s |
| Node Tests (macos-latest, shard 1/4) | macos | 31m31s | 8m35s |
| Node Tests (macos-latest, shard 4/4) | macos | 27m34s | 8m26s |
| Install Script Tests (macos-latest, shard 2/4) | macos | 23m50s | 1m52s |
| Install Script Tests (macos-latest, shard 1/4) | macos | 21m54s | 1m57s |
| SVG Witness Tests (macos-latest) | macos | 21m45s | 3m01s |
| Install Script Tests (macos-latest, shard 3/4) | macos | 21m10s | 59s |
| Golden Tests (macos-latest) | macos | 19m52s | 1m15s |
| Workspace Tests (macos-latest) | macos | 19m45s | 1m44s |
| Install Aux Tests (macos-latest) | macos | 19m25s | 2m16s |
| Collector Lifecycle (macos-latest — the macOS row only) | macos | 9m21s | 5m35s |
| Node Tests (macos-latest, shard 3/4) | macos | 7m15s | 12m27s |
| Node Tests (macos-latest, shard 2/4) | macos | 5m41s | 6m24s |
| Node Tests (ubuntu-latest, shard 4/4) | ubuntu | 5m23s | 6m23s |
| Workspace Tests (ubuntu-latest) | ubuntu | 4m46s | 1m16s |
| Install Script Tests (ubuntu-latest, shard 1/4) | ubuntu | 3m03s | 1m04s |
| Install Script Tests (ubuntu-latest, shard 3/4) | ubuntu | 51s | 1m09s |
| Node Tests (ubuntu-latest, shard 2/4) | ubuntu | 46s | 6m11s |
| Install Script Tests (ubuntu-latest, shard 2/4) | ubuntu | 37s | 1m04s |
| Install Script Tests (ubuntu-latest, shard 4/4) | ubuntu | 31s | 1m22s |
| Golden Tests (ubuntu-latest) | ubuntu | 15s | 1m30s |
| Install Aux Tests (ubuntu-latest) | ubuntu | 2s | 1m29s |
| Static Checks (ESLint · typecheck · prepack) | ubuntu | 2s | 6m07s |
| SVG Witness Tests (ubuntu-latest) | ubuntu | 2s | 2m25s |
| Node Tests (ubuntu-latest, shard 3/4) | ubuntu | 2s | 8m40s |
| Node Tests (ubuntu-latest, shard 1/4) | ubuntu | 2s | 5m19s |

The roadmap's context line said every ubuntu job on this run started within
2-63 s; the measured ubuntu queue reaches 5m23s (Node shard 4/4) and 4m46s
(Workspace). The macOS range (5m41s to 32m57s) matches.

## Reading

- **macOS queue is the dominant term.** On pull requests a macOS job waits a
  median 5m34s and a p90 25m09s for a runner — longer than it then runs (p50
  2m18s, p90 9m34s). ubuntu waits 29s / 3m34s.
- **The required checks are not what the owner waits for.** Required-green on a
  PR lands at p50 11m36s; all-green, which is what a green PR page shows, at p50
  21m17s and p90 51m44s. The gap is mostly macOS queue in `Tests`.
- **One window, one week.** This is a single 7-day reading, taken during an
  active merge week; the weekly report (roadmap step 3.1) is what turns it into
  a comparison of like windows.
