---
stability: beta
keep-beta-until: 2026-09-04
---

# CI Cost Budget

> **Status:** active · **Owner:** maintainer · **Opened:** 2026-05-26 ·
> **Review cadence:** quarterly (next: 2026-08-26)
>
> Measured durations + trigger surfaces for every PR-blocking CI job in
> `.github/workflows/`. Sets a per-job wall-clock budget (5 min average)
> beyond which the job either earns its cost in writing or gets a
> follow-up optimisation step. Companion to
> [`release-pr-gating.md`](release-pr-gating.md) and
> [`branch-protection-policy.md`](branch-protection-policy.md).

## Baseline (re-measured 2026-08-11)

**Method.** `tests.yml` rows are per-job durations from the GitHub Actions
jobs API (`/actions/runs/<id>/jobs`), averaged over the three most recent
**successful** main-branch runs. Non-`tests.yml` rows are run-level
wall-clock from `gh run list --branch main --json
conclusion,startedAt,updatedAt`, averaged over the last 4–6 successful runs;
those workflows are single-job, so run-level is the job figure plus queueing.
Recorded from CI, never from a developer machine — a locally captured
baseline measures the environment offset instead of the regression
(`docs/hook-latency.json:2`).

`tests.yml` declares 6 job keys that matrix-expand to 23 jobs. The table
lists each shard family once, with the per-shard average.

| Workflow | Job | OS × variant | Avg duration | Trigger surface |
|---|---|---|--:|---|
| `tests.yml` | `install-tests` | 4 shards × 2 OS | 51 s ubuntu / 85 s macOS | `scripts/**`, `tests/**`, `src/**`, manifest pins |
| `tests.yml` | `install-aux-tests` | 2 OS | 64 s ubuntu / 118 s macOS | same as above |
| `tests.yml` | `node-tests` shards 1, 2, 4 | 2 OS × 3 shards | 125–152 s | same as above |
| `tests.yml` | `node-tests` **shard 3/4** | 2 OS | **645 s ubuntu / 852 s macOS** | same as above — over ceiling, see below |
| `tests.yml` | `static-checks` | ubuntu, no matrix | 131 s | same as above |
| `tests.yml` | `golden-tests` | 2 OS | 132 s ubuntu / 138 s macOS | same as above |
| `tests.yml` | `workspace-tests` | 2 OS | 98 s ubuntu / 85 s macOS | same as above |
| `smoke-public-install.yml` | `smoke` | 3 OS × 2 Node | 291 s | install paths + setup.sh + templates |
| `consistency.yml` | (single) | ubuntu | 109 s | always-on (PR / push) |
| `smoke.yml` | smoke-contracts | ubuntu | 82 s | `scripts/schemas/**` |
| `skill-lint.yml` | (single) | ubuntu | 66 s | `dist/agent-src*/**`, schemas |
| `release-guard.yml` | (single) | ubuntu | < 10 s | tag-trigger only |

Three rows from the 2026-05-26 baseline were removed because the jobs and
workflows they named no longer exist: `python-tests` (no such job key in
`.github/workflows/`), `windows-lockfile-export.yml` and
`migration-dry-run.yml` (both files absent). `node-tests` was recorded as
"2 OS" when it is 2 OS × 4 shards, which hid the shard-3 outlier below.

**Two regressions against the 2026-05-26 figures, flagged per checklist
item 2 (> 25 %):** `consistency.yml` 27 s → 109 s and `smoke.yml` 18 s →
82 s. Both are well under the ceiling, so neither earns a follow-up step on
cost grounds alone, but `consistency.yml` is the single required check
(`branch-protection-policy.md:59`) and therefore sits on every PR's critical
path. `smoke-public-install.yml` moved the other way, 413 s → 291 s, and is
no longer a ceiling violation.

**The build step is not a cost driver — measured, not assumed.**
`npm run build --silent` runs in 13 of the 23 matrix-expanded jobs and
measured **5–10 s in every one of them** across the three sampled runs. In
the slowest job in the matrix the full step breakdown is: set-up 1 s,
checkout 4 s, setup-node 6 s, `npm ci` 6 s, discovery manifest 1 s, build
8 s, **Vitest 594 s**. The build is ~1.3 % of that job.

A "build once in a producer job, share `dist/` as an artefact" refactor was
evaluated against this row on 2026-08-11 and **rejected**: it would add a
serial producer job (≈ 25 s of checkout + setup-node + `npm ci` + build)
that every consumer waits on, plus upload and download, converting a
parallel 8 s into a serial ~35 s. Consumers still need their own `npm ci`.
The consistency argument for one canonical `dist/` does not apply either —
the freshness gate is green in every building job today, so the builds are
already byte-identical, and building once on one OS would drop the
cross-platform check that the build works on macOS too.

**Revisit only if** the build step exceeds producer-job overhead by ~3×
(a build above ~75 s against ~25 s of overhead) **and** artifact transfer
stays under ~5 s. A build that has grown 10× is more likely a signal that
the tree needs package boundaries than an artefact-caching opportunity.

**Critical path observations — historical, as recorded 2026-05-26.** Kept
for the trail; the two sibling workflows named below were later removed
outright, so neither describes a job that runs today.

- `smoke-public-install.yml` and `tests.yml` dominate non-release-PR
  wall-clock. Both trigger on `package.json` — a release PR (which only
  touches `package.json` + CHANGELOG + marketplace + pack manifests)
  pulled the full matrix on every bump pre-Phase A.
