# Release runbook — cut a correct release from written steps alone

> **Bus-factor doc (road-to-maintainer-bus-factor Phase 3).** The goal: a second
> maintainer — or the current one after a long gap — can cut a correct release by
> following THIS document, with no tribal knowledge. Every step maps to a real
> gate or command in the repo; nothing here is aspirational. Companion:
> [`succession.md`](succession.md) (secrets, operator-gated steps, "healthy main").
>
> **Source of truth for the mechanism:** [`src/scripts/release.ts`](../src/scripts/release.ts)
> (the shared pipeline) + [`.github/workflows/release.yml`](../.github/workflows/release.yml)
> (the CI entry) + [`ADR-113`](decisions/ADR-113-ci-native-release-label-trigger.md).
> If this runbook and those disagree, THEY win and this doc is stale — fix it.

## 0. Mental model

There is **one** release pipeline (`src/scripts/release.ts`) reached by **two**
entry points that produce the identical result:

| Entry point | How | When to use |
|---|---|---|
| **Local** | `task release` (interactive) | You want to watch it, or CI dispatch is unavailable. |
| **CI-native** | merge a PR labeled `release` / `release:major` / `release:minor` / `release:patch` | The normal path — the merge triggers [`release.yml`](../.github/workflows/release.yml), which runs `release.ts --ci`. |

`release` auto-detects the semver bump from Conventional Commits since the last
tag; `release:major|minor|patch` forces it. A manual/recovery entry exists via
the **workflow_dispatch** on `release.yml` (inputs: `bump`, `version`,
`dry_run`, `resume`).

## 1. Pre-flight (before you start)

- [ ] `main` is green on the latest commit (all required checks — see
      [`branch-protection-policy.md`](contracts/branch-protection-policy.md)).
- [ ] Working tree clean, on `main`, `origin/main` in sync
      (`release.ts` step 1 enforces this and aborts otherwise).
- [ ] `gh` authenticated (`gh auth status`).
- [ ] The target tag does **not** already exist (step 1 checks; use `--resume`
      to recover a partial run — see § 5).
- [ ] You have read [`succession.md`](succession.md) if any secret-gated
      downstream (npm publish, cloud deploy) must succeed this release.
- [ ] **Walk the upstream watchlist** —
      [`agents/settings/contexts/upstream-watchlist.md`](../agents/settings/contexts/upstream-watchlist.md).
      For each entry (`host-issue` · `vendored-corpus` · `consumed-tool`), check
      whether the upstream fact moved; record the change there, then open or
      close the dependent item in its own change. A closed host issue means a
      workaround this tree still carries; a moved vendored pin means the port has
      drifted — one such drift ran two months with every gate green, which is why
      this line exists. Two consecutive walks that change nothing fire the
      watchlist's own falsifier: fold it into the dependent roadmaps and delete it.
