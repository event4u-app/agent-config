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

## Baseline (re-measured 2026-08-11 · `tests.yml` rows re-measured 2026-08-18, post-fix)

**Method.** Every row is a **per-job** duration from the GitHub Actions jobs
API (`/actions/runs/<id>/jobs`) — the non-`tests.yml` workflows from the most
recent successful run. Recorded from CI, never from a developer machine — a
locally captured baseline measures the environment offset instead of the
regression (`docs/hook-latency.json:2`).

The `tests.yml` rows are a **50-run average** as of 2026-08-18: the
most-recent 50 **successful** `main` runs, all of them after the shard-3 fix
merged (2026-08-11), aggregated per job name. Three runs was the 2026-08-11
sample and it is not the sample this file's own ceiling clause asks for — the
ceiling is defined "across the most-recent 50 main-branch runs", and the
quarterly checklist prescribes the same jobs-API pass. Three runs also cannot
separate a shard figure from runner variance, which the spread here makes
concrete: shard 3/4 on ubuntu ranges 217–406 s across the 50, so a
three-run sample could have reported anything from 1.0× to 1.4× the ceiling.

A run-level figure (`gh run list … startedAt,updatedAt`) is **not**
interchangeable with a job figure and is not used here. For a matrix workflow
it is the span of the whole fan-out plus queueing, so it exceeds every job in
it: `smoke.yml` reads 82 s at run level and 20–23 s per job. Comparing one
against the other manufactures regressions that did not happen — which is
exactly what the first version of this re-measurement did.

`tests.yml` declares **7** job keys that matrix-expand to **24** jobs. The table
lists each shard family once, with the per-shard average. (It read 6 and 23
until `collector-lifecycle` was added on 2026-08-30 without its row — caught by
a completion review, not by a gate, which is what the note under the table is
about.)

| Workflow | Job | OS × variant | Avg duration | Trigger surface |
|---|---|---|--:|---|
| `tests.yml` | `install-tests` | 4 shards × 2 OS | 49–59 s ubuntu / 83–98 s macOS | `scripts/**`, `tests/**`, `src/**`, manifest pins |
| `tests.yml` | `install-aux-tests` | 2 OS | 62 s ubuntu / 108 s macOS | same as above |
| `tests.yml` | `node-tests` shards 1, 2, 4 | 2 OS × 3 shards | 147–159 s ubuntu / 161–164 s macOS | same as above |
| `tests.yml` | `node-tests` **shard 3/4** | 2 OS | **357 s ubuntu / 516 s macOS** | same as above — still over ceiling, see below |
| `tests.yml` | `static-checks` | ubuntu, no matrix | 140 s | same as above |
| `tests.yml` | `golden-tests` | 2 OS | 124 s ubuntu / 122 s macOS | same as above |
| `tests.yml` | `workspace-tests` | 2 OS | 98 s ubuntu / 100 s macOS | same as above |
| `tests.yml` | `collector-lifecycle` | macOS only, no matrix | **~150 s measured locally, not yet in CI** | same as above |
| `smoke-public-install.yml` | per-OS × Node leg | 3 OS × 2 Node = 6 jobs | 24–30 s ubuntu / 39–47 s macOS / **159–169 s windows** | install paths + setup.sh + templates |
| `consistency.yml` | `Sync + Generate Tools Consistency` | ubuntu, single job | 75 s | always-on (PR / push) |
| `smoke.yml` | `smoke-kernel` · `smoke-router` · `smoke-schema` · `smoke-skills` | ubuntu, 4 jobs | 20–23 s each | `scripts/schemas/**` |
| `skill-lint.yml` | `skill-lint` · `skill-lint-strict` (+ `originality-gate`) | ubuntu, 3 jobs | 34 s · 23 s (strict + originality release-gated) | `dist/agent-src*/**`, schemas |
| `release-guard.yml` | (single) | ubuntu | < 10 s | tag-trigger only |
**`collector-lifecycle`, and why it is macOS-only and not free.** It runs the
five process-level lifecycle properties plus the operator stop verb — six cases,
each spawning one or two real `tsx` daemons — then the supervision-claim gate
that consumes their evidence, then the static-parity comparison (two 556-test
runs). Its duration figure is a LOCAL measurement of the suite plus an estimate
for the parity pair; the CI number is unknown until the job has run, and saying
so is cheaper than publishing a guess in a table of measurements.

