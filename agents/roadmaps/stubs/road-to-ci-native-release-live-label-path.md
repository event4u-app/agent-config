---
complexity: lightweight
---

# Stub: road to the live label-path release and its drills

> **Stub — not active work.** Holds the four transfers made out of
> [`road-to-ci-native-release-first-run.md`](../archive/road-to-ci-native-release-first-run.md)
> by the autonomous drain run of 2026-08-20. Every one of them is gated on the
> same missing thing: **a release actually happening through the label entry
> point**, which is a publish to npm plus a public GitHub Release — a Hard-Floor
> act under `non-destructive-by-default` that no roadmap authorisation
> substitutes for. Measured live state at transfer:
> [`agents/evidence/analysis/ci-native-release-live-state-2026-08-20.md`](../../evidence/analysis/ci-native-release-live-state-2026-08-20.md).

## Why these four and not the whole roadmap

Two of the parent's items were **not** transferred, because live evidence
already discharged them and re-running them would prove nothing new:

- The post-merge `workflow_dispatch --dry-run` verification fired for real on
  2026-08-18 (run `32083648970`, `dry_run="true"`, success, printed
  `Release preview — 13.0.0 → 14.0.0 (major)`).
- Failure-drill cases **(b)** and **(c)** converged live on a `resume=true`
  dispatch (run `32118914154`, steps `[1/10]`–`[10/10]`).

What is left is genuinely unreachable from a repository session, and it divides
into two different kinds of unreachable — worth keeping distinct, because they
promote on different evidence:

1. **Never-fired** (transfers 1 and 3): the label path has produced 0 non-skipped
   runs across 300 scanned `pull_request` events, so anything downstream of "a
   labeled PR merged" has no observations at all.
2. **Documented-unsupported** (transfer 2): the mechanism the drill would
   exercise is recorded in `release.yml:166-173` as not covering that case, so
   the drill is a *design question* before it is a verification.

## Promotion gates

The shared promotion criteria in [`README.md`](README.md) § Promotion criteria —
a recruited first customer, a funded security audit — **do not govern a
drain-run transfer** and are not gates here. These four introduce no new product
capability; they verify a path that is already built, armed and unfired.

The gate for all four is: **the named producer cuts a release through the label
path, with a this-turn approval naming the exact object** (version, npm tag,
Release visibility). Transfers 2 and 4 additionally need a deliberately
half-finished or contended state, which only exists during such a release.

## Live state, measured 2026-08-20

Read, not described:

| Reading | Value today |
|---|---|
| `release.yml` runs on `pull_request`, non-skipped | **0** of 300 scanned |
| `release.yml` runs on `workflow_dispatch` | 5 total — 2 success, 1 cancelled, 2 failure |
| Release labels present on the repo | **4** — `release`, `release:major`, `release:minor`, `release:patch` |
| Latest release shipped | 14.6.0, via the **local** `task release` path |
| npm `dist-tags.latest` | `14.6.0` |
| `release-drift.yml` manual dispatch | success, 2026-08-20T10:27:11Z |
| Offline drill `task release:drill` | green, 7/7 scenarios |

The trigger is **armed and unfired**: the labels exist and the `if:` at
`release.yml:92` matches them exactly, so nothing needs building — only a merged
PR carrying one.

**Named re-entry producer, all four transfers:** the repository owner
**`matze4u` (m.berg@galawork.de)**, the account this run authenticated as,
verified to hold admin today — `gh api repos/event4u-app/agent-config --jq
.permissions.admin` returns `true`. Not "a maintainer": that account is the one
principal that can label, merge and publish here.

**Shared detection probe** — re-entry has happened for transfers 1 and 3 when
this count moves off zero:

~~~bash
gh run list --workflow=release.yml --limit 300 --event pull_request \
  --json conclusion --jq '[.[] | select(.conclusion != "skipped")] | length'
# 2026-08-20: 0   → re-entry: >= 1
~~~

## Transfer 1 — first real release through the label path

**Outcome state:** transferred.

**Original criterion, verbatim from the parent roadmap:**

