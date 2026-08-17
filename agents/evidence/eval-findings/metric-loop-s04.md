# Spike s04 — replay: would a shipping-intent diff-volume gate have fired usefully?

**Date:** 2026-08-17
**Roadmap:** [road-to-metric-loop-and-review-integrity.md](../../roadmaps/road-to-metric-loop-and-review-integrity.md) Phase 0
**Tree:** `6a679cc19` (branch base `origin/main`)
**Corpus:** the 40 most recently merged PRs of this repository (`gh pr list --state merged --limit 40`), read at 2026-08-17.

## Pre-registration (recorded before the replay ran)

- **Threshold rule:** the p90 of this repository's own merged-PR diff volume — derived here, never copied from the reference that suggested the gate.
- **Precision floor:** **≥ 0.50.** At least half of the firings must be judged useful.
- **Kill:** precision below the floor **cuts** the gate rather than tuning it into noise.

## Result 1 — the metric as drafted FAILS its own floor

Diff volume = `additions + deletions` over all files in the PR.

```
n=40  min=17  p50=870  p75=2653  p90=3975  p95=5669  max=8405
```

Five PRs fire at `>= 3975`. Judged by whether the volume that triggered the
firing reflects review burden:

| PR | raw volume | largest single file | firing useful? |
|---|---:|---|---|
| #1372 | 8405 | `agents/roadmaps/archive/index.json` — **7021 lines, 84 % of the PR** | **no** — a generated index |
| #1385 | 7094 | `…/solution-minimalism-t4-t5-scorers.review-input/diff.patch` — 2849 | yes — genuinely multi-concern (9 review findings) |
| #1370 | 5669 | `…/feat-runtime-skill-routing.review-input/diff.patch` — **3426, 60 %** | **no** — fired on the snapshot, not the change |
| #1379 | 5312 | `…/complexity-endpoint.review-input/diff.patch` — 2118 | yes — two concerns in one title |
| #1360 | 3975 | `…/workspace-identity.review-input/diff.patch` — **1957, 49 %** | **no** — fired on the snapshot |

**Precision = 2/5 = 0.40 < 0.50. The pre-registered kill fires.**

## The cause — the metric counts the same diff twice

Four of the five firings are dominated by
`agents/evidence/reviews/*.review-input/diff.patch`, which **is a committed copy of
the very diff being measured**. A PR that runs a completion review therefore counts
its own change twice and outranks a PR of equal real size that did not. The fifth is
dominated by a generated JSON index.

This is not a badly-chosen threshold. It is a metric measuring the repository's own
review bookkeeping and calling it shipping volume.

## Result 2 — the corrected metric passes cleanly

Excluding `*.review-input/**`, `agents/roadmaps/archive/index.json`, and the
generated projection trees (`dist/`, `.augment/`, `.claude/`, `.cursor/`,
`.clinerules/`):

```
n=40  p50=617  p75=1146  p90=1695  p95=2105  max=3026
```

The ranking changes materially — #1372 falls from rank 1 (8405) to rank 8 (1343),
and two PRs invisible in the raw ranking enter the top five. Five PRs fire at
`>= 1695`:

| PR | corrected | raw | why the firing is useful |
|---|---:|---:|---|
| #1385 | 3026 | 7094 | T4 + T5 endpoints; the completion review found 9 findings |
| #1356 | 2250 | 3374 | "measure codex catalogue truncation **and** repair the council openai seat" |
| #1363 | 2105 | 2105 | "Harvest the 2026-08-d inbox **and** execute the context-ledger roadmap" |
| #1379 | 2076 | 5312 | "complexity endpoint **and** the anti-golfing size verdict" |
| #1360 | 1695 | 3975 | "one resolver **and** a read-only doctor over it" |

**Precision = 5/5 = 1.00.** Every firing is a PR whose own title names two or more
concerns — which is the thing a shipping-intent gate is for.

**The usefulness column is a judgement, not a machine label.** It reads each PR's
title and file composition; it is not derived from a recorded split decision,
because none exists. A future re-run with a mechanical usefulness signal could move
these numbers.

## Verdict and consequence for Phase 4

**The kill fires as written, and cutting the gate on it would be the wrong read.**
The floor was missed by a metric that double-counts; the correction is an exclusion
of the repository's own bookkeeping artefacts, which is a *measurement* fix, not the
threshold tuning the kill criterion exists to forbid. Distinguishing the two is the
point: tuning moves a number until the answer is pleasant; this removes an input
that was never shipping volume.

Phase 4 therefore proceeds **with the exclusion set as part of the gate definition,
not as a tuning parameter**, at a derived threshold of **1695 corrected lines**, and
warn-level first per the roadmap. Should the exclusion set itself need to grow to
keep precision above the floor, that IS tuning and the kill applies.