It is macOS-only by an AI-council decision (2026-08-29, 2/2), not by preference:
the second declared supported platform is Linux **with a user session bus**, and
no GitHub-hosted runner provides one. Running the suite on `ubuntu-latest` would
produce a green tick about the platform table's static-fallback row while
claiming the supported one. macOS is the more expensive runner, which is the
cost this row exists to make visible.

*Revisit-if:* the job's first CI runs give a real duration (this row is then
re-measured), or a Linux runner with a user session bus becomes available (the
job gains a matrix and this row doubles).


Three rows from the 2026-05-26 baseline were removed because the jobs and
workflows they named no longer exist: `python-tests` (no such job key in
`.github/workflows/`), `windows-lockfile-export.yml` and
`migration-dry-run.yml` (both files absent). `node-tests` was recorded as
"2 OS" when it is 2 OS × 4 shards, which hid the shard-3 outlier below.

**One regression against the 2026-05-26 figures, flagged per checklist item 2
(> 25 %):** `consistency.yml` 27 s → **75 s**. It is single-job, so this is a
like-for-like comparison. Well under the ceiling, so it earns no follow-up on
cost grounds alone, but it is the single required check
(`branch-protection-policy.md:59`) and therefore sits on every PR's critical
path.

`smoke.yml` is **not** a regression: 18 s → 20–23 s per job. An earlier draft
of this section reported it as 18 s → 82 s by comparing the old per-job figure
against a new run-level one, and flagged a 4.5× regression that does not
exist. Recorded rather than quietly corrected, because it is the same
measure-the-wrong-thing failure the Method note above now guards against.

`smoke-public-install.yml` is no longer a ceiling violation. Its slowest job
is the Windows leg at 159–169 s; the retired 413 s figure was matrix-level,
not per-job, so the two are not directly comparable either — what is
comparable is that no job in it is near 300 s today.

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

## Expected savings (post-optimisation) — historical, as projected 2026-05-26

Kept for the trail, and superseded by the re-measured table above. Two of the
savings it prices — removing the Windows leg and the 3-version Python sweep —
were later overtaken: both sibling workflows were removed outright, so the
scenario rows mentioning Windows or Python describe a pipeline that no longer
exists. The figures below were never re-derived after that.

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

Current jobs above the ceiling (**re-measured 2026-08-18**, 50 successful
`main` runs): **`tests.yml` `node-tests` shard 3/4**, at **357 s on ubuntu and
516 s on macOS** — 1.2× and 1.7× the ceiling. Its sibling shards run
147–164 s, so this is not a whole-suite cost.

The 2026-08-11 figures were 645 s / 852 s, measured **before** the
`build_proof.test.ts` fix below landed. Post-fix the job is **−45 % on ubuntu
and −39 % on macOS** and remains the only ceiling breach in the tree. Stated
as a delta rather than a replacement because the pre-fix pair is what the
fold-back decision below had to be taken against, and a reader who sees only
the new numbers cannot tell whether 357 s is an improvement or a regression.

**The cause is one test file, and it is not subprocess overhead.** A
per-file duration pass over 977 files (local, `--reporter=json`; relative
durations, not a CI baseline) put `tests/scripts/build_proof.test.ts` at
**290 s — 19.5 % of total file-time and 8.7× the next-slowest file**. It
spawns nothing. It called `render()` five times, and `render()` costs
~54 s because it walks the whole claims ledger. Four of those five calls
were redundant: the file's own first test asserts `render()` is
deterministic, so one result can be reused. Reducing it to the two
independent calls that determinism actually requires took the file from
~269 s standalone to **103 s** wall-clock.

Two consequences worth keeping. The workflow comment on the shard matrix
attributes the clump to "subprocess-heavy clusters"; for the largest
contributor that was not true, so re-check the attribution before acting on
it. And the remaining ~103 s is dominated by `render()` itself at 54 s a
call — the next lever on this file is that function, not the test.

### Fold-back decision, 2026-08-18: `golden-tests` and `workspace-tests` stay dedicated

The dedicated-runner layout was opened with a stated exit: if the shard-3 fix
removed enough of the clump, both jobs fold back into the `node-tests` matrix
and two runners per OS disappear. The decision input was a **post-merge**
shard-3 duration on `main`, which could not exist inside the PR that shipped
the fix. It exists now, and the answer is **no fold-back**.