> First real release through the new path — **Hard Floor**: cutting a real
> release publishes to npm and creates a public GitHub Release; per
> `non-destructive-by-default` this needs the user's explicit, this-turn
> go-ahead. Ready whenever a maintainer labels a merged PR `release` (or
> dispatches the workflow) — nothing further to build. Expected: release.yml
> creates + merges the release PR (one manual "Approve workflows to run" click
> needed unless `RELEASE_PR_TOKEN` is configured — see ADR-113), tags, creates
> the GitHub Release → publish-npm + cloud-release + release-guard dispatches
> all go green → npm dist-tag `latest` shows the new version →
> `release-drift.yml` manual dispatch stays green.

**Dependent steps moved — the complete list:**

1. The parent's Phase 2 item 1 in full, minus the `(or dispatches the workflow)`
   clause, which is **discharged**: 14.0.0 shipped end-to-end through the
   dispatch entry point on 2026-08-18.
2. Acceptance criterion 2 ("One real release has shipped end-to-end through the
   label path with no manual git surgery beyond the documented approval click").

**Two corrections the transfer carries**, so the criterion is not re-verified
against sentences already known to be false:

- **"all go green" is already falsified for the fan-out.** On 14.0.0,
  `publish-npm.yml` was red on the tag-push run and green on the dispatch;
  `cloud-release.yml` was the mirror image. Both reds are the documented
  redundancy in `release.yml:19-22` (push fires these *and* step 9 dispatches
  them, so one of each pair loses a race on an already-published version). The
  re-entry bar is **the release is correct and no *unexplained* run is red**,
  not six green runs.
- **"the documented approval click" may not exist on this repo.**
  `release.yml:26-34` records that on 14.0.0 the checks started immediately, no
  approval was requested, and the run would have merged, tagged and published
  unattended. Treat a labeled merge as unattended end-to-end unless the approval
  gate has been verified on this repository first.

**Detection probe:** the shared probe above, plus `npm view @event4u/agent-config
dist-tags` showing a version whose `release.yml` run has `event=pull_request`.

## Transfer 2 — failure drill, case (a) only

**Outcome state:** transferred, and **narrowed** — (b) and (c) are discharged.

**Original criterion, verbatim from the parent roadmap:**

> Live failure drill: kill the workflow after each of (a) release-PR created,
> (b) PR merged but tag missing, (c) tag pushed but Release/dispatch missing —
> re-running the workflow (or `workflow_dispatch` with `resume: true` + the
> version) must converge via the idempotent probes. Same authorization gate as
> the item above.

**What is discharged, with evidence:** cases **(b)** and **(c)**. Run
`32118914154` (2026-08-18T08:55:53Z, `resume=true`, success) probed the merged
PR, skipped steps 1–7, then tagged 14.0.0, created the Release, dispatched the
three downstream workflows and deleted the branch. That is convergence through
the idempotent probes, observed.

**Dependent step moved:** case **(a)** — kill after the release PR is created
but before it merges.

**This one is a design question first.** `release.yml:166-173` states that
`--resume` from a fresh `main` checkout "recovers a crash AFTER the release PR
merged … but not a crash BEFORE merge (an open, unmerged release/X.Y.Z PR) —
that case's stale branch/PR needs a manual close or a local `task release --
--resume` after checking out that branch". So drilling (a) as written would
confirm a known limitation rather than test a convergence claim. Re-entry should
either accept that outcome explicitly, or change the mechanism first — and if the
latter, this stops being a drill and becomes buildable work that belongs in an
active roadmap.

**Detection probe** (the state case (a) needs, which has never existed):

~~~bash
gh pr list --state open --json number,headRefName \
  --jq '[.[] | select(.headRefName | startswith("release/"))]'
# 2026-08-20: []  → verified by running it; no open release PR exists,
#                   so case (a) has no state to resume from
~~~

## Transfer 3 — double-fire check

**Outcome state:** transferred.

**Original criterion, verbatim from the parent roadmap:**

> Double-fire check: merge a second labeled PR immediately after the first real
> release — the second run must exit via the `nothing_to_release_ci` guard (or
> ship a clean follow-up release if new releasable commits exist), no red run,
> no duplicate tag.

**Dependent steps moved — the complete list:**

1. The parent's Phase 2 item 3 in full.
2. The double-fire third of acceptance criterion 3.

**Statically verified, and this is the whole of what a session can do:** the
guard exists and is wired. `nothing_to_release_ci` is defined at
`src/scripts/release.ts:2467` and called at `:2626`, before any bump is
resolved, printing `nothing to release — no commits since <tag>; exiting
cleanly.` and returning 0. Its `ci` argument is what makes a no-commit state an
exit-0 in CI instead of a die.

**What that does not establish:** the guard has never run in a live
second-labeled-PR sequence, because no first one has ever run. A read of the
function is not a run of it. Two labeled merges in a row are needed, i.e. the
Hard Floor twice.

**Detection probe:** the shared probe above returning `>= 2`, with the second
run's log carrying either the `nothing to release` line or a clean follow-up
version, and `git tag -l` showing no duplicate.

## Transfer 4 — collision drill, re-specified

**Outcome state:** transferred, and **re-specified** — the original cannot pass.

**Original criterion, verbatim from the parent roadmap:**

> Collision drill: with a CI-created release PR open, run `task release --
> --dry-run` locally — the preflight probe must refuse cleanly (open release PR
> detected), and vice versa: a labeled-PR merge while a local release PR is open
> must no-op with a clear message instead of stacking a second release PR.

**Why the first half cannot pass as written** — three independent reasons, each
a line citation, all measured 2026-08-20:

1. `preflight()` is **not called under `--dry-run`**:
   `src/scripts/release.ts:2659-2660` guards it with `if (!args.dry_run)`. A
   dry-run prints the preview and returns 0 at `:2712`.
2. `preflight()` (`src/scripts/release.ts:1738-1814`) contains **no
   open-release-PR probe at all**. Its complete check set is `git`/`gh` on PATH ·
   token auth · branch is `main` (or `release/X.Y.Z` under resume) · clean tree ·
   fetch tags · local `main` in sync with `origin/main` · target tag absent.
3. The real behaviour is **reuse, not refusal**: the only open-release-PR
   handling is in `execute()` at `src/scripts/release.ts:2132` —
   `PR already open: <url> — refresh body from branch head`.

**Why the second half is nearly satisfied by accident.** While a release PR for
X.Y.Z is open, `main`'s `package.json` still reads the previous version, so both
entry points compute the same target, resolve the same `release/X.Y.Z` branch and
take the reuse path at `:2132`. Two release PRs can only stack if the two
computations disagree, which requires an explicit `--version` or a `release:*`
override on one side. So the stated failure mode is mostly unreachable, and the
*reachable* one is narrower than the criterion describes.

**Re-specified drill for re-entry** — what should actually be run:

1. With a CI-created `release/X.Y.Z` PR open, run `task release -- --dry-run`
   locally. **Expected: exit 0 with a preview**, not a refusal — and that is
   correct behaviour, not a bug. Confirm it does not mutate the tree.
2. With that PR still open, run the local release **without** `--dry-run` up to
   the point preflight completes. Expected: it adopts the existing PR at step 5
   (`PR already open … refresh body from branch head`), rather than opening a
   second one.
3. Force the genuine stacking case: with a `release/X.Y.Z` PR open, run the local
   path with an explicit `--version X.Y.(Z+1)`. This is the only route to two
   concurrent release branches, and there is **no guard against it today** — the
   drill's job is to decide whether one is wanted.
4. Only if step 3 shows a real hazard does a `preflight` change follow, and that
   is buildable work for an active roadmap, not a drill.

**Dependent steps moved:** the parent's Phase 2 item 4 and the collision third
of acceptance criterion 3.

**Detection probe:** an open `release/*` PR co-existing with a local release
attempt, recorded with both outputs. Baseline 2026-08-20: no open `release/*` PR
exists, so the state the drill needs has never been constructed.

## What promotion looks like

Promotion is **not** moving this file up a directory. Transfer 1 is one release
performed by a human; transfers 2–4 are observations to record while that release
is in flight. When the producer cuts a labeled release, close each transfer by
recording its probe's after-value against the baseline above and striking it from
this file. The stub is deleted when the last one is struck.

If transfer 2 step 3 or transfer 4 step 3 turns up a mechanism change worth
making, that is new buildable work and opens its own roadmap — it does not
reopen this stub.
