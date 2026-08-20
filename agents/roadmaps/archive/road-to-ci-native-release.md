---
complexity: standard
---

# Roadmap: CI-native release path alongside `task release`

> Add a CI-native release path: merging any PR that carries the `release`
> label runs the full release orchestration (bump, changelog, release PR,
> merge, tag, GitHub Release) unattended in GitHub Actions. The local
> `task release` pipeline stays fully supported — both paths share the same
> `src/scripts/release.ts` logic and guard against each other.

## Context

Today `task release` runs `src/scripts/release.ts` locally through 9 steps:
preflight → plan (Conventional-Commits bump detection) → confirm → branch +
bump (`package.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`,
`task release-prepare`) → commit/push + PR → wait for CI → merge → tag main →
GitHub Release. The **back half is already CI**: the tag push triggers
`publish-npm.yml` (npm OIDC publish), `cloud-release.yml` (cloud artefacts),
and `release-guard.yml` (version==tag assert); `release-validation.yml`
gates the release PR; `release-drift.yml` is the daily backstop.

**Trigger = release label on a merged PR.** A maintainer labels any work PR
`release` (or `release:major` / `release:minor` / `release:patch` to
override the Conventional-Commits auto-detect). When that PR merges into
main, the release pipeline fires. The intent is visible on the PR and
revocable until merge (remove the label). `workflow_dispatch` remains as a
manual/recovery entry for releases not tied to a specific PR.

**Dual-path by design.** `task release` (interactive, local) and the label
flow (unattended, CI) coexist permanently — same script, two entry points.
Collision safety comes from the shared preflight probes (target tag absent,
no open release PR) plus the CI concurrency group; whichever path starts
second refuses cleanly.

Rejected alternative triggers (hand-pushed numeric tag, `cut-*` intent tag,
dispatch-as-primary) are recorded in the Phase 1 ADR, not here — the short
version: the numeric `X.Y.Z` tag must stay the pipeline **output** (the
tag-triggered publish/guard workflows require the tagged commit to already
carry the bumped versions), so no tag-shaped input trigger survives.

**Why ONE orchestration workflow instead of prepare + finalize workflows:**
events caused by `GITHUB_TOKEN` do not start workflows (GitHub's recursion
guard). A bot-created release PR that auto-merges would therefore never
trigger a separate merge-listening finalize workflow — that split needs a
GitHub App / PAT token. Instead, a single `release.yml` run performs the
whole chain synchronously, exactly mirroring the battle-tested release.ts
sequence: create release PR → `gh pr checks --watch` → merge → tag → GitHub
Release → explicitly dispatch `release-guard.yml` + `publish-npm.yml` +
`cloud-release.yml` via their existing `tag` input (explicit dispatch,
because the bot-pushed tag does not trigger their tag-push events either).

**Verified finding (2026-07-08, see ADR-113): bot-created PRs need a manual
approval click, absent a PAT.** GitHub's `pull_request` events DO fire for a
`GITHUB_TOKEN`-opened PR, but the resulting workflow runs — including the
one required status check, `Sync + Generate Tools Consistency` — sit in an
**approval-required** state until a maintainer clicks "Approve workflows to
run" (a GitHub security control shipped 2026-06-11, confirmed live against
this repo's branch-protection ruleset: `required_approving_review_count: 0`,
one required check, no other human-review gate). `release.yml` uses
`secrets.RELEASE_PR_TOKEN || secrets.GITHUB_TOKEN` — with the PAT configured
the release is fully unattended; without it (the shipped default), one
approval click per release is needed before `gh pr checks --watch` sees
green and proceeds. Accepted as the default rather than worked around (ADR-113
Alternatives) — no new secret required to ship, no repo-wide security
setting touched.

The proven logic in `release.ts` (bump inference, changelog-era rendering,
idempotent state probing) is **reused**, not reimplemented in bash: the
script gets a non-interactive CI entry point (`--ci`) that the workflow calls.

## Phase 1: Design lock + ADR

- [x] Write the ADR (via `adr-create`): `docs/decisions/ADR-113-ci-native-release-label-trigger.md`.
      Trigger = `release` label on a merged PR (numeric tag stays the
      pipeline *output*); label taxonomy `release` / `release:major` /
      `release:minor` / `release:patch`; single-orchestration-workflow
      decision with the GITHUB_TOKEN recursion guard as rationale;
      dual-path contract (below); the verified bot-PR-approval finding and
      its `RELEASE_PR_TOKEN` fallback. Rejected alternatives recorded:
      numeric hand-tag as input, `cut-*` intent tag, dispatch-as-primary,
      prepare/finalize workflow split, disabling the org-wide
      first-time-contributor approval setting. Index regenerated
      (`./scripts-run src/scripts/adr/regenerate_index --dir docs/decisions/ --check` → exit 0).
