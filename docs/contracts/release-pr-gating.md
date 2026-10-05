---
stability: beta
keep-beta-until: 2026-09-26
keep-beta-reason: >-
  Beta review 2026-09-05. Its normative core is delegated at § 145-147 to
  `branch-protection-policy.md`, which is beta and extended in this same change,
  so promoting this one would make a stable contract depend on a beta one — the
  ci-green-floor precedent verbatim. Independently, the same stub roadmap holds a
  committed, not-yet-executed edit to this contract's required-check list, so its
  § Kept surface table describes a floor the ruleset does not yet enforce.
  Anchor: `road-to-main-protection-ruleset-changes.md` `review_by: 2026-09-25`;
  2026-09-26 puts the three coupled contracts on one review date. Before the
  window ends: the ruleset write lands, the § Kept surface synchronisation the
  stub names is performed, and `branch-protection-policy.md` reaches its own
  disposition.
---

# Release-PR Gating Contract

> **Status:** active · **Owner:** maintainer (`src/scripts/release.ts`) · **Opened:** 2026-05-26
>
> Release PRs are opened by either entry point into `release.ts`: `task
> release` (interactive, local) or `.github/workflows/release.yml` (the
> `release`-labeled-PR CI path, author `github-actions[bot]`) — see
> [`ADR-113`](../decisions/ADR-113-ci-native-release-label-trigger.md).
> This contract's shape checks are author-agnostic by design; both entry
> points produce the identical PR shape below.
>
> Source: `road-to-optimized-ci-and-release-gates.md` Phase A Step 1. Original
> baseline, run-level (`gh run list --branch main --limit 50`): `Public Install
> Smoke` avg **413 s** (3-OS × 2-Node matrix), `Tests` avg **218 s** (Linux +
> macOS + Windows). **Re-measured per job on 2026-08-11** — the slowest Public
> Install Smoke leg is the Windows one at 159–169 s, and no leg is near the
> 5-minute ceiling; the two figures are not directly comparable because the
> older one is matrix-level. Current per-job numbers live in
> [`ci-cost-budget.md`](ci-cost-budget.md); the skip argument below is
> unaffected either way. Both trigger on `package.json`. Release PRs (`release/X.Y.Z`)
> only touch the allowlist enumerated under § Release-PR shape below. The paths
> are NOT listed here: a second copy of that list went stale for months and named
> paths the code had already renamed. The file-set claim was verified against
> PR #238 (3.3.0) and the allowlist has grown since, so what carries the
> argument is what the release flow WRITES into those paths: version fields,
> changelog prose, generated manifests and two report artifacts. Stated that
> way because the categorical version — "no entry is install or runtime code" —
> is false of several of them:
> the npm manifests carry `bin`, `files`, `dependencies` and `engines`, and the
> plugin and marketplace manifests ship in the tarball. `check_release_pr_shape`
> matches paths and never reads content, so nothing here stops a release PR from
> editing any of those fields with the install matrix skipped.
>
> That gap is in the WHICH-PATHS gate's blind spot by construction and is not new
> here — the checker has never opened a file. It does not contradict § Mid-release
> fixes below: "no escape hatch" is about the path set, which is closed and has no
> override, while this is about content inside an admitted path, which no gate
> reads. Closing it needs a content check (version fields only in the npm and
> plugin manifests) that does not exist; until one does, it is held by review, and
> it is recorded here rather than left for a reader to infer from silence.

## Release-PR shape

A pull request qualifies as a **release PR** when **both** of the following
hold:

1. **Head branch matches** `^release/\d+\.\d+\.\d+$` — same regex as
   `src/scripts/release.ts` § `_RELEASE_BRANCH_RE`.
