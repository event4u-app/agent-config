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

> Blocked until PR #780 merges (Phase 1) and, separately, until a
> maintainer explicitly authorizes cutting a real release (Phase 2).
> Execution starts when the relevant condition clears.

## Phase 1: Post-merge dry-run verification (carried from parent Phase 3)

- [ ] `workflow_dispatch --dry-run` verification — confirmed empirically
      (not just assumed) that this was blocked pre-merge: `gh workflow run
      release.yml --ref feat/ci-native-release-label-flow -f dry_run=true`
      returned `HTTP 404: workflow release.yml not found on the default
      branch` even with the file pushed on the feature branch and a PR
      open. GitHub only lets you dispatch a workflow whose file already
      exists on the repo's default branch. Re-run this dispatch once PR
      #780 is on `main`; confirm the plan output matches
      `task release -- --dry-run` for the same HEAD.

## Phase 2: First real release + live drills (carried from parent Phase 4 + Phase 7)

- [ ] First real release through the new path — **Hard Floor**: cutting a
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
- [ ] Live failure drill: kill the workflow after each of (a) release-PR
      created, (b) PR merged but tag missing, (c) tag pushed but
      Release/dispatch missing — re-running the workflow (or
      `workflow_dispatch` with `resume: true` + the version) must converge
      via the idempotent probes. Same authorization gate as the item above.
- [ ] Double-fire check: merge a second labeled PR immediately after the
      first real release — the second run must exit via the
      `nothing_to_release_ci` guard (or ship a clean follow-up release if
      new releasable commits exist), no red run, no duplicate tag.
- [ ] Collision drill: with a CI-created release PR open, run `task
      release -- --dry-run` locally — the preflight probe must refuse
      cleanly (open release PR detected), and vice versa: a labeled-PR
      merge while a local release PR is open must no-op with a clear
      message instead of stacking a second release PR.

## Acceptance Criteria

- [ ] Phase 1's dry-run dispatch succeeds post-merge and matches the local
      `--dry-run` plan.
- [ ] One real release has shipped end-to-end through the label path with
      no manual git surgery beyond the documented approval click.
- [ ] All three live drills (failure, double-fire, collision) converge as
      designed — no red run, no duplicate tag, no orphaned release PR.