- [-] Optional council pass over the ADR draft. <!-- skipped: trigger design resolved by verified live evidence (gh api rulesets, GitHub changelog), not contested enough to warrant a council round -->
- [x] Verified branch protection live (`gh api repos/event4u-app/agent-config/rulesets/17749383`):
      `required_approving_review_count: 0`, one required check
      (`Sync + Generate Tools Consistency`), `bypass_actors` present — no
      human-review gate blocks a `GITHUB_TOKEN` merge once checks are
      green. The real blocker found instead: bot-created PRs need a
      one-time "Approve workflows to run" click before those checks even
      run (see the Context finding + ADR-113) — recorded as the accepted
      default, `RELEASE_PR_TOKEN` as the opt-in removal path.
- [x] Recorded the dual-path contract in ADR-113: `task release` stays the
      interactive local path, the label flow is the unattended CI path;
      collision safety = shared preflight probes (tag absent, no open
      release PR) + CI concurrency group `release`; neither path is "the
      fallback" — both are first-class, `task release` is also the documented
      rollback if the CI path misbehaves.

## Phase 2: Refactor release.ts into a CI entry point

- [x] Added `--ci` flag to `src/scripts/release.ts` — swaps the gh-auth
      preflight probe (`gh api repos/${REPO_SLUG} --jq .id` instead of
      `gh api user --jq .login`, which 403s for the installation-scoped
      `GITHUB_TOKEN`); everything else in `preflight()`/`execute()` is
      identical to the interactive path (honors `--as`, `--version`,
      `--dry-run`, `--resume` unchanged).
- [x] `nothing_to_release_ci()` pure guard (exported, unit-tested): under
      `--ci` with no explicit `--version`/`--as` and zero commits since the
      last tag, `main()` exits 0 with a "nothing to release" notice before
      any mutation — the label flow is safe to fire twice.
- [x] Idempotent re-entry already existed (branch/PR/tag/Release probes in
      `execute()`, pre-dating this work) — confirmed unchanged and reused
      as-is for the CI path; no `--resume` reimplementation needed.
- [x] Post-release dispatch-chain added in `execute()` step 9 (only on the
      branch that actually creates the GitHub Release, never on the
      `_release_exists` skip branch — so a `--resume` re-run never
      re-dispatches a publish that already happened): `release-guard.yml`
      + `publish-npm.yml` + `cloud-release.yml` via `gh workflow run … -f
      tag=X.Y.Z` (release-guard.yml gained a `workflow_dispatch` input for
      this — see Phase 4).
- [x] Interactive invocation stays byte-compatible: `Args.ci` defaults
      `false`, every existing flag/branch unchanged when `--ci` is absent;
      both modes call the same `main()`/`preflight()`/`execute()` — shared
      by construction, no duplicated plan/bump/changelog logic exists to
      drift.
- [x] Extended `tests/scripts/release.test.ts`: `nothing_to_release_ci`
      unit tests (5 cases), `--ci`/`--dry-run` CLI smoke test,
      `--ci=value` rejected like every other boolean flag. Full suite:
      `npx vitest run tests/scripts/release.test.ts` → 67/67 passed.

## Phase 3: `release.yml` orchestration workflow

- [x] New workflow `.github/workflows/release.yml`, two triggers:
      `pull_request: types: [closed]` with a job-level `if:` guarding
      `merged == true` + an EXACT match against one of `release` /
      `release:major` / `release:minor` / `release:patch` via
      `contains(labels.*.name, '<exact>')` (never a substring match on the
      joined names, so a label like `prerelease-notes` cannot false-fire);
      and `workflow_dispatch` with inputs `bump` (choice:
      auto/major/minor/patch), `version`, `dry_run`, `resume` (added for
      `release-drift.yml` recovery — see Phase 5) as the manual/recovery
      entry.
- [x] Label → flag mapping implemented in the "Resolve release flags" step:
      `release` → auto-detect; `release:X` → `--as X`; multiple `release:*`
      labels on one PR → `exit 1` before any checkout/git state is touched.
- [x] Concurrency group `release`, `cancel-in-progress: false`.
- [x] Job: checkout `main` (full history + tags), git identity configured,
      Node 20 + `npm ci`, run `./scripts-run src/scripts/release --ci --yes`
      with mapped `--as`/`--version`/`--resume`/`--dry-run` flags.
      Permissions: `contents: write`, `pull-requests: write`,
      `actions: write` (dispatch release-guard/publish-npm/cloud-release).
- [x] Git identity step added (`github-actions[bot]`); commit subject stays
      `release: X.Y.Z` — unchanged code path, `release-validation.yml`'s
      shape detector keeps matching.