2. **Diff file set is a subset of the version-bump allowlist:**
   - `package.json`
   - `package-lock.json` — version fields bumped in lockstep by
     `release.ts` § `set_lockfile_version`
   - `CHANGELOG.md`
   - `.claude-plugin/marketplace.json`
   - `.augment-plugin/plugin.json`
   - `.augment-plugin/marketplace.json` — both version-synced by `release.ts`
     § `set_augment_manifest_version`; both ship in the tarball, so a release
     PR must carry them
   - `src/packs/*/pack.yaml`
   - `src/packs/*/README.md`
   - `src/domains/*/pack.yaml`
   - `src/domains/*/README.md`
   - `docs/archive/CHANGELOG-pre-*.md` — emitted by `release.ts`'s
     automatic CHANGELOG era split (see `docs/contracts/CHANGELOG-conventions.md`
     § Era splits) when the current era crosses its line cap on an
     era-boundary release.
   - `agents/evidence/release-findings/*.json` — the finding-disposition
     ledger; the `finding-dispositions` gate is red until a release's own
     blocking self-review findings are recorded there
   - `agents/evidence/analysis/evidence-temperature-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].md`
     — the per-release evidence-temperature census written by
     `taskfiles/content.yml` § `release-prepare`, step 2 of `task release`.
     The ISO date shape in fnmatch digit classes rather than `?`; the entry in
     `ALLOWLIST_GLOBS` carries why.
   - `src/agent-src/templates/agents/agent-project-settings.example.yml`
   - `dist/agent-src/templates/agents/agent-project-settings.example.yml` —
     the project-settings template pin and its regenerated twin, kept in
     lockstep with `package.json.version`

   **`*` and `?` both cross `/` here.** These are fnmatch patterns, not shell or
   `.gitignore` globs: `*` becomes `.*` and `?` becomes `.`, both under the `s`
   flag, so each matches a path separator like any other character. Every `*` row
   above therefore admits arbitrary depth — `src/packs/core/installer/pack.yaml`
   and `agents/evidence/release-findings/a/b/c.json` both pass. And the census
   row uses digit classes rather than `?` for the same reason: `????-??-??` would
   admit `evidence-temperature-x/yz-ab-cd.md`, while `[0-9]` cannot match a
   separator at all. A reader predicting the gate from this list needs both
   halves; each is pinned in `tests/scripts/check_release_pr_shape.test.ts`.

   This list and `ALLOWLIST_GLOBS` are one decision recorded twice, and they
   drifted for months — the contract named `packages/*/pack.yaml` long after
   the code said `src/packs/*`. An instruction to edit both was the only thing
   binding them, and it failed.

   **A test binds them now**: `the contract enumerates exactly the globs the
   gate compiles` in `tests/scripts/check_release_pr_shape.test.ts` parses the
   bullets above and asserts set-and-order equality against `ALLOWLIST_GLOBS`.
   That is why every entry is one bullet carrying one backticked glob verbatim,
   rather than a readable paraphrase: the list a reader predicts the gate from
   and the list the gate compiles are now the same strings, checked.

   The blockquote above carries no copy at all, because its copy supported an
   argument the paths were not needed for. This enumeration stays, because it
   IS the contract — a reader must be able to predict the gate without reading
   TypeScript.

   What the test does NOT cover: the § Cut surface table below argues from the
   allowlist in prose, and no parser reads those cells. That is why its rows now
   argue ("no TypeScript source") instead of restating paths — a claim about the
   allowlist's character survives an entry being added, where a copy of the list
   would not.

Both predicates are enforced by `src/scripts/check_release_pr_shape.ts`.
The script exits 0 when both hold; non-zero with a per-file diff naming any
out-of-allowlist entry otherwise. It reads the diff shape only — it does
not check the PR author, so it passes identically for a `task
release`-opened PR and a `release.yml`-opened one.

## Mid-release fixes — land on main, never on the release branch

A fix discovered while a release PR is red (a broken gate, a CI bug) must
**not** be committed onto `release/X.Y.Z`: any non-allowlist file makes the
shape detector red by design, because the cut surface below skips the heavy
test matrix on `release/*` heads — code riding a release PR would bypass it.
There is deliberately no escape hatch or override label.

The conforming procedure:

1. Branch off `origin/main`, cherry-pick (or author) the fix, open its own
   PR — the full test matrix runs there.
2. After that PR merges: `git checkout release/X.Y.Z && git merge
   origin/main && git push`. The fix files are now identical on both sides
   of the release PR, so its diff shrinks back to the allowlist and the
   shape detector goes green — while the fix is present at the release
   head for every other gate.
