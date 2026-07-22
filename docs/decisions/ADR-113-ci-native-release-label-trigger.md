---
adr: 113
status: accepted
date: 2026-07-08
decision: ci-native-release-label-trigger
supersedes: —
superseded_by: —
phase: road-to-ci-native-release · Phase 1
---

# ADR-113 — CI-native release path, triggered by a `release` label on a merged PR

## Status

**Accepted** · 2026-07-08.

## Context

`task release` (`src/scripts/release.ts`) is a fully interactive, local
9-step pipeline: preflight → plan → confirm → branch+bump → commit/push+PR →
wait for CI → merge → tag → GitHub Release. The back half is already CI
(`publish-npm.yml`, `cloud-release.yml`, `release-guard.yml` all trigger on
the pushed numeric tag), but a maintainer must run the front half from a
terminal. This ADR adds an unattended, CI-native entry point alongside
`task release` — not a replacement.

## Decision

1. **Trigger: a `release` / `release:major` / `release:minor` /
   `release:patch` label on a PR, checked at merge time**
   (`pull_request: types: [closed]`, job-guarded on `merged == true` +
   an exact label match). `release` auto-detects the bump from
   Conventional Commits since the last tag (same logic `task release`
   uses); the `release:*` variants force the bump. `workflow_dispatch`
   (with `bump` / `version` / `dry_run` / `resume` inputs) is the
   manual/recovery entry for a release not tied to a PR merge.

2. **The numeric `X.Y.Z` tag stays the pipeline's *output*, never its
   input.** `publish-npm.yml`, `cloud-release.yml`, and
   `release-guard.yml` all trigger on `push: tags:
   [0-9]+.[0-9]+.[0-9]+` and assume the tagged commit already carries
   the bumped `package.json` / `marketplace.json` / regenerated
   projections. A tag-shaped trigger (hand-pushed numeric tag, or a
   `cut-*` intent tag) was considered and rejected — see Alternatives.

3. **One orchestration workflow (`release.yml`), not a prepare/finalize
   split.** GitHub's `GITHUB_TOKEN` recursion guard means events caused
   by the default token do not start new workflow runs (with narrow,
   documented exceptions — see the bot-PR finding below). A
   bot-auto-merged release PR would never trigger a separate
   merge-listening "finalize" workflow. `release.yml` instead runs the
   whole chain synchronously in one job, calling
   `src/scripts/release.ts --ci` end-to-end — the exact same pipeline
   `task release` runs locally, just non-interactively.

4. **`release.ts` gains a `--ci` mode, not a rewrite.** `--ci` changes
   exactly three things relative to the existing interactive path:
   - the `gh`-auth preflight probe (`gh api repos/{slug} --jq .id`
     instead of `gh api user --jq .login` — the default `GITHUB_TOKEN`
     is an installation token and `gh api user` returns 403 for it even
     when perfectly valid);
   - a `nothing_to_release_ci` short-circuit (empty commits + no
     explicit bump/version override → exit 0) so firing the label path
     twice in a row is a clean no-op, not a spurious empty release;
   - explicit post-release dispatch of `release-guard.yml`,
     `publish-npm.yml`, and `cloud-release.yml` via their `tag` input,
     because a `GITHUB_TOKEN`-pushed tag does not fire their
     `push: tags:` trigger either.

   Every other code path (bump inference, changelog-era rendering, the
   10-step `execute()` sequence, all idempotent-resume probes) is
   shared, unmodified, between `task release` and `release.yml`.

5. **Token: `secrets.RELEASE_PR_TOKEN` with a `GITHUB_TOKEN` fallback.**
   `release.yml` uses `${{ secrets.RELEASE_PR_TOKEN || secrets.GITHUB_TOKEN
   }}` for checkout, git push, and `gh` auth. See the bot-PR-approval
   finding below for why this matters and why the fallback is safe to
   ship without the secret configured.

## Finding — bot-created PRs need a manual "Approve workflows to run" click (no PAT)