- [ ] **On a `release:major` only** — read
      [`MIGRATION.md` § Scheduled deprecations](MIGRATION.md#scheduled-deprecations-forward-looking--read-before-cutting-a-major)
      and act on every row whose "deprecation notice due" or "removal due"
      lands on this major: ship the notice, or perform the removal, or record
      why the reversal condition fired. A row left unread is how a removal
      commitment becomes folklore — **and one already was**: the `code_graph`
      removal reached one major past its 11.0 commitment with this checkbox in
      place the whole time. So half of this line no longer depends on being
      read: `src/scripts/lint_scheduled_deprecations` compares every resolved
      **Removal due** version — against the shipped major on an ordinary
      branch, against the TARGET major at a cut — and `release.ts` **refuses**
      a major cut whose table carries a row due at or before it, or one it
      cannot resolve.
      **The "ship the notice" half stays yours.** The Deprecation-notice-due
      column is parsed only as the anchor for a relative removal cell and is
      compared against nothing, because a shipped notice is written as a date
      and has no comparand. So read the notice column here; the removal column
      is checked for you, and the judgement behind it — remove, or revise the
      commitment — always was and remains yours.
- [ ] The release satisfies [`release-sizing.md`](contracts/release-sizing.md) —
      one primary product goal, and a `Rollback:` line for every new /
      substantially reworked subsystem (gate: `src/scripts/lint_changelog_rollback.ts`).
- [ ] **One capability track this minor.** Not one commit and not one subsystem —
      one *track* a reader can name in a sentence. A minor that carries two
      unrelated capability tracks is two releases sharing a tag, and every
      reviewer of 9.9.0 and 9.10.0 said so independently. This is a planning
      judgement and stays one: a commit-counting gate would block work for a
      preference, which [`release-sizing.md`](contracts/release-sizing.md) already
      records as refused.
- [ ] **Security and correctness fixes cut separately** from a capability minor.
      A consumer deciding whether to take an urgent fix should not have to
      evaluate a feature track at the same time. The release types are already
      named in [`releases.md`](releases.md); this line says they do not ride
      together.
- [ ] **Dry-run the actual artifact before the version PR** — pack → install →
      hooks → upgrade → uninstall, against a real global prefix
      (`tests/test_release_install_e2e.sh`). This is a *pre*-PR step by
      necessity: [`release-pr-gating.md`](contracts/release-pr-gating.md) skips
      the heavy install matrices on release branches, so the release PR itself
      is the one PR that never installs the thing it is releasing. 9.8.0 shipped
      without `src/install/` across two minors and it was caught after publish.
- [ ] **Exercise the release-gated workflows against `main` and require green
      before cutting.** Three workflows only run on a release PR, a cron, or a
      manual dispatch, so on the release PR itself they are being run for the
      first time in days — 9.9.0 needed four CI round-trips because four of
      them failed at once, on the one PR that cannot absorb the delay. Since
      `road-to-gates-that-can-fail` Phase 4 they also trigger on any PR that
      touches an input they measure, but a `main` dispatch is still the last
      cheap moment to find a break. All three accept `workflow_dispatch`; run
      them from a clean `main`:

      ```bash
      # 1. Fire all three against main (order does not matter; they are independent).
      gh workflow run evaluator-umbrella.yml --ref main
      gh workflow run consumer-matrix.yml   --ref main
      gh workflow run release-validation.yml --ref main

      # 2. Watch each to completion. `--exit-status` makes a red run exit non-zero,
      #    so this is a gate and not a status page. Takes ~20-30 min in total;
      #    consumer-matrix is the long pole.
      for wf in evaluator-umbrella.yml consumer-matrix.yml release-validation.yml; do
        sleep 5   # let the dispatch register before querying for its run id
        id="$(gh run list --workflow "$wf" --branch main --event workflow_dispatch \
                --limit 1 --json databaseId --jq '.[0].databaseId')"
        echo "== $wf → run $id"
        gh run watch "$id" --exit-status || { echo "RED: $wf — do not cut"; break; }
      done
      ```

      Any red here is a **stop**: fix it on `main` first, then re-dispatch. On a
      `workflow_dispatch` the four release-shape jobs in `release-validation.yml`
      run without a `release/*` head branch (their `if:` admits dispatch), which
      is intended — a shape failure there is a real signal about `main`.

## 2. The pipeline — what `release.ts` does (9 steps)

Both entry points run these in order. Each step prints what it will do before
doing it, so a crash localises to a step.

1. **Preflight** — on `main`, clean tree, `origin` in sync, `gh` present, target
   tag absent.
2. **Plan** — compute the new version, parse Conventional Commits since the last
   tag, render the CHANGELOG section.
3. **Confirm** — show the preview and ask once. `--yes` skips; `--ci` always
   requires `--yes` (no terminal in CI).
4. **Branch + bump** — create `release/X.Y.Z`; update `package.json`,
   `.claude-plugin/marketplace.json`, `CHANGELOG.md`; then run
   `task release-prepare` so pack manifests + tool projections pick up the new
   version (skip this and the PR's own consistency check fails — PR #226
   post-mortem).
5. **Commit + push** — commit `release: X.Y.Z`, push the branch, open the PR.
6. **Wait for CI** — `gh pr checks --watch` (skippable with `--no-wait`).
7. **Merge** — `gh pr merge --merge --delete-branch`.
8. **Tag main** — fast-forward `main`, tag the merge commit, push the tag.
9. **GitHub Release** — `gh release create X.Y.Z --notes <changelog>`. Under
   `--ci`, also dispatches `release-guard.yml` + `publish-npm.yml` +
   `cloud-release.yml` (a bot-pushed tag does not trigger them on its own —
   GitHub's `GITHUB_TOKEN` recursion guard).

## 3. The two ways to run it

### A. CI-native (normal)

1. Open your change PR as usual; get it green + merged into `main`.
2. To release, add a **`release`** label (or `release:minor` etc.) to a PR and
   merge it. `release.yml` fires on `pull_request: closed` (merged) and runs
   `release.ts --ci`.
3. **Manual checkpoint (only without `RELEASE_PR_TOKEN`):** GitHub's
   bot-created-PR safeguard queues the release PR's required checks in an
   approval-required state. Go to the release PR → **"Approve workflows to
   run"** once. The job's `gh pr checks --watch` then proceeds. This is a
   deliberate production-release checkpoint, not a bug (see
   [`branch-protection-policy.md`](contracts/branch-protection-policy.md)).
   Configuring `RELEASE_PR_TOKEN` removes it (see [`succession.md`](succession.md)).
4. Watch the `release.yml` run to green. It merges the release PR, tags, cuts
   the GitHub Release, and dispatches the downstream workflows.

### B. Local (`task release`)

1. `task release` — interactive; it runs the same 9 steps and asks once at
   step 3. Use `--as minor` / `--version X.Y.Z` to override the bump; `--dry-run`
   to preview with zero git/gh mutations.
2. Watch it merge + tag. The tag push triggers `publish-npm.yml` directly (local
   runs use your user token, so no recursion guard applies).

## 4. Post-release verification

- [ ] `git log --first-parent origin/main -1` shows the `release: X.Y.Z` merge.
- [ ] `gh release view X.Y.Z` exists with the CHANGELOG notes.
- [ ] `publish-npm.yml` succeeded (npm has the new version) — see
      [`succession.md`](succession.md) for the token dependency.
- [ ] Downstream deploys (`cloud-release.yml`, site) green if this release
      touched them.
- [ ] `main` is green post-merge (no drift gate red: `release-drift.yml`,
      `release-guard.yml`).

## 5. Recovery — a partial or failed release

`release.ts` is **idempotent under `--resume`**: it probes existing state
(branch, commit, PR, tag, GitHub Release) and skips completed steps.

**Step 1 no longer needs the flag just to reuse a branch (since 2026-09-03).**
An existing `release/X.Y.Z` is checked out whether or not `--resume` was
passed, and if it is behind `origin/main` the default branch is merged in
right there. Both arms used to be gated on `resume`, so a plain re-run over an
existing branch fell through to `git checkout -b` and died with exit 128. A
branch cut from an older `main` also used to survive until the pre-push
preflight reported `branch is BEHIND origin/main`, six steps after the cheapest
moment to fix it. A NEW branch is now cut from current `origin/main` rather
than from whatever the local ref happened to be, which is the same defect from
its third side. Pinned by the drill scenarios
`plain-run-reuses-an-existing-branch` and `stale-branch-merges-main-at-step-1`.

**Corrected 2026-09-07 — the paragraph above used to end by claiming this also
closed the curated-head guard's remedy. It did not, and 14.19.0 measured it.**
`guard_release_curation` stops between step 2 and step 3, leaving HEAD on the
local `release/X.Y.Z` with the generated section uncommitted in the tree, and
says to re-run `task release`. Every spelling of that re-run was refused by the
**preflight**, which runs *before* step 1 and therefore never reached the code
the 2026-09-03 fix had repaired:

| re-run | refusal, before step 1 |
|---|---|
| `task release` | `release must run from 'main', currently on 'release/X.Y.Z'` |
| `task release -- --resume` | `working tree is not clean; commit or stash first` |

The only way through was to hand-craft the `release: X.Y.Z` commit the pipeline
makes for itself one step later. The start position is now one pure function,
`preflightPosition` in `src/scripts/release.ts`: `release/{target}` is a legal
start with or without `--resume`, and a dirty tree is accepted **there only**,
with the files printed — on `main` that same tree still refuses, because there
it is an operator's unrelated work about to be swept into a release commit.
Pinned by `tests/scripts/release.test.ts` § `preflightPosition`.

`--resume` is still the right flag when a run left a COMMIT, a PR, a tag or a
Release behind: those skips are what it is for. It is no longer the difference
between a re-run working and crashing.

- Re-run `release.yml` via **workflow_dispatch** with `resume: true`, or locally
  `task release -- --resume`.
- Firing the `release` label path twice is a clean no-op (the `--ci`
  nothing-to-release short-circuit).
- If a downstream dispatch (npm/cloud) failed but the tag + Release exist, re-run
  that specific workflow from the Actions tab — do **not** re-cut the release.

## 6. What can go wrong (known checkpoints)

- **`the X.Y.Z release highlights are still the generator's draft`** → the
  curated-head / governance-mix obligation. Edit the `## [X.Y.Z]` section in
  `CHANGELOG.md` **on the `release/X.Y.Z` branch you are already standing on**,
  then re-run `task release`. Nothing has been committed or pushed; the dirty
  tree is expected and is swept into the release commit by step 3.
- **Release PR checks stuck "expected"** → the approve-workflows checkpoint in
  § 3.A step 3. Not a failure; click approve.
- **Consistency check red on the release PR** → step 4's `task release-prepare`
  did not run or pack manifests drifted; re-run it on the release branch.
- **Tag exists but no npm version** → `publish-npm.yml` did not fire or failed;
  re-run it (§ 5). Never delete + re-push the tag to "retry".
- **`main`/`origin` diverged mid-release** → stop; resolve the divergence with
  the `git-workflow` skill's Divergent-State Recovery procedure first, then
  `--resume`.

## 7. Verify this runbook is not stale

```bash
# every command / gate this runbook names still exists:
test -f src/scripts/release.ts && test -f .github/workflows/release.yml
grep -q "release-prepare" Taskfile.yml
./scripts-run src/scripts/check_release_pr_shape --help >/dev/null 2>&1 || true
# the pre-flight dry-run + the three release-gated workflows § 1 dispatches:
test -f tests/test_release_install_e2e.sh
for wf in evaluator-umbrella consumer-matrix release-validation; do
  test -f ".github/workflows/$wf.yml" || { echo "stale: $wf.yml is gone"; exit 1; }
  grep -q "workflow_dispatch" ".github/workflows/$wf.yml" \
    || { echo "stale: $wf.yml no longer accepts workflow_dispatch"; exit 1; }
done
```

A written-steps-only **dry run** (cut a no-op release following ONLY this doc,
no tribal knowledge) is the real freshness test — see the roadmap's Phase 3
dry-run step (maintainer-run; every gap found is a fix to this file).
