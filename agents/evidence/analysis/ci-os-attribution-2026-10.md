> **Source:** `./scripts-run src/scripts/ci_os_attribution --runs 520 --min-runs 500`, run 2026-10-21 against the Actions API — the 520 most recent completed, non-skipped `Tests` (`tests.yml`) runs, created 2026-10-15T12:03:28Z → 2026-10-21T20:39:07Z, jobs read with `filter=all` (every run attempt).

<!-- evidence-type: analysis -->

# Per-OS failure attribution — `Tests`, October 2026

The instrument ADR-223 trigger (a) names and its own line 88 says does not exist:
how often a macOS job fails while its ubuntu twin passes, and the other way round.

## Method

- **Twin pairing.** The matrix OS token is taken out of the job name inside one
  run attempt: `Node Tests (macos-latest, shard 3/4)` ↔ `Node Tests
  (ubuntu-latest, shard 3/4)`. Different shards never pair.
- **Every attempt counts.** Jobs are read with `filter=all`, so a first attempt
  that failed and a re-run turned green is in the sample. Pairs are formed per
  attempt, never across attempts.
- **Decisive pairs only.** A pair with either side `cancelled`, `skipped` or
  unfinished is dropped (1067 such pairs — mostly runs a newer push cancelled
  through the workflow's concurrency group).
- **Untwinned.** `Collector Lifecycle` runs on macOS only and is reported on its
  own; `Static Checks` carries no OS token and is not a matrix job.

## Sample

| Item | Value |
|---|---:|
| Runs requested / floor | 520 / 500 |
| Runs actually read (jobs fetched) | **520** |
| Runs with ≥ 1 decisive twin pair | 483 |
| Decisive twin pairs | 5365 |
| Pairs ignored (cancelled / skipped / unfinished side) | 1067 |

## Cells

| Cell | Twin pairs | Runs with ≥ 1 such pair | Share of decisive pairs |
|---|---:|---:|---:|
| macOS fail, ubuntu pass | 10 | 10 | 0.2 % |
| macOS pass, ubuntu fail | 20 | 19 | 0.4 % |
| both fail | 143 | 81 | 2.7 % |
| both pass | 5192 | 483 | 96.8 % |

## macOS-only red (macOS fail, ubuntu pass)

| Run | Attempt | Job |
|---|---:|---|
| 39561236073 | 1 | Node Tests (macos-latest, shard 4/4) |
| 39547709325 | 1 | Node Tests (macos-latest, shard 4/4) |
| 39547575932 | 1 | Node Tests (macos-latest, shard 4/4) |
| 39491106966 | 1 | Node Tests (macos-latest, shard 4/4) |
| 39418030261 | 1 | Node Tests (macos-latest, shard 4/4) |
| 39349934909 | 1 | Node Tests (macos-latest, shard 4/4) |
| 39215245068 | 1 | Node Tests (macos-latest, shard 4/4) |
| 39178385825 | 1 | Node Tests (macos-latest, shard 1/4) |
| 38952170813 | 1 | Node Tests (macos-latest, shard 4/4) |
| 38914792426 | 1 | Node Tests (macos-latest, shard 4/4) |

## ubuntu-only red (macOS pass, ubuntu fail)

| Run | Attempt | Job |
|---|---:|---|
| 39672137093 | 1 | Node Tests (ubuntu-latest, shard 1/4) |
| 39500855373 | 1 | SVG Witness Tests (ubuntu-latest) |
| 39310987217 | 1 | SVG Witness Tests (ubuntu-latest) |
| 39310987217 | 2 | SVG Witness Tests (ubuntu-latest) |
| 39213317715 | 1 | Node Tests (ubuntu-latest, shard 4/4) |
| 39155490464 | 1 | Node Tests (ubuntu-latest, shard 4/4) |
| 39144596131 | 1 | Node Tests (ubuntu-latest, shard 4/4) |
| 39064057600 | 1 | SVG Witness Tests (ubuntu-latest) |
| 39064036186 | 1 | Node Tests (ubuntu-latest, shard 3/4) |
| 39016125821 | 1 | Node Tests (ubuntu-latest, shard 4/4) |
| 39015899746 | 1 | SVG Witness Tests (ubuntu-latest) |
| 38998634212 | 1 | SVG Witness Tests (ubuntu-latest) |
| 38993584148 | 1 | Node Tests (ubuntu-latest, shard 3/4) |
| 38979744384 | 1 | Node Tests (ubuntu-latest, shard 1/4) |
| 38947625840 | 1 | SVG Witness Tests (ubuntu-latest) |
| 38938756729 | 1 | Node Tests (ubuntu-latest, shard 1/4) |
| 38921623746 | 1 | Node Tests (ubuntu-latest, shard 3/4) |
| 38907349067 | 1 | Node Tests (ubuntu-latest, shard 3/4) |
| 38870689439 | 1 | Node Tests (ubuntu-latest, shard 3/4) |
| 38808134555 | 1 | Node Tests (ubuntu-latest, shard 3/4) |

## Untwinned

| Job | Seen | Failed |
|---|---:|---:|
| Collector Lifecycle (macos-latest — the macOS row only) | 536 | 10 |

## Reading

- **macOS catches little that ubuntu misses.** 10 of 5365 decisive pairs
  (0.2 %), in 10 of 520 runs, are macOS-only reds — and ubuntu-only reds are
  twice as common (20 pairs, 19 runs). When a test fails, it fails on both
  runners in 143 pairs (81 runs): the shared failure is the dominant case by an
  order of magnitude.
- **The macOS-only cell is one shard.** 9 of the 10 are `Node Tests` shard 4/4.
  That concentration reads as one test file (or a small set) that is unstable on
  macOS rather than as broad platform coverage — this sample does not name the
  test; the job logs of the runs above do. The ubuntu-only cell is spread over
  `SVG Witness Tests` (7) and Node shards 1, 3 and 4.
- **The macOS-only row has its own signal.** `Collector Lifecycle` failed in 10
  of 536 jobs; with no ubuntu twin, this sample cannot say whether those are
  platform-specific or code defects.
- **What this does not measure.** Whether a macOS-only red was a real platform
  defect or a flake, and whether a defect would later have reached a macOS user.
  A repeat-offender shard is the first thing to inspect before reading 0.2 % as
  "macOS finds nothing".
