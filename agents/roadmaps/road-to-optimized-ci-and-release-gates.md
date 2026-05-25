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

- [ ] **Step 1:** Author `docs/contracts/release-pr-gating.md` — defines the release-PR shape (head branch matches `^release/\d+\.\d+\.\d+$`), the cut surface (which jobs skip), the kept surface (`Consistency`, `Smoke Contracts`, `Release Guard`, `Migration Dry-Run`, plus a new `Release Validation`), and the rollback trigger (any release PR whose diff *isn't* limited to the version-bump file set automatically loses the gating and runs the full matrix).
- [ ] **Step 2:** Add `if: !startsWith(github.head_ref, 'release/')` to the four heavy jobs in `.github/workflows/tests.yml` (`install-tests`, `install-aux-tests`, `python-tests`, `node-tests`, `windows-lockfile-export`). Document each guard inline with a one-paragraph comment citing the contract from Step 1.
- [ ] **Step 3:** Same guard on `.github/workflows/smoke-public-install.yml` § `smoke` job — release PRs cannot regress install (no install scripts touched). Push to `main` + the weekly cron stay unconditional (catches drift the PR matrix can't see).
- [ ] **Step 4:** Author `scripts/check_release_pr_shape.py` (≤ 150 LOC, stdlib-only) — given a PR number, fetches the file list via `gh pr diff <n> --name-only` and asserts every file matches the allowlist (`package.json`, `CHANGELOG.md`, `.claude-plugin/marketplace.json`, `packages/*/pack.yaml`, `packages/*/README.md`). Exits 0 if shape is clean, non-zero with a per-file diff if any unexpected file is present.
- [ ] **Step 5:** Coverage — pytest in `tests/test_check_release_pr_shape.py` against three fixtures: a real 3.3.0 release-PR diff (pass), a synthetic release-PR diff with a stray `scripts/install.py` change (fail with diagnostic), an empty diff (fail with diagnostic).

## Phase B: Release Validation workflow — what release PRs DO need to prove

- [ ] **Step 1:** Author `.github/workflows/release-validation.yml` — triggers on PRs whose head branch matches `release/*`. Three jobs, all under 60 s combined: (a) `release-shape` runs `scripts/check_release_pr_shape.py`; (b) `changelog-entry` greps `CHANGELOG.md` for a header matching the version on the head branch and asserts the body is non-empty; (c) `version-consistency` re-runs `release-guard.yml`'s assertion on the PR ref (not just the tag) so a release PR can never merge with mismatched `package.json` / `marketplace.json` / pack manifests.
- [ ] **Step 2:** Make `release-validation.yml` a required status check on the `release/*` PR path. Document the required-check set per PR shape in `docs/contracts/branch-protection-policy.md` (the doc sibling roadmap Phase A Step 5 ships; this roadmap extends it with the per-shape table).
- [ ] **Step 3:** Add `scripts/release.py` § `confirm` step a preview of which CI checks will run on the release PR (computed from the contract in Phase A Step 1). One-line summary at the bottom of the confirmation prompt: `Release PR will run: Consistency · Smoke Contracts · Release Guard · Migration Dry-Run · Release Validation (~30s total). Tests + Public Install Smoke skipped per release-pr-gating contract.`

## Phase C: Non-release PR optimisation — pay the heavy matrix only when it earns it

Even on feature PRs the matrix can be tightened. Two concrete wins from the measured data:

- [ ] **Step 1:** Move the `windows-lockfile-export` job from `tests.yml` (always-on per matrix) to a path-filtered trigger on `scripts/install_global*.py`, `scripts/cmd_export.py`, `tests/test_installed_lock.py`, `tests/test_cmd_export.py`. Today it runs on every PR touching `scripts/**`, including PRs that never go near install_global — measured contribution ~60-90 s per run on the Windows leg.
- [ ] **Step 2:** Split `python-tests` 4-version matrix (`3.10 · 3.11 · 3.12 · 3.13` on Linux + `3.12` on macOS) into a default `3.12 + macOS-3.12` always-on leg and a `3.10 · 3.11 · 3.13` extras leg gated by `paths: ['scripts/**', 'tests/**']` (drops to `paths: ['scripts/runtime_dispatcher.py', 'scripts/check_*.py']` once measured-safe). PRs that only touch UI / docs / marketplace skip the version-sweep but `3.12` still proves baseline behaviour.
- [ ] **Step 3:** Document each cut in `docs/contracts/ci-cost-budget.md` — table of (job, baseline duration, trigger surface, expected cost reduction per week assuming current PR cadence). Sets a quarterly review cadence: any job exceeding 5 min average wall-clock requires a documented justification or a follow-up optimisation step.

## Phase D: Required-check floor — codify what every PR must prove

- [ ] **Step 1:** Extend `docs/contracts/branch-protection-policy.md` (sibling roadmap Phase A Step 5) with a per-PR-shape required-check matrix: `feature PR` requires `Tests`, `Public Install Smoke`, `Consistency`, `Smoke Contracts`, `Skill Lint`; `release PR` requires `Consistency`, `Smoke Contracts`, `Release Guard`, `Release Validation`, `Migration Dry-Run`; `docs-only PR` (diff scope: `docs/**` + `README.md` only) requires `Consistency` + `Smoke Contracts`. Each shape carries the rollback rule: if the shape detector mis-classifies, the full feature-PR set re-applies.
- [ ] **Step 2:** Wire `scripts/check_release_pr_shape.py` as a `task ci:required-checks` target that prints the expected required-check set for the current branch. Maintainer can sanity-check locally before pushing.
- [ ] **Step 3:** Cross-link the contract from `AGENTS.md` § Emergency triage and from `scripts/release.py` docstring header (where the release flow is documented).

## Acceptance Criteria

- [ ] Phase A: `tests.yml` + `smoke-public-install.yml` carry the `release/*` skip guard; `scripts/check_release_pr_shape.py` + tests shipped; `docs/contracts/release-pr-gating.md` shipped.
- [ ] Phase B: `release-validation.yml` shipped, < 60 s wall-clock on a clean release PR; `release.py` confirm step previews the expected check set.
- [ ] Phase C: `windows-lockfile-export` path-filtered; `python-tests` extras leg path-filtered; `docs/contracts/ci-cost-budget.md` shipped with current baseline table.
- [ ] Phase D: per-shape required-check matrix in `branch-protection-policy.md`; `task ci:required-checks` target wired.
- [ ] **Measured outcome:** next 3.x.y release PR completes its required-check set in ≤ 90 s (vs. current ~11 min). Captured in `docs/contracts/ci-cost-budget.md` § post-optimisation baseline.
- [ ] Quality gates pass — `task lint-skills` ✅, `task lint-roadmap-complexity` ✅, `task ci` ✅; no required-check removed from feature PRs.
- [ ] **No Hard-Floor lift** — no security check removed; release-validation is additive, not substitutive; the shape detector fails-closed (falls back to full matrix on any deviation).

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