- [x] Verified live (not assumed) that branch protection's only required
      check is `Sync + Generate Tools Consistency` and that
      `consistency.yml`'s `pull_request` path filters cover every file a
      release PR touches — real finding: bot-PR runs need one approval
      click without `RELEASE_PR_TOKEN` (Context + ADR-113). `release.yml`
      documents this in its header comment.
- [x] Created the four labels on the live repo (`gh label create`):
      `release` (green), `release:major` (red), `release:minor` (yellow),
      `release:patch` (light blue) — with descriptions matching the
      workflow's mapping. This is a real, visible repo-settings change made
      during this run, not a code diff — flagged in the closing summary.
- [~] `workflow_dispatch --dry-run` verification — confirmed empirically
      (not just assumed) that this is blocked until merge: `gh workflow run
      release.yml --ref feat/ci-native-release-label-flow -f dry_run=true`
      returned `HTTP 404: workflow release.yml not found on the default
      branch` even with the file pushed on the feature branch and a PR
      open. GitHub only lets you dispatch a workflow whose file already
      exists on the repo's default branch. Deferred to Phase 7, right after
      this PR merges. <!-- deferred: GitHub API constraint, not a design gap; first dispatchable the moment this lands on main -->

## Phase 4: Failure handling + guard folding

- [~] Live failure drill (kill the workflow after each of: release-PR
      created; PR merged but tag missing; tag pushed but Release/dispatch
      missing) needs a real `release.yml` run against this repo to
      interrupt mid-flight — deferred to Phase 7, sequenced right after the
      first real release so there is a live run to safely kill.
      <!-- deferred: requires live Actions runs + real repo state (branches/PRs/tags); safest done alongside Phase 7's E2E pass, not as a standalone earlier step -->
- [x] Closed the release-guard gap differently than originally planned:
      instead of duplicating the package.json/marketplace.json/tag
      assertion inline in `--ci`, gave `release-guard.yml` itself a
      `workflow_dispatch` input (mirroring `publish-npm.yml` /
      `cloud-release.yml`) and dispatch-chained it from `execute()` step 9
      — reuses the existing, already-correct workflow instead of
      forking its logic into TypeScript. `release-guard.yml`'s native
      `push: tags:` trigger is kept unchanged as the backstop for
      hand-pushed tags.
- [x] Red-checks path is inherited behavior, not new code: `execute()`'s
      `watch_pr_checks()` (unchanged, battle-tested) already leaves the
      release PR open and the process non-zero on a check failure —
      `release.yml`'s job goes red, nothing merges, nothing tags. The job
      summary step documents the most likely stuck-check cause (the
      bot-PR approval click) and the recovery action.

## Phase 5: Guards, backstops, contracts

- [x] `release-drift.yml`: recovery hint now names both paths — local
      `./scripts-run src/scripts/release --resume` OR `workflow_dispatch`
      on `release.yml` (its `--ci --resume` path is equally resume-safe).
- [x] `release-guard.yml`: error-message hint now also names the label flow
      alongside `task release`.
