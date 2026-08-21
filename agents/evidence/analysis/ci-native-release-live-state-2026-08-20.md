<!-- evidence-type: analysis -->

# CI-native release: live state of the label path and the drills

Measured 2026-08-20 on `drain/road-to-ci-native-release-first-run`, based on
`origin/main` @ `b593d8c00`, while closing
`agents/roadmaps/archive/road-to-ci-native-release-first-run.md` (archived by this run).

Every figure below is a read of live GitHub / npm state or a line citation, not
a description of intent. The roadmap being closed asked for verification against
"real GitHub Actions state"; this is that read, plus two findings the read
produced.

## 1 · Entry points: which one has actually fired

`gh run list --workflow=release.yml --limit 300 --event <e> --json conclusion`,
one scan per event type:

| Event | Conclusion | Runs |
|---|---|---|
| `pull_request` | `skipped` | **300 of 300 scanned** |
| `pull_request` | anything else | **0** |
| `workflow_dispatch` | `success` | 2 |
| `workflow_dispatch` | `cancelled` | 1 |
| `workflow_dispatch` | `failure` | 2 |

The dispatch column is complete — 5 runs, the earliest 2026-07-08, the day
`release.yml` reached `main`. The `pull_request` column is a floor, not a total:
300 is the scan limit, and the non-skipped count within it is zero.

**The label path has never fired — not once in the 300 most recent
opportunities.** Every `pull_request` run evaluated `release.yml`'s `if:` at
line 92 to false, i.e. no merged PR has ever carried `release` /
`release:major` / `release:minor` / `release:patch`.

This is not a missing-label problem. All four labels exist on the repository
today (`gh label list`):

~~~
release · release:major · release:minor · release:patch
~~~

So the trigger is **armed and unfired**. What is missing is a merged PR carrying
one of those labels, which is a human act on a public repository.

## 2 · What the dispatch path did prove

### Run 32083648970 — 2026-08-18T00:13:13Z, `dry_run=true`, success

The log's flag-resolution step shows `dry_run="true"`, the pipeline step shows
`args+=(--dry-run)`, and the output is a plan:

~~~
Release preview — 13.0.0 → 14.0.0 (major)
Previous tag:   13.0.0
New tag:        14.0.0
~~~

This is the post-merge `workflow_dispatch --dry-run` verification the roadmap's
Phase 1 asked for. It succeeded. The pre-merge `HTTP 404: workflow release.yml
not found on the default branch` that Phase 1 recorded is confirmed cleared: the
same dispatch works now that the file is on `main`.

### Run 32083795637 — 2026-08-18T00:15:24Z, cancelled

The hand-cancelled real run described in `.github/workflows/release.yml:26-34`.
It left the repository in a half-finished release state.

### Run 32118914154 — 2026-08-18T08:55:53Z, `resume=true`, success

The convergence. Log, verbatim:

~~~
[1/10] PR for release/14.0.0 already merged — staying on main
[2/10] PR already merged — skip file bumps
[3/10] PR already merged — skip commit
[4/10] PR already merged — skip push
[5/10] PR #1412 already merged — skip
[6/10] PR already merged — skip checks wait
[7/10] PR #1412 already merged — skip
[8/10] Tag merge commit (annotated, from merged CHANGELOG) and push 14.0.0
[9/10] Create GitHub Release (tag push under GITHUB_TOKEN triggers nothing — dispatching next)
[9/10] Dispatch release-guard.yml + publish-npm.yml + cloud-release.yml for the tag
[10/10] Delete merged branch release/14.0.0 (remote)
~~~

That is the roadmap's failure-drill cases **(b) PR merged but tag missing** and
**(c) tag pushed but Release/dispatch missing**, converging through the
idempotent probes on a `resume: true` dispatch — observed, not simulated.

Case **(a)** (killed after the release PR was created, before merge) was **not**
drilled, and `release.yml:166-173` documents it as out of reach for this
mechanism: `--resume` from a fresh `main` checkout "recovers a crash AFTER the
release PR merged … but not a crash BEFORE merge".

### The 14.0.0 downstream fan-out was not all green

The roadmap's expectation was "publish-npm + cloud-release + release-guard
dispatches all go green". Measured:

| Workflow | Tag-push run (08:59:40) | Explicit dispatch (08:59:41-45) |
|---|---|---|
| `release-guard.yml` | success | success |
| `publish-npm.yml` | **failure** | success |
| `cloud-release.yml` | success | **failure** |

Two of six runs were red. Both reds are the redundancy in
`release.yml:19-22` behaving as documented — the tag push fires these workflows
*and* step 9 dispatches them, so one of each pair loses a race on an
already-published version. The release itself completed and npm is correct
(`npm view @event4u/agent-config dist-tags` → `{"latest":"14.6.0"}`). But
"all go green" is false as written, and a future reader diffing against that
sentence would think something regressed.

## 3 · Finding: the collision drill cannot pass as specified

The roadmap's collision drill reads:

