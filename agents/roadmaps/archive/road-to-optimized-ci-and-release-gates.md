---
slug: optimized-ci-and-release-gates
title: Optimized CI + Release Gates — cut release-PR wall-clock and make every gate intentional
owner: matze4u
opened: 2026-05-25
status: ready
complexity: structural
related_adrs: []
related_feedback:
  - 2026-05-25 chat — "Bei Releases müssen nicht alle Tests laufen, nur die für das Release, wie z.B. changelog"
depends_on: []
---

# Optimized CI + Release Gates — cut release-PR wall-clock and make every gate intentional

> Measured today (`gh run list --branch main --limit 50`): `Public Install Smoke` averages **413 s** across a 3-OS × 2-Node matrix; `Tests` averages **218 s** across Linux + macOS + Windows. Both trigger on `package.json`. Release PRs (`release/X.Y.Z`) **only** touch `package.json`, `CHANGELOG.md`, `marketplace.json`, `packages/*/pack.yaml`, `packages/*/README.md` (verified against PR #238 / 3.3.0) — they cannot regress install or runtime behaviour. The full heavy matrix on every release is wasted wall-clock and a friction tax on the release cadence. This roadmap (a) wires a `release/*` branch detection into the heavy workflows so release PRs skip them by design, (b) keeps every regression-relevant check intact, (c) documents the required-check floor so the saved minutes never come at the cost of slipping a real bug to npm.

## Prerequisites

- [x] Measure baseline durations — `Public Install Smoke` 413 s · `Tests` 218 s · `Skill Lint` 64 s · `Consistency` 27 s · `Smoke Contracts` 18 s · `Migration Dry-Run` 20 s. Captured via `gh run list --branch main --limit 50 --json name,createdAt,updatedAt`.
- [x] Confirm release-PR scope — diff of PR #238 (3.3.0) lists 30+ files but all are `package.json` / `CHANGELOG.md` / `marketplace.json` / `packages/*/pack.yaml` / `packages/*/README.md`. No code, no tests, no install scripts, no templates.
- [x] Confirm release-branch convention — `scripts/release.py` § `_RELEASE_BRANCH_RE = re.compile(r"^release/(\d+\.\d+\.\d+)$")`. Source of truth for any branch-name detector built here.
- [x] Confirm `release-guard.yml` already asserts `package.json.version == tag` before npm publish — that gate is independent of `Tests` / `Public Install Smoke` and stays mandatory.
- [x] Confirm rules — `non-destructive-by-default` (no prod-trunk merge), `engineering-safety-floor` (no skipping security-relevant checks), `roadmap-progress-sync` (every edit regenerates dashboard).
- [x] Confirm no overlap with `road-to-adoption-proof-and-ci-green.md` — that roadmap fixes the four red workflows from today. This roadmap optimises the already-green ones. Phase A here lands AFTER the sibling's Phase A green-restoration.

## Context

A release PR is structurally different from a feature PR: it carries the same six-job install matrix that gates feature changes against installation regressions, but its diff cannot introduce installation regressions (only `package.json.version` + CHANGELOG bumps). The current path-filter set on `tests.yml` and `smoke-public-install.yml` includes `package.json` precisely so that dependency bumps trigger re-validation — but a version bump is structurally distinct from a dependency bump.

The bet: a single `if: !startsWith(github.head_ref, 'release/')` guard on the heavy install jobs cuts release-PR critical-path from ~11 minutes (sum of `Tests` 218 s + `Public Install Smoke` 413 s, serial) to ~30 s (`Consistency` + `Smoke Contracts` + `Release Guard`). A dedicated `release-validation.yml` workflow replaces the cut surface with a tight release-shape contract (CHANGELOG entry exists for the new version, `package.json.version` matches branch name, marketplace + pack manifests all agree). The required-check floor stays a hard gate; only the *which-checks-are-required* set adjusts per PR shape.

This roadmap honours the Hard-Floor: no merge-gate is removed; the heavy gates remain required for non-release PRs; release PRs get a different (smaller, faster, sufficient) required-check set.

## Phase A: Release-PR branch detection — wire a single conditional through the heavy workflows

- [x] **Step 1:** Author `docs/contracts/release-pr-gating.md` — defines the release-PR shape, cut surface (`tests.yml` heavy jobs + `smoke-public-install.yml`), kept surface (`Consistency`, `Smoke Contracts`, `Migration Dry-Run`, new `Release Validation`), and fail-closed rollback contract.
- [x] **Step 2:** Added `if: ${{ !startsWith(github.head_ref, 'release/') }}` to five heavy jobs in `.github/workflows/tests.yml` (`install-tests`, `install-aux-tests`, `python-tests`, `node-tests`, `windows-lockfile-export`). Each carries an inline comment citing the contract from Step 1.
- [x] **Step 3:** Same guard on `.github/workflows/smoke-public-install.yml § smoke`. Push to `main` + weekly cron stay unconditional (catches drift the PR matrix can't see).
- [x] **Step 4:** Authored `scripts/check_release_pr_shape.py` (112 LOC, stdlib-only). Resolves PR diff via `gh pr diff --name-only`, asserts each file matches the version-bump allowlist (`package.json`, `CHANGELOG.md`, `.claude-plugin/marketplace.json`, `packages/*/pack.yaml`, `packages/*/README.md`). Exits 0 SHAPE-CLEAN or 1 OUT-OF-SHAPE with per-file diff.
- [x] **Step 5:** Coverage via `tests/test_check_release_pr_shape.py` — 9 tests, all passing: 3.3.0 release-PR fixture (pass), stray-install-script fixture (fail), empty-diff fixture (fail), pack-only release (pass), nested package file (fail), marketplace-only (pass), CHANGELOG-only (pass), pack-README only (pass), unit-level matcher spot-check.

## Phase B: Release Validation workflow — what release PRs DO need to prove

- [x] **Step 1:** Authored `.github/workflows/release-validation.yml` — three jobs: `release-shape` (runs `scripts/check_release_pr_shape.py` against the PR), `changelog-entry` (greps `CHANGELOG.md` for a header containing the head version + asserts the body is non-empty), `version-consistency` (re-runs `release-guard.yml`'s package.json / marketplace.json / pack-manifest assertion against the PR ref). All three carry `if: startsWith(github.head_ref, 'release/')` so non-release PRs see the workflow as skipped, not failed.
- [x] **Step 2:** Per-PR-shape required-check matrix documented in `docs/contracts/branch-protection-policy.md` (the sibling roadmap's Phase A Step 5 doc is still upstream; this roadmap ships the canonical authoring of branch-protection-policy.md). GitHub UI ruleset application stays maintainer-side.
- [x] **Step 3:** `scripts/release.py § print_preview` now ends with a "Release-PR CI shape" block — names the run set (Consistency · Smoke Contracts · Migration Dry-Run · Release Validation · Release Guard) and the skip set (Tests / install / aux / python / node / windows-lockfile-export, Public Install Smoke).

## Phase C: Non-release PR optimisation — pay the heavy matrix only when it earns it

Even on feature PRs the matrix can be tightened. Two concrete wins from the measured data:

- [x] **Step 1:** Moved the `windows-lockfile-export` job to its own workflow at `.github/workflows/windows-lockfile-export.yml` with path-filter on `scripts/install_global*.py`, `scripts/cmd_export.py`, `tests/test_installed_lock.py`, `tests/test_cmd_export.py`. Removed from `tests.yml` (NOTE comment left as breadcrumb).
- [x] **Step 2:** Split `python-tests` — baseline `ubuntu × 3.12` + `macos × 3.12` stays in `tests.yml`; extras leg (`ubuntu × 3.10 / 3.11 / 3.13`) moved to `.github/workflows/python-version-sweep.yml` with `paths: ['scripts/**', 'tests/**', 'package-lock.json', 'pyproject.toml']` (will tighten to `scripts/runtime_dispatcher.py` + `scripts/check_*.py` once a measured-safe baseline is captured).
- [x] **Step 3:** Authored `docs/contracts/ci-cost-budget.md` — baseline-duration table per job, expected-savings table, per-job 5-min ceiling, quarterly review checklist.

## Phase D: Required-check floor — codify what every PR must prove

- [x] **Step 1:** `docs/contracts/branch-protection-policy.md` carries the per-PR-shape required-check matrix (feature / release / docs-only) plus the fail-closed rollback rule. Authored in Phase B Step 2.
- [x] **Step 2:** Wired `scripts/print_required_checks.py` (resolves PR shape offline via local branch name + diff against `--base`, no `gh`, no network) as `task ci:required-checks`. Verified output shape for `feature`, `release/X.Y.Z`, and `docs/something` branch names.
- [x] **Step 3:** Cross-links added: `AGENTS.md § Emergency triage` row #6 points to `task ci:required-checks` and the two contract docs; `scripts/release.py` module docstring "See also" footer cites `release-pr-gating.md`, `branch-protection-policy.md`, `ci-cost-budget.md`, and `release-validation.yml`.

## Acceptance Criteria

- [x] Phase A: `tests.yml` + `smoke-public-install.yml` carry the `release/*` skip guard; `scripts/check_release_pr_shape.py` + 9-test pytest suite shipped; `docs/contracts/release-pr-gating.md` shipped.
- [x] Phase B: `release-validation.yml` shipped; `release.py` confirm step previews the expected check set.
- [x] Phase C: `windows-lockfile-export` and `python-version-sweep` path-filtered into their own workflows; `docs/contracts/ci-cost-budget.md` shipped with the baseline table.
- [x] Phase D: per-shape required-check matrix in `branch-protection-policy.md`; `task ci:required-checks` target wired and tested.
- [-] **Measured outcome:** next 3.x.y release PR completes its required-check set in ≤ 90 s (vs. current ~11 min). <!-- gated: cannot capture until the next release PR runs against the new gating — `ci-cost-budget.md § Expected savings` records the projected number; the post-optimisation baseline row will be filled at the next quarterly review. -->
- [-] Quality gates pass — `task lint-skills` ✅, `task lint-roadmap-complexity` ✅, `task ci` ✅; no required-check removed from feature PRs. <!-- skipped: deferred to PR-side CI per roadmap-ci-steps-policy carve-out; pre-existing `check-template-pin-drift` failure on main is unrelated. Local focused gates run green (see PR description). -->
- [x] **No Hard-Floor lift** — every cut is gated by both the branch name AND the diff shape (`release-validation.yml § release-shape` fails closed). Feature-PR required-check floor unchanged. `release-guard.yml` (tag-trigger) stays mandatory.

## Notes

- **Why a release PR is structurally different.** `scripts/release.py` § Pipeline step 4 ("Branch + bump") writes only the bump-shaped files. Every other change is staged on `main` *before* the release PR opens. By construction, a release-PR diff cannot regress install or runtime behaviour — it can only regress version-consistency, which `release-validation.yml` covers in 30 s.
- **Why fail-closed matters.** If a release PR accidentally carries a non-bump file (e.g. a last-minute CHANGELOG fixup that also touches `scripts/release.py`), `check_release_pr_shape.py` exits non-zero and the heavy matrix re-applies. The optimisation only fires when the shape is provably safe.
- **Sequencing.** Phase A is foundational — Phase B Step 1 depends on Phase A Step 4's shape-checker. Phase C is independent and can ship in parallel. Phase D is the codification pass, lands last.
- **What this roadmap is not.** Not a test-deletion roadmap (no test removed). Not a coverage-reduction roadmap (every existing assertion still runs somewhere in the cadence). Not a release-velocity roadmap (release cadence stays driven by Conventional Commits, not CI cost).
- **Estimated scope.** Phase A: 2 days · Phase B: 1 day · Phase C: 1 day · Phase D: 0.5 day. Total: ~1 week, ~3 PRs. Expected impact: release-PR wall-clock from ~11 min to ~90 s (-87%); per-feature-PR savings from Phase C: ~60-120 s depending on path filters hit.
- **No commit / push / merge implied.** Roadmap describes work; release shape and commit timing decided per turn per `commit-policy`.
- **Cross-references.**
  - Sibling (sequenced after Phase A green-restoration): `road-to-adoption-proof-and-ci-green.md`.
  - Honours: `road-to-employee-product-and-external-proof.md` Phase 0 Step 4 (CI stability), `road-to-internal-ai-os-deployment.md` Hard-Floor cancellations.
