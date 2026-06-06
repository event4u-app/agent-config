---
stability: beta
---

# Release-PR Gating Contract

> **Status:** active · **Owner:** maintainer (`scripts/release.py`) · **Opened:** 2026-05-26
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
   `scripts/release.py` § `_RELEASE_BRANCH_RE`.
2. **Diff file set is a subset of the version-bump allowlist:**
   - `package.json`
   - `CHANGELOG.md`
   - `.claude-plugin/marketplace.json`
   - `packages/*/pack.yaml`
   - `packages/*/README.md`
   - `docs/archive/CHANGELOG-pre-*.md` — emitted by `scripts/release.py`'s
     automatic CHANGELOG era split (see `docs/contracts/CHANGELOG-conventions.md`
     § Era splits) when the current era crosses its line cap on an
     era-boundary release.

Both predicates are enforced by `scripts/check_release_pr_shape.py`
(stdlib-only, ≤ 150 LOC). The script exits 0 when both hold; non-zero with
a per-file diff naming any out-of-allowlist entry otherwise.

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

## Rollback trigger — fail-closed

The optimisation is **opt-in by shape, not by branch name**. A release-PR
whose diff contains a stray file outside the allowlist (e.g. a last-minute
CHANGELOG fixup that also touches `scripts/release.py`) trips the shape
detector:

1. `check_release_pr_shape.py` exits non-zero with a per-file diff.
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
  Conventional Commits in `scripts/release.py`, not by CI cost.
- **Not a Hard-Floor lift.** No security check is removed.
  `release-guard.yml`'s `assert-version-matches-tag` job is independent of
  `Tests` / `Public Install Smoke` and stays mandatory on every tag.

## See also

- `docs/contracts/branch-protection-policy.md` — per-PR-shape required-check
  matrix (Phase D).
- `docs/contracts/ci-cost-budget.md` — measured baselines + quarterly review
  cadence (Phase C).
- `.github/workflows/release-validation.yml` — the tight release-shape
  validation workflow (Phase B).
- `scripts/check_release_pr_shape.py` — the shape detector (Phase A).
- `scripts/release.py` § `_RELEASE_BRANCH_RE` — source of truth for the
  release-branch naming convention.