- [x] Updated `docs/contracts/release-pr-gating.md` and
      `docs/contracts/branch-protection-policy.md`: release-PR author can
      now be the Actions bot (shape checks confirmed author-agnostic);
      documented the label trigger, ADR-113's bot-PR-approval finding, and
      the verified branch-protection facts (0 required reviews, 1 required
      check). Also fixed stale `scripts/release.py` /
      `check_release_pr_shape.py` path references directly adjacent to the
      new content (the py2ts migration renamed these to `.ts` long ago;
      left the unrelated `python2ts`-branch addendum untouched — out of
      this roadmap's scope).
- [x] Checked `check_release_trunk_sync.ts`, `check_release_published.ts`,
      `check_release_pr_shape.ts` — none reference `task release`,
      `scripts/release`, or the PR author/actor; all three gate on
      structural shape (branch name, PR title, file diff), not who created
      it. No change needed — already author-agnostic.

- [x] `taskfiles/release.yml` — kept the `release`/`release:major/…`/
      `npm:login` tasks as-is; extended the `release` task's `desc:` with a
      pointer to the label flow + ADR-113. Also fixed a stale
      `scripts/release.py` mention in the same block (directly adjacent).
- [x] Doc sweep — header comments updated in `publish-npm.yml` (dual-path +
      idempotency-guard rationale), `release-guard.yml` (dispatch-chain
      rationale), `cloud-release.yml` (overwrite_files idempotency note);
      `docs/contracts/CHANGELOG-conventions.md` now names both entry
      points and fixes 3 stale `.py` path references
      (`release.py`/`test_changelog_eras.py`/`changelog_eras.py` → `.ts`).
      `docs/development.md` / `docs/maintainers/dev-mode.md`'s casual `task
      release` mentions reviewed and left as-is (no exclusivity claim to
      correct). `release-validation.yml`'s two hint messages
      ("Run `task release` from main…") reviewed and left as-is — still
      accurate advice regardless of which entry point a maintainer prefers
      to redo a malformed release PR; fixed 2 adjacent stale `release.py`
      code comments in the same file. Historical `docs/archive/` and prior
      ADRs (ADR-019, ADR-027) untouched by design (append-only history).
- [x] Consistency check run: `grep -rn "task release" --include="*.md"
      --include="*.yml" docs src .github taskfiles Taskfile.yml README.md`
      — every live (non-archive, non-historical-ADR) hit reviewed; none
      claims `task release` is the only release path.

## Phase 7: End-to-end validation + rollback safety

- [x] E2E dry run (local half): ran `./scripts-run src/scripts/release
      --dry-run` against current main — coherent plan (8.2.0 → 8.3.0,
      minor, 19 commits since last tag). Both entry points share the exact
      same plan/bump/changelog code path (`main()` computes the plan before
      branching on `--ci`; `--dry-run` returns before that branch is even
      reached), so this is sufficient evidence the outputs match — no
      separate CI-side dry-run needed to prove parity.
      <!-- deferred: workflow_dispatch --dry-run needs this PR merged to main first (see the Phase 3 item — confirmed via a live 404, not assumed) -->
- [~] First real release through the new path — **Hard Floor**: cutting a
      real release publishes to npm and creates a public GitHub Release;
      per `non-destructive-by-default` this needs the user's explicit,
      this-turn go-ahead, which authoring this roadmap + PR does not
      constitute. Ready whenever a maintainer labels a merged PR `release`
      (or dispatches the workflow) — nothing further to build.
      <!-- deferred: Hard-Floor deploy/release action; requires explicit user authorization on the turn it happens, not assumed from PR-creation authorization -->
- [~] Live failure drill + double-fire check + collision drill — all three
      need a real `release.yml` run (or a genuinely open release PR/branch
      on the live repo) to observe; sequenced right after the first real
      release above, by the same authorization gate.
      <!-- deferred: same Hard-Floor gate as the item above; static-code review already confirms the shared preflight probes and the nothing-to-release guard are wired correctly (Phase 2/3), but live confirmation waits for an authorized real run -->
- [x] Rollback note recorded in ADR-113's Consequences section: `task
      release` is unaffected and remains the documented fallback if the CI
      path misbehaves; manual recovery for a half-finished CI run =
      `workflow_dispatch` on `release.yml` (with `resume: true`), or
      hand-tag + dispatching `publish-npm.yml` / `cloud-release.yml` /
      `release-guard.yml` (already supported today).

## Acceptance Criteria

- A release requires exactly one human action: put the `release` label on a
  PR and merge it — release PR → merge → numeric tag → GitHub Release → npm
  publish → cloud artefacts run unattended; `workflow_dispatch` covers
  releases not tied to a PR.
- `task release` keeps working unchanged — both paths render the identical
  plan for the same HEAD and ship byte-identical release artefacts.
- The two paths never collide: whichever starts second refuses cleanly via
  the shared preflight probes; firing the CI path twice never
  double-releases.
- A re-run of the workflow after a partial failure converges without manual
  git surgery (idempotent steps).
- `release-guard`'s invariant (tag == package.json == marketplace.json)
  holds on every published tag; `release-drift.yml` stays green.
- Every live doc describing the release flow presents both paths (local
  `task release` + `release` label).

## Risks / Blockers

- **Branch protection vs. bot merge** — if `main` requires human reviews,
  the `GITHUB_TOKEN` cannot merge the release PR; needs a ruleset bypass
  for the Actions bot on `release/*` heads or a GitHub App token
  (maintainer action, decided in Phase 1).
- **GITHUB_TOKEN recursion guard** — the bot-pushed tag triggers nothing;
  mitigated by explicit dispatch-chaining (both target workflows already
  take a `tag` input). Covered inside the single-workflow design; no
  separate merge-listening workflow exists that could silently not fire.
- **Watch-phase runner time** — the run blocks on release-PR checks;
  bounded by the <60s release-validation set (release PRs skip the heavy
  matrices per `release-pr-gating.md`). Add a watch timeout so a stuck
  check fails the run instead of hanging it.
- **Dual-path collision** — a local `task release` racing a labeled-PR
  merge; mitigated by the shared preflight probes (tag absent, no open
  release PR) and the Phase 7 collision drill. Residual risk is a benign
  refused run, never a double release.

<!-- Deferred items migrated to agents/roadmaps/archive/road-to-ci-native-release-first-run.md on 2026-07-08 -->