3. Extend the release's CHANGELOG entry with the post-cut commits
   (`CHANGELOG.md` is on the allowlist) and refresh the `Tests: N` footer.
4. Resume with `task release -- --resume --yes`.

Both failure surfaces point here: `check_release_pr_shape.ts` prints this
procedure under its `OUT-OF-SHAPE` findings, and `release.ts` §
`watch_pr_checks` names the failing checks and repeats the resume command.

## Cut surface — heavy jobs that skip on release PRs

Skipped via `if: !startsWith(github.head_ref, 'release/')` guards on the heavy
install/test jobs. The guard is on the BRANCH, not on paths — so the column
below is the argument for why that is safe, not a condition the workflow
evaluates. The argument rests on the allowlist in § Release-PR shape: it admits
no install script and no test source. The two manifests it DOES admit are
consumed by every one of these jobs — `npm ci` reads the lockfile, every step is
an `npm run`, the smoke matrix runs the tarball's `bin` — so each job's row below
names what covers that manifest on the release path rather than claiming nothing
reaches it. It is NOT the
stronger claim the opening blockquote withdraws — `package.json` is admitted and
carries `bin`, `files`, `dependencies` and `engines`, whose content no gate
reads. That residue is the blockquote's, not this section's, and the `smoke` row
below points back at it.

It does admit six paths under `src/` and `dist/`: pack and domain metadata
(`pack.yaml` ×2), their READMEs (×2), and the project-settings template pin with
its regenerated twin. One of the six sits under both `src/` and `templates/`, so
the sets overlap rather than add. None is code any job below exercises, which is
the claim; "the diff has no `src/**`" would be the stronger claim, and it is
false.

All seven `tests.yml` jobs carrying the guard are listed — derived from the
`if:` lines, not from memory. An earlier version of this table named two jobs
that no longer exist and omitted four that do skip, which is how a table nothing
parses decays.

| Workflow | Job | Why skipping it is safe on a release PR |
|---|---|---|
| `tests.yml` | `install-tests` | the allowlist has no `src/scripts/install.sh`, `src/scripts/install.ts` or `tests/test_install.sh` |
| `tests.yml` | `install-aux-tests` | same — orchestrator, key contracts, one-liner smoke all untouched |
| `tests.yml` | `node-tests` | no TypeScript source and no test source; the admitted `src/**` paths are YAML, Markdown and a settings template |
| `tests.yml` | `static-checks` | its source-reading steps have no admitted input: the allowlist carries no TypeScript and no test file. It does admit one generated file — the `dist/` template twin — whose freshness `consistency.yml` gates on the kept surface. Several steps here read generated trees (`prepack-check` reads `dist/cli`, `dist/hooks`, `dist/router.json`; the MCP-drift step rebuilds and diffs the committed catalog); none of them reads that twin. Its MANIFEST-reading steps each have a release-path twin: `npm audit` → `release-validation.yml` § `audit-gate`, `prepack-check` → `consumer-matrix.yml`, `publint` → `evaluator-umbrella.yml` (no head-ref guard, `paths:` leads with `package.json`, so it runs on every release PR by construction). This cell is prose over a step list nothing parses — read the job if the list matters |
| `tests.yml` | `golden-tests` | golden corpora live under `tests/` and `internal/`, neither admitted |
| `tests.yml` | `collector-lifecycle` | exercises collector scripts under `src/scripts/`, none admitted |
| `tests.yml` | `workspace-tests` | exercises workspace wiring under `src/` and `tests/`; the admitted pack and domain files are metadata those tests do not read |
| `smoke-public-install.yml` | `smoke` | no `src/scripts/install*`, matching this job's own `paths:` filter. TWO admitted paths ARE among its triggers: `package.json`, whose content no gate reads (opening blockquote), and `src/agent-src/templates/agents/agent-project-settings.example.yml`, a version-pinned example file whose pin `check_template_pin_drift` gates on the kept surface |

`push:` to `main` and the weekly cron on `smoke-public-install.yml` stay
**unconditional** — those catch drift the PR matrix can't see.

## Kept surface — release PRs still prove these