**Threshold read.** The condition was shard 3/4 landing under the 300 s
ceiling. It does not: **357 s ubuntu / 516 s macOS** over 50 successful runs,
1.2× and 1.7×. On ubuntu the *best* of the 50 runs (217 s) is under the
ceiling and the average is not, which is the reading a smaller sample would
have gotten wrong in whichever direction it happened to land.

**Arithmetic read, because a threshold alone is a thin basis for keeping two
jobs.** Folding back returns the excluded file-time to the matrix. Each
dedicated job carries ≈ 25 s of fixed overhead (checkout · setup-node ·
`npm ci` · build — the figure this file derives in the build-artefact
rejection above), so the test-time to redistribute is ≈ 99 s from
`golden-tests` and ≈ 73 s from `workspace-tests`, ≈ 172 s in total. Two
bounds, and the decision does not depend on which one holds:

- **Even split** (the optimistic bound, which vitest does not promise): +43 s
  per shard → shard 3/4 ≈ **400 s** ubuntu, ≈ **559 s** macOS. Worse, and
  still over.
- **Clumped** (the documented behaviour — vitest shards by file **count**, not
  duration, and these files are why the dedicated jobs exist): the whole
  ≈ 172 s lands in one shard → ≈ **529 s** ubuntu, ≈ **688 s** macOS, i.e.
  back to roughly the pre-fix breach the fix just removed.

So the fold-back trades two runners for a worse ceiling breach on the critical
path in both bounds. It is not reopened.

**Next lever, named rather than left implicit:** `render()` at ~54 s a call,
inside `tests/scripts/build_proof.test.ts` — not the job layout. Two calls
remain and both are load-bearing for the determinism assertion, so the saving
has to come from the function, not from further call elimination.

**Revisit if** shard 3/4 averages under 300 s on ubuntu **and** macOS across
50 successful `main` runs — at which point re-run the arithmetic above with
fresh overhead figures rather than reusing these.

`smoke-public-install.yml` was the previous entry here at 413 s and is no
longer one. Both figures need their unit stated or the comparison is the
run-level-vs-per-job mistake again: 413 s was matrix-level, and per job today
the slowest leg is Windows at 159–169 s. The ceiling is per job, so nothing in
this workflow breaches it and no open ADR is required for it.

## Measurement-only changes — kill criterion

A change that re-measures and re-documents cost without altering any job,
matrix, trigger or required check cannot be judged by whether a regression
escaped: nothing about the pipeline's behaviour changed, so there is no
regression class to escape. Binding such a change to an escaped-regression
count would also require a human to attribute a post-merge failure to it,
which is not mechanically decidable.

The criterion for a measurement-only change is therefore:

> **Every job named in the table resolves to a live job in
> `.github/workflows/`.**

Decidable in one pass, and it is the direction that actually failed: the
three rows removed on 2026-08-11 had named a job key and two workflow files
that no longer existed, for an unknown number of quarters.

The converse — every PR-triggered job appears in the table — is **not** the
criterion, because it is not true and stating it would fail every future
change on arrival. 19 workflows carry a `pull_request:` trigger; the table
covers the wall-clock-dominant ones plus the required check. Widening it to
all 19 is a separate decision about what this contract is for, not a
measurement-only edit.

A change that alters a job, a matrix dimension, a trigger surface or the
required-check set is *not* measurement-only and does not get this
criterion.

## Quarterly review checklist

Run the first Monday of every quarter:

1. Re-capture the baseline table **per job**, via `gh run list --branch main
   --workflow <wf> --json databaseId,conclusion` to pick successful runs and
   then `gh api /repos/<owner>/<repo>/actions/runs/<id>/jobs` for the
   durations. Do **not** use run-level `startedAt`/`updatedAt`: for a matrix
   workflow that is the whole fan-out plus queueing, and comparing it against
   the per-job rows above invents regressions (see the Method note).
2. Compare each row against the previous quarter; flag any > 25 %
   regression.
3. For every row over the 5-min ceiling, file a follow-up step in the
   open CI-roadmap (or in this file's history if no roadmap is
   currently active).
4. Do **not** update the "Expected savings" table — it was frozen as
   historical on 2026-08-11 and describes a pipeline that no longer exists.
   When a future optimisation needs its delta proved, add a new dated section
   rather than editing that one.
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
