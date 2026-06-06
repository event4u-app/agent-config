---
stability: beta
---

# Branch Protection Policy

> **Status:** active · **Owner:** maintainer (GitHub UI ruleset) ·
> **Opened:** 2026-05-26
>
> Codifies the per-PR-shape required-status-check floor. Companion to
> [`release-pr-gating.md`](release-pr-gating.md) (Phase A) and
> [`ci-cost-budget.md`](ci-cost-budget.md) (Phase C). Branch protection
> itself is applied by the maintainer in the GitHub Settings → Rules UI;
> this doc is the source of truth the UI mirrors.

## The floor

Every PR proves a floor of CI checks before it can merge. The floor differs
by **PR shape** — a feature PR proves more (it carries runtime / install
risk) than a release PR (whose diff is structurally limited to version
bumps). Shape is detected by the same predicates documented in
`release-pr-gating.md`; the workflows enforce the cut.

The optimisation is **never** subtractive: a PR whose shape can't be proved
falls back to the full feature-PR floor. The cut is opt-in per push, not
per branch name.

## Per-PR-shape required-check matrix

| Required check | Feature PR | Release PR | Docs-only PR |
|---|:---:|:---:|:---:|
| `Consistency` | ✅ | ✅ | ✅ |
| `Smoke Contracts` (smoke.yml) | ✅ | ✅ | ✅ |
| `Skill Lint` | ✅ | — | — |
| `Tests / install-tests (ubuntu)` | ✅ | — | — |
| `Tests / install-tests (macos)` | ✅ | — | — |
| `Tests / install-aux-tests (ubuntu)` | ✅ | — | — |
| `Tests / install-aux-tests (macos)` | ✅ | — | — |
| `Tests / python-tests (ubuntu × 3.10–3.13)` | ✅ | — | — |
| `Tests / python-tests (macos × 3.12)` | ✅ | — | — |
| `Tests / node-tests (ubuntu)` | ✅ | — | — |
| `Tests / node-tests (macos)` | ✅ | — | — |
| `Tests / windows-lockfile-export` | path-filter only | — | — |
| `Public Install Smoke / smoke (matrix)` | ✅ | — | — |
| `Release Validation / release-shape` | — | ✅ | — |
| `Release Validation / changelog-entry` | — | ✅ | — |
| `Release Validation / version-consistency` | — | ✅ | — |
| `Migration Dry-Run` | path-filter only | path-filter only | — |
| `Release Guard` (tag-trigger) | — | (post-merge tag) | — |

**Definitions:**

- **Feature PR** — head branch does not match `release/X.Y.Z` (the default).
- **Release PR** — head branch matches `^release/\d+\.\d+\.\d+$` AND the
  diff stays within the version-bump allowlist (see `release-pr-gating.md`).
  Either condition failing falls the PR back to feature-PR mode.
- **Docs-only PR** — diff is entirely inside `docs/**` or matches only
  top-level Markdown (`README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`,
  `AGENTS.md`). No code, tests, workflows, or scripts. This shape is
  detected by an opt-in linter (`task ci:required-checks`); branch
  protection still defaults to the feature-PR floor unless the linter
  asserts the docs-only shape.

## Failure mode — the cut never silently lifts

If a release-PR's diff exits the allowlist mid-stream (e.g. a last-minute
CHANGELOG fixup that also touches `scripts/release.py`):

1. `Release Validation / release-shape` exits non-zero.
2. The required-check set for the PR effectively flips back to the
   feature-PR floor because:
   - `tests.yml` / `smoke-public-install.yml` jobs carry
     `if: !startsWith(github.head_ref, 'release/')`, so they still skip on
     the branch name — but
   - the maintainer is expected to either narrow the diff (move the
     out-of-shape edit to a separate PR) or close-and-reopen the release
     PR off a freshly-bumped branch so the heavy matrix runs.
3. Branch protection still blocks the merge because `release-shape` is red.

The branch name alone never bypasses the heavy matrix — the diff has to
prove it can't regress runtime / install paths.

## Why path-filter only for some checks

`Tests / windows-lockfile-export` and `Migration Dry-Run` are path-filtered
at the workflow level (not branch-protection level). They run on every PR
whose diff hits their declared paths and skip on every other PR. Branch
protection lists them as "must pass if they run" — the GitHub Rules UI
under "Required status checks" honours this when "Require branches to be
up to date before merging" is enabled and the check's most recent run
on the head SHA is green.

## See also

- [`release-pr-gating.md`](release-pr-gating.md) — shape predicates, cut
  surface, kept surface, fail-closed contract.
- [`ci-cost-budget.md`](ci-cost-budget.md) — measured baseline durations
  per job + quarterly review cadence (Phase C).
- `.github/workflows/release-validation.yml` — the three release-PR jobs.
- `scripts/check_release_pr_shape.py` — the shape detector.
- `scripts/release.py` — emits release PRs; release cadence stays driven
  by Conventional Commits, not CI cost.