The release-PR required-check floor stays equivalent (smaller, faster) to
the feature-PR floor by adding:

| Workflow | Job | Proves |
|---|---|---|
| `consistency.yml` | (existing) | `task consistency` — source-of-truth integrity |
| `evaluator-umbrella.yml` | `umbrella` | `publint` plus the evaluator budgets. No head-ref guard; its `paths:` filter leads with `package.json`, which every release bumps, so it runs on release PRs by construction rather than by exception |
| `smoke.yml` | `smoke-contracts` | Contract self-checks (kernel, router, hashes) |
| `release-guard.yml` | `assert-version-matches-tag` | already gates `npm publish`; remains tag-trigger |
| `migration-dry-run.yml` | (existing) | Migration plan dry-runs |
| `release-validation.yml` (Phase B) | `release-shape` | shape detector — fails closed if diff exits the allowlist |
| `release-validation.yml` (Phase B) | `changelog-entry` | CHANGELOG carries an entry matching the head-branch version |
| `release-validation.yml` (Phase B) | `version-consistency` | `package.json` / `marketplace.json` agree on the version (pack manifests carry no version field), and `check_template_pin_drift` holds the settings-template pin to it — the check § Cut surface's `smoke` row forward-references |
| `release-validation.yml` (release-truth) | `surface-equality` | PR body equals the CHANGELOG entry (whitespace-normalized) — release.ts derives all four surfaces (PR body, changelog, GitHub release notes, annotated tag message) from the changelog section at the relevant head |
| `release-validation.yml` (release-truth) | `highlight-plausibility` | curated head cannot claim `_none_` against a populated span-derived category (security commits, behaviour/default changes, honest nulls, removed public surface). **Prose polish is not gated** — an un-rewritten generator-derived head line warns and exits 0, because curating the head is retro-curation and not a merge precondition; the decision and its rejected branch are recorded in [`CHANGELOG-conventions.md` § Curated-head cadence](CHANGELOG-conventions.md#curated-head-cadence--retro-curation-not-a-merge-precondition) |
| `release-validation.yml` (release-truth) | `finding-dispositions` | every blocking/high self-review finding carries a committed disposition in `agents/evidence/release-findings/<version>.json` — ingest via `check_finding_dispositions --ingest`; the ledger (never the PR comment) is the record |
| `consumer-matrix.yml` | `consumer-matrix` · `publish-dry-run` · `mcp-worker-dry-run` · `plugin-bootstrap` | pack-based consumer E2E + pre-tag dry-runs of the release-adjacent workflows — see the exemption note below |
| (maintainer-local) | `task smoke-host-loadability REQUIRE=1` | real-host loadability — `claude plugin validate` + temp-home plugin install + metadata cross-consistency (marketplace ↔ plugin dirs ↔ docs). Optional in CI (runners lack the claude CLI, the step self-skips); **required before a release is cut** — `REQUIRE=1` turns a missing CLI into a failure |

## Release install E2E — the packed artifact, not just the source diff

`release-validation.yml`'s fourth job, `release-install-e2e`
(`tests/test_release_install_e2e.sh`), closes a gap the cut surface above
does not cover: that the allowlist admits no install script and no test
source is a claim
about the **source diff**, not about whether the **packed tarball**
actually installs, upgrades, and boots as a real npm global package. Every
release PR now proves, against the real tarball:

- a fresh `npm install -g` into an isolated npm prefix resolves the
  `agent-config` binary and ships no silent postinstall/GUI side effect;
- upgrading from a cached 9.7.0 baseline lands the release version cleanly;
- the code-graph engine's WASM (`web-tree-sitter` / `tree-sitter-wasms`)
  loads and builds/validates a graph on a fixture repo;
- the GUI server boots headless (`--allow-headless --dry-run`) and
  answers an HTTP ping;
- `reach:doctor` (read-only) and the repo-side secret-leak gate both run
  clean;
- `npm uninstall -g` leaves no orphaned files.

The baseline tarball is cached tarball-to-tarball (`actions/cache@v4`,
key `npm-baseline-9.7.0`) so an npm-registry hiccup blocks the cache-miss
**setup** step, never the validation itself — a failed baseline fetch is
reported as a setup failure, distinct from an actual install regression.
This is the job required per `branch-protection-policy.md`'s Release-PR
row; it means the 9.8.0-class skip (a release shipping without a piece
the source diff couldn't see was missing) cannot recur silently.

## Consumer-matrix exemption — the tarball window

The cut surface above rests on the allowlist admitting no file those jobs execute.
That argument covers the **source diff** — it is blind to the **published
tarball**, and, as the opening blockquote records, to the content of an
admitted manifest. Every historical
packaging incident (tarball missing `src/install/` across two minors,
`tsx` absent from the package, npm-pin drift, the MCP worker deploy red
across five releases) entered `main` on ordinary PRs and manifested only
at publish time — exactly the window between merge and tag where nothing
pack-based ran.

[`consumer-matrix.yml`](../../.github/workflows/consumer-matrix.yml) is
therefore **exempt from the release-PR skip and runs ON release PRs** (its
primary trigger), packing the tarball and exercising it as a consumer,
plus dry-running `publish-npm.yml` and `deploy-mcp-worker.yml` before the
tag exists. Contract + counterfactual map:
[`docs/distribution/consumer-matrix.md`](../distribution/consumer-matrix.md).
The source-level skips above stay unchanged — the exemption adds the
tarball dimension, it does not reopen the source matrices.

## Rollback trigger — fail-closed

The optimisation is **opt-in by shape, not by branch name**. A release-PR
whose diff contains a stray file outside the allowlist (e.g. a last-minute
CHANGELOG fixup that also touches `src/scripts/release.ts`) trips the shape
detector:

1. `check_release_pr_shape.ts` exits non-zero with a per-file diff.
2. The CI dashboard surfaces "release-shape" red.
3. The maintainer either narrows the diff (move the script edit to a
   separate PR) or accepts the heavy matrix re-running on the next push.

In other words: the cut applies only when shape is **provably** safe. Branch
name alone never bypasses the heavy matrix.

## What this contract is not

- **Not a test-deletion contract.** Every existing assertion still runs
  somewhere in the cadence (PR for feature PRs, push-to-main + weekly cron
  for smoke).
- **Not a coverage-reduction contract.** The release-validation jobs are
  additive, not substitutive.
- **Not a release-velocity contract.** Release cadence is driven by
  Conventional Commits in `src/scripts/release.ts`, not by CI cost.
- **Not a Hard-Floor lift.** No security check is removed.
  `release-guard.yml`'s `assert-version-matches-tag` job is independent of
  `Tests` / `Public Install Smoke` and stays mandatory on every tag.

## See also

- `docs/contracts/branch-protection-policy.md` — per-PR-shape required-check
  matrix (Phase D).
- `docs/contracts/ci-cost-budget.md` — measured baselines + quarterly review
  cadence (Phase C).
- `.github/workflows/release-validation.yml` — the tight release-shape
  validation workflow (Phase B) + the `release-install-e2e` job.
- `tests/test_release_install_e2e.sh` — the packed-tarball install /
  upgrade / boot gate (`task release-install-e2e` to run locally).
- `src/scripts/check_release_pr_shape.ts` — the shape detector (Phase A).
- `src/scripts/release.ts` § `_RELEASE_BRANCH_RE` — source of truth for the
  release-branch naming convention.
- [`ADR-113`](../decisions/ADR-113-ci-native-release-label-trigger.md) — the
  CI-native (`release`-label) entry point into the same script.
- [`docs/distribution/consumer-matrix.md`](../distribution/consumer-matrix.md) —
  pack-based consumer E2E; the documented exemption from the cut surface.
- [`release-sizing.md`](release-sizing.md) — release safety floor: disable
  paths, `Rollback:` lines for new / reworked subsystems (gate:
  `src/scripts/lint_changelog_rollback.ts`), and the consumer-matrix floor.
- [`release-primary-goal.md`](release-primary-goal.md) — release scope floor:
  one primary goal per minor and the `Primary-Goal:` declaration. Split out of
  `release-sizing.md` on 2026-09-11 and still in beta; this document's
  release-shape detection is where a declaration check would bind.