Verified against GitHub's own changelog and community docs (2026-06-11,
["Bot-created pull requests can run workflows if
approved"](https://github.blog/changelog/2026-06-11-bot-created-pull-requests-can-run-workflows-if-approved/)):
when a workflow uses the default `GITHUB_TOKEN` to open or update a PR,
the resulting `pull_request` events (`opened` / `synchronize` /
`reopened`) DO create workflow runs for other `pull_request`-triggered
workflows — but those runs sit in an **approval-required** state until a
repo collaborator with write access clicks **Approve workflows to run**
in the PR's merge box. This is a deliberate GitHub security control
(distinct from, but related to, the fork-first-time-contributor approval
gate), not a bug in this design.

This repo's branch-protection ruleset (verified live via `gh api
repos/event4u-app/agent-config/rulesets/17749383`) requires
**zero** approving reviews (`required_approving_review_count: 0`) and
exactly **one** required status check, `Sync + Generate Tools
Consistency` (from `consistency.yml`, `pull_request`-triggered). That
check does not run automatically on a `GITHUB_TOKEN`-opened release PR
without the one-time approval click — so without `RELEASE_PR_TOKEN`, a
release via the label path pauses at "waiting for checks" until a
maintainer approves the run once per release.

**Accepted as the default**, not worked around, because:

- It requires zero new secrets and zero change to repo-wide security
  settings (disabling the org-wide first-time-contributor approval
  setting would lower security posture for every fork/bot PR, not just
  release PRs — out of proportion to this problem).
- A release is a production action; per this repo's own engineering
  safety floor (`engineering-safety-floor` rule) and Hard-Floor stance
  on deploys, a single human checkpoint before a release's own CI even
  runs is arguably a feature, not friction.
- `RELEASE_PR_TOKEN` (a fine-grained PAT or GitHub App installation
  token with `contents: write` + `pull-requests: write` + `actions: write`
  on this repo) removes the approval requirement entirely — documented as
  the zero-friction upgrade path in `release.yml`'s header comment. The
  `actions: write` scope ("Actions: read and write" on a fine-grained PAT,
  or the classic `workflow` scope) is required by release.ts step 9's
  explicit `gh workflow run` dispatch of the tag-triggered workflows
  (release-guard / publish-npm / cloud-release); without it that dispatch
  returns HTTP 403. As of 2026-07-21 that dispatch is **non-fatal** — the
  release is already complete when it runs, and a PAT-pushed tag fires
  those workflows on the push regardless — so a missing scope degrades to
  a logged warning, never a failed-but-shipped release. Adding
  it is a maintainer action, not part of this ADR.

## Verified facts (not assumed)

- Branch protection ruleset `main protection` (id `17749383`):
  `required_approving_review_count: 0`; required check =
  `Sync + Generate Tools Consistency`; `bypass_actors` includes a
  repository-role bypass. No human-review gate blocks a bot merge once
  checks are green.
- `consistency.yml` triggers on `pull_request` with path filters that
  match every file a release PR touches (`package.json`,
  `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `dist/agent-src/**`,
  `.augment/**`) — the required check fires (subject to the approval
  gate above), it is not silently skipped.
- No `RELEASE_PR_TOKEN`-shaped secret exists in the repo today (`gh
  secret list`) — the fallback path is the one that ships by default.
- `softprops/action-gh-release@v2`'s `overwrite_files` input defaults to
  `true` — re-attaching the same-named cloud-release assets on a
  dispatch-chain re-run is idempotent by construction, no extra guard
  needed.
- `npm publish` hard-rejects re-publishing an existing version — added a
  `npm view @event4u/agent-config@<tag> version` pre-check to
  `publish-npm.yml` so a double-dispatch (native tag-push trigger racing
  the explicit dispatch, when `RELEASE_PR_TOKEN` IS configured) is a
  clean skip, not a red run.

## Consequences

- Releasing needs exactly one human action: label a PR `release` (or a
  `release:*` variant) and merge it. Without `RELEASE_PR_TOKEN`, one
  additional "Approve workflows to run" click is needed once per
  release on the auto-created release PR.
- `task release` is unaffected — same script, same flags, same tests.
  It remains the interactive/local path and the documented fallback if
  the CI path misbehaves.
- Three existing workflows (`release-guard.yml`, `publish-npm.yml`)
  gained a `workflow_dispatch` input / idempotency guard respectively;
  `cloud-release.yml` needed no change (already idempotent).
- A future maintainer who configures `RELEASE_PR_TOKEN` gets a fully
  unattended release with zero code changes required — the fallback
  expression already prefers it.

## Alternatives considered

- **Hand-pushed numeric tag as the trigger.** Rejected: the tag-triggered
  workflows require the tagged commit to already carry the bump: a
  hand-pushed `X.Y.Z` on plain main fires them against the *un-bumped*
  tree (red `release-guard`, wrong npm tarball), and the tag would then
  have to be deleted and re-pushed onto the eventual bump-PR merge
  commit — mutable tags are an anti-pattern (stale fetches, npm
  provenance binds to the tag commit).
- **A `cut-*` intent tag** (`cut-X.Y.Z` / `cut-auto` / `cut-major` / …)
  in a separate namespace from the numeric tags. Functionally workable
  (does not collide with the publish/guard tag patterns), but the
  release label keeps the intent visible on the PR itself — reviewable,
  revocable pre-merge, no second git-tag vocabulary to teach.
- **`workflow_dispatch` as the sole/primary trigger**, no label. Loses
  the "the intent to release lives on the PR, and is revocable until
  merge" property that the label gives for free; kept as the
  manual/recovery entry, not the primary path.
- **Prepare + finalize workflow split** (one workflow opens the release
  PR, a second listens for its merge and finalizes). Needs a
  `RELEASE_PR_TOKEN`-class token as a *hard* requirement — under plain
  `GITHUB_TOKEN`, the bot-merged PR's `pull_request: closed` event is
  the SAME kind of GITHUB_TOKEN-caused event subject to the same
  approval/recursion nuance, and splitting the pipeline across two
  workflow boundaries adds a second place idempotency can drift. The
  single-workflow design collapses this into one synchronous run using
  the already-battle-tested `execute()` sequence.
- **Disable the org-wide "require approval for first-time contributors"
  setting** to remove the bot-PR approval gate without a PAT. Rejected:
  it is an org-wide security posture change affecting every fork/bot PR
  in the organization, not scoped to releases — disproportionate to
  this problem; `RELEASE_PR_TOKEN` is the properly-scoped fix.

## References

- `.github/workflows/release.yml` — the orchestration workflow.
- `src/scripts/release.ts` — the shared pipeline (`--ci` mode).
- `docs/contracts/release-pr-gating.md`,
  `docs/contracts/branch-protection-policy.md` — release-PR shape and
  required-check contracts this design must keep satisfying.
- [GitHub Changelog — Bot-created pull requests can run workflows if
  approved (2026-06-11)](https://github.blog/changelog/2026-06-11-bot-created-pull-requests-can-run-workflows-if-approved/)
