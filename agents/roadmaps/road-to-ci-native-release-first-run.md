---
complexity: lightweight
parent_roadmap: road-to-ci-native-release
---

# Roadmap: Follow-up to CI-native release — first live run + drills

> Verify `.github/workflows/release.yml` against real GitHub Actions state:
> the post-merge dry-run dispatch, the first real release through the label
> path, and the failure/double-fire/collision drills the parent roadmap
> could not run from an authoring session.

## Context

This roadmap collects items deferred from
[`agents/roadmaps/archive/road-to-ci-native-release.md`](archive/road-to-ci-native-release.md).
All build work (Phases 1–6, plus everything in Phase 7 buildable without a
live authorized run) is done and shipped in PR #780. What remains is purely
verification against live GitHub state — one item unblocks mechanically on
merge, the rest need a maintainer's explicit go-ahead to cut a real release
(Hard Floor per `non-destructive-by-default`; authoring/reviewing a PR does
not constitute that authorization).

> Phase 1's condition has CLEARED: PR #780 merged 2026-07-08 (verified live
> via `gh pr view 780` on 2026-07-10) — Phase 1 is executable now.
> Phase 2 stays gated until a maintainer explicitly authorizes cutting a real
> release (Hard Floor per `non-destructive-by-default`).

## Outcome (2026-08-20)

Closed by an autonomous drain run against **live** GitHub / npm state, not
against intent. Full read, with every figure and line citation:
[`agents/evidence/analysis/ci-native-release-live-state-2026-08-20.md`](../evidence/analysis/ci-native-release-live-state-2026-08-20.md).

**Archived does not mean achieved.** No release has ever shipped through the
label path this roadmap was written to verify — 0 non-skipped runs across the
300 most recent `pull_request` events. The dashboard will render this file at
100 % because no `[ ]` or `[~]` remains and `[-]` reads as complete; that
percentage describes who can do the residual work, not that the goal was
reached.

The line this run could not cross, in one sentence: **every remaining item is
gated on a release having actually happened** — a publish to npm plus a public
GitHub Release, a Hard-Floor act under `non-destructive-by-default` that no
roadmap authorisation substitutes for. Authoring and statically verifying the
machinery is repository work and was done; firing it is not.

| Item | Outcome | Repository work — done here | Release-gated — transferred |
|---|---|---|---|
| P1 · `workflow_dispatch --dry-run` post-merge | **satisfied** | The dispatch already fired for real: run `32083648970`, 2026-08-18, `dry_run="true"`, success, printed `Release preview — 13.0.0 → 14.0.0 (major)`. Plan parity settled by shared code (both paths call `./scripts-run src/scripts/release`; under `--dry-run` no `ci`-conditional branch precedes the `Plan` at `release.ts:2706`). Local `task release -- --dry-run` re-run today: exit 0, clean tree | Nothing. The literal same-HEAD output diff is **unobtainable** — `main` moved 13.0.0 → 14.6.0 — so it was replaced by the stronger code-path proof, not faked |
| P2.1 · first real release through the new path | **transferred** | Confirmed the path is *armed*: all four release labels exist, `release.yml:92` matches them exactly, nothing left to build. Corrected two false expectations in the criterion (below) | The labeled merge itself. Also transferred: AC2 |
| P2.2 · live failure drill (a)(b)(c) | **transferred, narrowed** | **(b) and (c) are discharged by live evidence** — run `32118914154`, `resume=true`, skipped steps 1–7 as already-done, then tagged 14.0.0, created the Release, dispatched downstream, deleted the branch | **(a)** only. And it is a design question first: `release.yml:166-173` documents `--resume` as *not* covering a pre-merge crash |
| P2.3 · double-fire check | **transferred** | Verified the guard exists and is wired: `nothing_to_release_ci` at `release.ts:2467`, called at `:2626` before any bump resolves | The two consecutive labeled merges. A read of the guard is not a run of it |
| P2.4 · collision drill | **transferred, re-specified** | **Found the drill cannot pass as written** — `preflight` is skipped under `--dry-run` (`release.ts:2659`), carries no open-release-PR probe (`:1738-1814`), and the real behaviour is reuse not refusal (`:2132`). Re-specified in the stub | The contended state, which only exists during a release |
| AC1 | **satisfied** | See P1 | — |
| AC2 | **transferred** | — | Rides on P2.1 |
| AC3 | **transferred, partly discharged** | The failure-drill third is discharged for (b)+(c); the offline harness `task release:drill` is green 7/7 | The double-fire and collision thirds, and drill case (a) |

All four transfers live in
[`stubs/road-to-ci-native-release-live-label-path.md`](stubs/road-to-ci-native-release-live-label-path.md),
each carrying its criterion verbatim, the complete list of moved steps, and a
named producer (`matze4u`, verified `admin: true` today) with a detection probe
measured at transfer.

**Two corrections this run made to the criteria themselves**, because
re-verifying a false sentence is worse than not verifying it:

1. *"publish-npm + cloud-release + release-guard dispatches all go green"* is
   already falsified. On 14.0.0, `publish-npm` was red on the tag-push run and
   green on the dispatch; `cloud-release` was the mirror image. Both are the
   documented redundancy in `release.yml:19-22` racing itself on an
   already-published version. The release was correct; "all green" was never the
   right bar.
2. *"the documented approval click"* may not exist here at all —
   `release.yml:26-34` records that on 14.0.0 no approval was requested and the
   run would have merged, tagged and published unattended.