- `tests.yml` `python-tests` ran four Python versions on Linux + 3.12 on
  macOS on every PR touching `scripts/**`. The 3.10 / 3.11 / 3.13 legs
  are extras: they prove the supported range but rarely surface a
  Python-version-only regression. Moved to a path-filtered sibling
  workflow in Phase C Step 2 — **and that workflow is now gone too**; the
  tree carries no Python test leg (`no-python-in-src.yml` asserts the
  absence instead).
- `tests.yml` `windows-lockfile-export` fired on every PR touching
  `scripts/**` even when the PR never went near `install_global` /
  `cmd_export`. Moved to its own path-filtered workflow in Phase C
  Step 1 — **also since removed**; there is no Windows leg in CI today.

## Expected savings (post-optimisation)

The Phase A guards on `tests.yml` + `smoke-public-install.yml` cut
release-PR critical-path from `218 s + 413 s` (serial worst case ≈ 11
min) to `~30 s` (`Consistency` + `Smoke Contracts` + new `Release
Validation`). Phase C cuts feature-PR critical-path by removing the
Windows leg (60–90 s) and the 3-version Python sweep from PRs that
don't touch Python paths.

| Scenario | Pre | Post | Reduction |
|---|--:|--:|--:|
| Release PR (release/X.Y.Z) | ~660 s | ~60 s | –91 % |
| Feature PR touching scripts/** but no install_global / cmd_export | ~700 s | ~600 s | –14 % |
| Feature PR touching only docs/** | ~30 s (consistency) | ~30 s | unchanged |
| Feature PR touching Python paths only on 3.12 | ~700 s | ~700 s | unchanged (baseline still runs) |

## Per-job cost ceiling — 5-min average

Any job averaging **> 5 min wall-clock** across the most-recent 50
main-branch runs requires one of:

1. A documented justification in this file ("This job protects
   property X; shrinking it would mean losing the regression Y").
2. A follow-up optimisation step opened in the next quarterly review.
3. An ADR superseding the ceiling for this specific job (e.g. integration
   smoke that proves a real consumer-visible promise).

Current jobs above the ceiling (2026-08-11): **`tests.yml` `node-tests`
shard 3/4**, at 645 s on ubuntu and 852 s on macOS — 2.2× and 2.8× the
ceiling. Its sibling shards run 125–152 s, so this is not a whole-suite
cost: `Vitest (shard 3/4)` alone accounts for 594 s of a 673 s job.

**The cause is one test file, and it is not subprocess overhead.** A
per-file duration pass over 977 files (local, `--reporter=json`; relative
durations, not a CI baseline) put `tests/scripts/build_proof.test.ts` at
**290 s — 19.5 % of total file-time and 8.7× the next-slowest file**. It
spawns nothing. It called `render()` five times, and `render()` costs
~54 s because it walks the whole claims ledger. Four of those five calls
were redundant: the file's own first test asserts `render()` is
deterministic, so one result can be reused. Reducing it to the two
independent calls that determinism actually requires took the file from
~260 s to **103 s** wall-clock.

Two consequences worth keeping. The workflow comment on the shard matrix
attributes the clump to "subprocess-heavy clusters"; for the largest
contributor that was not true, so re-check the attribution before acting on
it. And the remaining ~103 s is dominated by `render()` itself at 54 s a
call — the next lever on this file is that function, not the test.

`smoke-public-install.yml` was the previous entry here at 413 s and is now
291 s, under the ceiling. No open ADR is required for it.

## Measurement-only changes — kill criterion

A change that re-measures and re-documents cost without altering any job,
matrix, trigger or required check cannot be judged by whether a regression
escaped: nothing about the pipeline's behaviour changed, so there is no
regression class to escape. Binding such a change to an escaped-regression
count would also require a human to attribute a post-merge failure to it,
which is not mechanically decidable.

The criterion for a measurement-only change is therefore:

> **The refreshed table names every job that exists and none that does
> not.**

Decidable in one pass: every job key in the table resolves to a live job in
`.github/workflows/`, and every job that runs on a PR appears in the table.
A change that alters a job, a matrix dimension, a trigger surface or the
required-check set is *not* measurement-only and does not get this
criterion.

## Quarterly review checklist

Run the first Monday of every quarter:

1. Re-capture the baseline table via `gh run list --branch main --limit
   50 --json name,createdAt,updatedAt` + arithmetic.
2. Compare each row against the previous quarter; flag any > 25 %
   regression.
3. For every row over the 5-min ceiling, file a follow-up step in the
   open CI-roadmap (or in this file's history if no roadmap is
   currently active).
4. Update the "Expected savings" table once optimisations land so the
   delta is provable, not asserted.
5. Audit the path-filter surfaces — when a workflow keeps firing on
   PRs that don't touch its real scope, tighten the filter.

## See also

- [`release-pr-gating.md`](release-pr-gating.md) — release-PR shape
  predicates, cut surface, kept surface.
- [`branch-protection-policy.md`](branch-protection-policy.md) — required
  status check floor per PR shape.
- `src/scripts/ci_time_ratio.ts` — CI-time / local-edit-time ratio per
  touched-path class, run via `task ci:time-ratio`; writes
  `agents/reports/ci-time-ratio.json`.

The two workflow pointers that stood here — a Python version sweep and a
Windows lockfile-export leg — were removed along with their table rows on
2026-08-11: both files are absent from `.github/workflows/`.
