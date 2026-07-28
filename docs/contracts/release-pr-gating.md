---
stability: beta
keep-beta-until: 2026-09-04
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
> Source: `road-to-optimized-ci-and-release-gates.md` Phase A Step 1. Measured
> baseline (`gh run list --branch main --limit 50`): `Public Install Smoke`
> avg **413 s** (3-OS × 2-Node matrix), `Tests` avg **218 s** (Linux + macOS
> + Windows). Both trigger on `package.json`. Release PRs (`release/X.Y.Z`)
> only touch `package.json`, `CHANGELOG.md`, `marketplace.json`,
> `packages/*/pack.yaml`, `packages/*/README.md`, and the CHANGELOG era
> archive `docs/archive/CHANGELOG-pre-*.md` — verified against PR #238
> (3.3.0). They cannot regress install or runtime behaviour by construction.

## Release-PR shape

A pull request qualifies as a **release PR** when **both** of the following
hold:

1. **Head branch matches** `^release/\d+\.\d+\.\d+$` — same regex as
   `src/scripts/release.ts` § `_RELEASE_BRANCH_RE`.
2. **Diff file set is a subset of the version-bump allowlist:**
   - `package.json`
   - `CHANGELOG.md`
   - `.claude-plugin/marketplace.json`
   - `packages/*/pack.yaml`
   - `packages/*/README.md`
   - `docs/archive/CHANGELOG-pre-*.md` — emitted by `release.ts`'s
     automatic CHANGELOG era split (see `docs/contracts/CHANGELOG-conventions.md`
     § Era splits) when the current era crosses its line cap on an
     era-boundary release.

Both predicates are enforced by `src/scripts/check_release_pr_shape.ts`.
The script exits 0 when both hold; non-zero with a per-file diff naming any
out-of-allowlist entry otherwise. It reads the diff shape only — it does
not check the PR author, so it passes identically for a `task
release`-opened PR and a `release.yml`-opened one.

## Cut surface — heavy jobs that skip on release PRs

Skipped via `if: !startsWith(github.head_ref, 'release/')` guards on the
heavy install/test jobs. These are the jobs that release PRs cannot regress
by construction (no install scripts, no runtime code, no test source in the
release-PR allowlist):

| Workflow | Job | Why it cuts |
|---|---|---|
| `tests.yml` | `install-tests` | release-PR diff has no `install.sh` / `scripts/install.py` / `tests/test_install.sh` |
| `tests.yml` | `install-aux-tests` | same — orchestrator, key contracts, one-liner smoke all untouched |
| `tests.yml` | `python-tests` | release-PR diff has no `scripts/**` or `tests/**` (other than CHANGELOG via path filter — see below) |
| `tests.yml` | `node-tests` | release-PR diff has no `src/**`, `tests/{cli,server,ui}/**`, `packages/core/installer/**` |
| `tests.yml` | `windows-lockfile-export` | release-PR diff has no `scripts/install_global*.py`, `scripts/cmd_export.py`, lockfile test surface |
| `smoke-public-install.yml` | `smoke` | release-PR diff has no `scripts/install*`, `setup.sh`, `templates/**`, `package.json` runtime behaviour |

`push:` to `main` and the weekly cron on `smoke-public-install.yml` stay
**unconditional** — those catch drift the PR matrix can't see.

## Kept surface — release PRs still prove these

The release-PR required-check floor stays equivalent (smaller, faster) to
the feature-PR floor by adding:

| Workflow | Job | Proves |
|---|---|---|
| `consistency.yml` | (existing) | `task consistency` — source-of-truth integrity |
| `smoke.yml` | `smoke-contracts` | Contract self-checks (kernel, router, hashes) |
| `release-guard.yml` | `assert-version-matches-tag` | already gates `npm publish`; remains tag-trigger |
| `migration-dry-run.yml` | (existing) | Migration plan dry-runs |
| `release-validation.yml` (Phase B) | `release-shape` | shape detector — fails closed if diff exits the allowlist |
| `release-validation.yml` (Phase B) | `changelog-entry` | CHANGELOG carries an entry matching the head-branch version |
| `release-validation.yml` (Phase B) | `version-consistency` | `package.json` / `marketplace.json` / pack manifests agree on the version |
| `consumer-matrix.yml` | `consumer-matrix` · `publish-dry-run` · `mcp-worker-dry-run` · `plugin-bootstrap` | pack-based consumer E2E + pre-tag dry-runs of the release-adjacent workflows — see the exemption note below |
| (maintainer-local) | `task smoke-host-loadability REQUIRE=1` | real-host loadability — `claude plugin validate` + temp-home plugin install + metadata cross-consistency (marketplace ↔ plugin dirs ↔ docs). Optional in CI (runners lack the claude CLI, the step self-skips); **required before a release is cut** — `REQUIRE=1` turns a missing CLI into a failure |

## Release install E2E — the packed artifact, not just the source diff

`release-validation.yml`'s fourth job, `release-install-e2e`
(`tests/test_release_install_e2e.sh`), closes a gap the cut surface above
does not cover: "release PRs cannot regress install or runtime behaviour"
is a claim about the **source diff**, not about whether the **packed
tarball** actually installs, upgrades, and boots as a real npm global
package. Every release PR now proves, against the real tarball:

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

The cut surface above rests on "release PRs cannot regress install or
runtime behaviour by construction". That argument covers the **source
diff** — it is blind to the **published tarball**. Every historical
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
- [`release-sizing.md`](release-sizing.md) — release scope floor: one primary
  goal per minor, `Rollback:` lines for new / reworked subsystems (gate:
  `src/scripts/lint_changelog_rollback.ts`).