> with a CI-created release PR open, run `task release -- --dry-run` locally —
> the preflight probe must refuse cleanly (open release PR detected)

Three independent reasons that cannot happen:

1. **`preflight()` is not called under `--dry-run`.** `release.ts:2659-2660`
   guards it: `if (!args.dry_run) { preflight(target, …) }`. A dry-run reaches
   `print_preview` and returns 0 at `:2712` without ever entering preflight.
2. **`preflight()` contains no open-release-PR probe.** Its complete check set
   (`release.ts:1738-1814`) is: `git`/`gh` on PATH · token auth · current branch
   is `main` (or `release/X.Y.Z` under resume) · clean working tree · fetch tags
   · local `main` in sync with `origin/main` · target tag does not already
   exist. Nothing reads open pull requests.
3. **The real behaviour is reuse, not refusal.** The only open-release-PR
   handling is inside `execute()` at `release.ts:2132` —
   `PR already open: <url> — refresh body from branch head`. An open release PR
   for the same target is adopted and its body refreshed.

The "vice versa" half of the drill ("a labeled-PR merge while a local release PR
is open must no-op … instead of stacking a second release PR") is therefore
*approximately* satisfied by that reuse path, and only by coincidence of
versioning: while a release PR for X.Y.Z is open, `main`'s `package.json` is
still the previous version, so both entry points compute the same target X.Y.Z,
hit the same `release/X.Y.Z` branch, and take the reuse path. Two release PRs can
only stack if the two computations disagree, which needs an explicit `--version`
or a `release:*` bump override on one side.

**Consequence:** the drill needs re-specifying before it is run, not just
running. The re-specified version is carried in
`agents/roadmaps/stubs/road-to-ci-native-release-live-label-path.md`; this file
records why the original was unpassable.

## 4 · Plan parity: settled by shared code, not by an output diff

Phase 1's second half asked to "confirm the plan output matches
`task release -- --dry-run` for the same HEAD". That same-HEAD comparison is
**no longer obtainable**: the CI dry-run ran against `main` at 13.0.0 on
2026-08-18, and `main` is at 14.6.0 today, so a local dry-run now plans
14.6.0 → 14.7.0. Re-running one side cannot reconstruct the other's HEAD.

The criterion's substance is settled statically, and more strongly than an
output diff would settle it:

- Both entry points invoke the **same script**:
  `taskfiles/release.yml:21` → `./scripts-run src/scripts/release {{.CLI_ARGS}}`;
  `.github/workflows/release.yml:187` → `./scripts-run src/scripts/release "${args[@]}"`.
- Under `--dry-run`, **`--ci` cannot alter the printed plan.** Every input to
  the `Plan` constructed at `release.ts:2706` is computed before any
  `ci`-conditional branch. The only `ci`-conditional code above the preview is
  `nothing_to_release_ci` (`:2467`, called `:2626`), which decides whether to
  exit cleanly when there is nothing to release rather than changing a plan, and
  `preflight` (`:2660`), which dry-run skips. `test_trend_line` (`:2667`) keys
  off `args.dry_run`, not `args.ci`.

Observed on both sides, at their respective HEADs, with the identical banner
and field layout:

~~~
CI    2026-08-18, run 32083648970:  Release preview — 13.0.0 → 14.0.0 (major)
local 2026-08-20, task release -- --dry-run:  Release preview — 14.6.0 → 14.7.0 (minor)
~~~

The local run exits 0 and leaves `git status --porcelain` empty — dry-run does
not reach `task release-prepare`, so it mutates nothing.

## 5 · What the offline drill already covers

`task release:drill` (`src/scripts/release_drill.ts`, also in CI via
`tests/scripts/release_drill.test.ts`) is green today, 7/7:

~~~
happy-resume · push-rejected-then-recover · behind-then-merge · merge-race-recovers
behind-forever-dies · merge-fails-hard-surfaces · checks-fail-dies
~~~

These are **within-run** failure modes against a simulated git/gh world. The
roadmap's live drills are **cross-run** resumption (kill the workflow, dispatch
again). The two do not substitute for each other, and the offline set is why
the live set was ever safe to attempt.

## 6 · Standing summary

| Question | Answer today |
|---|---|
| Has `workflow_dispatch --dry-run` been verified post-merge? | Yes — run 32083648970 |
| Do the CI and local plans agree? | Yes, by shared code path; the same-HEAD diff is unobtainable |
| Has a release shipped through the **dispatch** entry point? | Yes — 14.0.0, run 32118914154 |
| Has a release shipped through the **label** entry point? | **No** — 0 non-skipped across 300 scanned `pull_request` runs |
| Failure drill (b) + (c)? | Converged live, run 32118914154 |
| Failure drill (a), pre-merge crash? | Not drilled; documented as unsupported |
| Double-fire on a second labeled PR? | Never exercised — the label path has never fired once |
| Collision drill? | Unpassable as written; re-specified in the stub |
| npm `latest` | 14.6.0 |
| `release-drift.yml` manual dispatch | success, 2026-08-20T10:27:11Z |
