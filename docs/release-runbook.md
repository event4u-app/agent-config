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
- [ ] **On a `release:major` only** — read
      [`MIGRATION.md` § Scheduled deprecations](MIGRATION.md#scheduled-deprecations-forward-looking--read-before-cutting-a-major)
      and act on every row whose "deprecation notice due" or "removal due"
      lands on this major: ship the notice, or perform the removal, or record
      why the reversal condition fired. A row left unread is how a removal
      commitment becomes folklore.
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

- Re-run `release.yml` via **workflow_dispatch** with `resume: true`, or locally
  `task release -- --resume`.
- Firing the `release` label path twice is a clean no-op (the `--ci`
  nothing-to-release short-circuit).
- If a downstream dispatch (npm/cloud) failed but the tag + Release exist, re-run
  that specific workflow from the Actions tab — do **not** re-cut the release.

## 6. What can go wrong (known checkpoints)

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
```

A written-steps-only **dry run** (cut a no-op release following ONLY this doc,
no tribal knowledge) is the real freshness test — see the roadmap's Phase 3
dry-run step (maintainer-run; every gap found is a fix to this file).