**What remains statically checked but never executed:** the label-triggered
branch of `release.yml` (the `pull_request` half of `:92`) has never once
evaluated true, so every step downstream of it — release-PR creation by CI, the
CI merge, the CI tag — is unexercised in that mode. The dispatch mode exercised
the same `release.ts` steps on 2026-08-18, which is why this is a gap in the
*trigger*, not in the pipeline. A parse is not a run, and the offline drill's
7/7 green covers within-run recovery against a simulated git/gh world — never
cross-run resumption.

## Phase 1: Post-merge dry-run verification (carried from parent Phase 3)

- [x] `workflow_dispatch --dry-run` verification — confirmed empirically
      (not just assumed) that this was blocked pre-merge: `gh workflow run
      release.yml --ref feat/ci-native-release-label-flow -f dry_run=true`
      returned `HTTP 404: workflow release.yml not found on the default
      branch` even with the file pushed on the feature branch and a PR
      open. GitHub only lets you dispatch a workflow whose file already
      exists on the repo's default branch. Re-run this dispatch once PR
      #780 is on `main`; confirm the plan output matches
      `task release -- --dry-run` for the same HEAD.
      **Done — the dispatch fired on 2026-08-18** (run `32083648970`,
      `dry_run="true"`, success, `Release preview — 13.0.0 → 14.0.0 (major)`),
      which also confirms the pre-merge 404 above is cleared. The same-HEAD
      output diff is unobtainable retroactively (`main` moved to 14.6.0), so
      parity is established from shared code instead: both entry points run
      `./scripts-run src/scripts/release` (`taskfiles/release.yml:21`,
      `.github/workflows/release.yml:187`) and under `--dry-run` nothing
      `ci`-conditional precedes the `Plan` at `release.ts:2706` — `preflight`
      is skipped at `:2659` and the trend line keys off `dry_run`, not `ci`.

## Phase 2: First real release + live drills (carried from parent Phase 4 + Phase 7)

- [-] First real release through the new path — **transferred**, see the
      stub. **Repository work done:** the path is armed — all four release
      labels exist and `release.yml:92` matches them exactly, so nothing
      remains to build. **Release-gated:** the labeled merge itself. Two
      expectations below are already falsified and are corrected in the stub
      rather than re-verified — the fan-out was 4/6 green by design, and the
      "approval click" did not fire on 14.0.0. Original text: **Hard Floor**: cutting a
      real release publishes to npm and creates a public GitHub Release;
      per `non-destructive-by-default` this needs the user's explicit,
      this-turn go-ahead. Ready whenever a maintainer labels a merged PR
      `release` (or dispatches the workflow) — nothing further to build.
      Expected: release.yml creates + merges the release PR (one manual
      "Approve workflows to run" click needed unless `RELEASE_PR_TOKEN` is
      configured — see ADR-113), tags, creates the GitHub Release →
      publish-npm + cloud-release + release-guard dispatches all go green →
      npm dist-tag `latest` shows the new version → `release-drift.yml`
      manual dispatch stays green.
- [-] Live failure drill — **transferred and narrowed**. **(b) and (c) are
      discharged by live evidence:** run `32118914154` (`resume=true`) probed
      the merged PR, skipped steps 1–7, then tagged 14.0.0, created the
      Release, dispatched downstream and deleted the branch. **Only (a) moves**,
      and it is a design question first — `release.yml:166-173` documents
      `--resume` as not recovering a pre-merge crash. Original text: kill the workflow after each of (a) release-PR
      created, (b) PR merged but tag missing, (c) tag pushed but
      Release/dispatch missing — re-running the workflow (or
      `workflow_dispatch` with `resume: true` + the version) must converge
      via the idempotent probes. Same authorization gate as the item above.
- [-] Double-fire check — **transferred**. **Repository work done:** the guard
      exists and is wired — `nothing_to_release_ci` at `release.ts:2467`,
      called at `:2626` before any bump resolves. **Release-gated:** two
      consecutive labeled merges; the label path has never fired once, so the
      guard has never run in this sequence. Original text: merge a second labeled PR immediately after the
      first real release — the second run must exit via the
      `nothing_to_release_ci` guard (or ship a clean follow-up release if
      new releasable commits exist), no red run, no duplicate tag.
- [-] Collision drill — **transferred and re-specified: it cannot pass as
      written.** `preflight` is not called under `--dry-run`
      (`release.ts:2659`), contains no open-release-PR probe at all
      (`:1738-1814`), and the actual behaviour is reuse rather than refusal
      (`:2132`, `PR already open … refresh body from branch head`). The
      corrected drill is in the stub. Original text: with a CI-created release PR open, run `task
      release -- --dry-run` locally — the preflight probe must refuse
      cleanly (open release PR detected), and vice versa: a labeled-PR
      merge while a local release PR is open must no-op with a clear
      message instead of stacking a second release PR.

## Acceptance Criteria

- [x] Phase 1's dry-run dispatch succeeds post-merge and matches the local
      `--dry-run` plan. — Satisfied: dispatch verified live (run
      `32083648970`); parity established from the shared code path, the
      same-HEAD diff being unobtainable.
- [-] One real release has shipped end-to-end through the label path with
      no manual git surgery beyond the documented approval click. —
      **Transferred.** Never happened: 0 non-skipped `pull_request` runs across
      300 scanned. 14.0.0 shipped through the *dispatch* path and needed a
      hand-cancel plus a resume dispatch, which is more than an approval
      click; 14.1.0–14.6.0 shipped through the local `task release` path.
- [-] All three live drills (failure, double-fire, collision) converge as
      designed — no red run, no duplicate tag, no orphaned release PR. —
      **Transferred, partly discharged.** Failure-drill (b)+(c) converged live
      (run `32118914154`) and the offline harness `task release:drill` is green
      7/7 against a simulated git/gh world. Drill (a), double-fire and
      collision all need a live release; collision needs re-specifying first.
