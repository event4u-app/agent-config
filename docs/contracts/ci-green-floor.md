---
stability: beta
keep-beta-until: 2026-08-26
roadmap_ref: road-to-adoption-proof-and-ci-green.md
---

# CI Green Floor

> **Status** · v0 / beta · 2026-05-26. Phase A Step 4 of
> [`road-to-adoption-proof-and-ci-green.md`](../../agents/roadmaps/road-to-adoption-proof-and-ci-green.md).
> Defines what counts as a **blocking** CI failure (must be green
> before merge) vs. an **advisory** signal (visible but not
> merge-blocking), and the freeze rule that fires when main goes
> red on a required check.

## The Iron Law

```
ANY REQUIRED-CHECK RED ON `main` FREEZES SUBSEQUENT PR MERGES
UNTIL THE RED IS CLEARED. ADVISORY REDS NEVER FREEZE.
PHANTOM 0-JOB RUNS ARE ADVISORY BY CONSTRUCTION.
```

The required-check set is the source of truth for what blocks. Every
other workflow is advisory until it earns inclusion.

## Three tiers — blocking · advisory · phantom

| Tier | Definition | Effect on merge | Effect on freeze |
|---|---|---|---|
| **Blocking** | Listed in [`branch-protection-policy.md`](branch-protection-policy.md) § Per-PR-shape required-check matrix for the current PR shape. | Red blocks the PR merge. | Red on `main` (post-merge) triggers a freeze tag — see [Freeze rule](#freeze-rule-the-mechanics). |
| **Advisory** | Workflow ships in `.github/workflows/` but is NOT listed in the required-check matrix (e.g. `bench-drift.yml`, `cloud-release.yml`, `deploy-mcp-worker.yml`). | Red is visible on the PR page but does not block merge. | Red on `main` does not freeze. |
| **Phantom** | Workflow registers a run with `Jobs: 0` and `Conclusion: failure` — typically `workflow_dispatch`-only workflows that GitHub's check-suite still registers on push. | Filtered out of every status query. | Never. |

`task ci:status` (Phase A Step 6) is the canonical filter: it
queries `gh run list`, drops Jobs-0 phantoms, then asserts the
required-check set has zero non-success conclusions for the
current HEAD SHA.

## Blocking set — anchored to `branch-protection-policy.md`

The blocking set is defined per PR shape (feature / release /
docs-only) in [`branch-protection-policy.md`](branch-protection-policy.md)
§ Per-PR-shape required-check matrix. The summary for `main`:

- **Feature PR set** — `Consistency`, `Smoke Contracts`, `Skill Lint`,
  `Tests` (every matrix entry), `Public Install Smoke`.
- **Release PR set** — `Consistency`, `Smoke Contracts`, three
  `Release Validation` jobs.
- **Docs-only PR set** — `Consistency`, `Smoke Contracts`.

`task ci:status` reads the same set when run with `--strict` (Phase
A Step 6); the set is single-sourced from `scripts/ci_status.py`.

## Advisory list — explicit non-blockers

These workflows MAY fail without blocking merges. Each carries a
documented rationale (link to the file header or roadmap step) so
"advisory" never silently expands.

| Workflow | Rationale | Promotion criterion |
|---|---|---|
| `bench-drift.yml` | Performance bench — informational only until the bench-stability roadmap completes. | Three consecutive green weekly runs after the bench is stabilised. |
| `cloud-release.yml` | Release artefact publish — Hard-Floor adjacent fix pending. See [`02-deployment-failures.md`](../../agents/evidence/audits/2026-05-ci-triage/02-deployment-failures.md) § Finding 1. | Maintainer ships the rate-limit fix; smoke probe stays green for two consecutive releases. |
| `deploy-mcp-worker.yml` | MCP worker deploy — auth contract regression pending. See [`02-deployment-failures.md`](../../agents/evidence/audits/2026-05-ci-triage/02-deployment-failures.md) § Finding 2. | Maintainer aligns the smoke probe with the Worker auth gate; passes for two consecutive deploys. |
| `sync-visibility.yml` | `workflow_dispatch`-only mutator. GitHub registers a phantom 0-job failure on every push to main — documented in the workflow header. **Phantom, not advisory** — `task ci:status` filters it. | n/a; the filter is the fix. |
| `check-visibility-drift.yml` | PR-paths + schedule + dispatch. Same GitHub Actions quirk produces phantom 0-job failures on push to main. **Phantom, not advisory.** | n/a; the filter is the fix. |

Adding a row here is a maintainer-level call: the rationale must
exist, and the promotion criterion must be writable.

## Phantom 0-job runs — the filter

A "phantom" run is one where:

1. The workflow registers a check-suite entry on the commit, AND
2. The run has `Jobs: 0` (no job actually executed), AND
3. The conclusion is `failure`.

This is a documented GitHub Actions quirk for `workflow_dispatch`-only
workflows and for path-filtered workflows whose paths do not match
the push diff. Removing the `push:` trigger does NOT eliminate the
phantom; the check-suite still registers.

`task ci:status` and `scripts/ci_status.py` drop any run with
`Jobs: 0` from the tally before computing pass/fail. The phantom
is visible in the GitHub UI but invisible to the gate.

## Freeze rule — the mechanics

When a commit lands on `main` and any required-check workflow turns
red within ~5 minutes (the standard required-check window):

1. The required-check status remains red on the merge commit.
2. Subsequent PRs targeting `main` see the same required-check set
   evaluated against the PR's head SHA. If the same workflow fails
   again on the PR head, the PR is blocked.
3. The maintainer either (a) reverts the offending commit, or (b)
   ships a fix-forward PR that turns the required check green. No
   PR merges meanwhile.

The freeze is therefore behavioural, not enforced via a separate
"freeze-mode" workflow — branch protection already does the
gating. `freeze-guard.yml` ([source](../../.github/workflows/freeze-guard.yml))
is a **different** mechanism: it locks the behavioural baseline of
the work-engine via golden-transcript diff, and is a required check
in the engine-path subset (not the universal floor). Both apply
together; the names don't conflict.

## What this contract is not

- **Not a list of "all green workflows".** Advisory and phantom
  reds are routine and do not constitute a violation.
- **Not a guarantee against false-greens.** A workflow that ran
  but tested nothing meaningful can still report success; the
  contract only governs how red signals are routed.
- **Not a license to add workflows to the blocking set silently.**
  Promotion to blocking is a `branch-protection-policy.md` edit
  with a written rationale and a maintainer review.

## Re-audit cadence

Re-audit on each of:

- A new workflow lands in `.github/workflows/`.
- A workflow is promoted from advisory to blocking (or vice versa)
  in `branch-protection-policy.md`.
- A new phantom-failure class is observed (e.g. GitHub Actions ships
  behaviour the filter doesn't catch).
- Quarterly review (Phase C of `road-to-ci-budget-and-cost.md` or
  its successor).

## See also

- [`branch-protection-policy.md`](branch-protection-policy.md) —
  the required-check matrix per PR shape.
- [`release-pr-gating.md`](release-pr-gating.md) — release-PR shape
  detection + cut surface.
- [`../../agents/evidence/audits/2026-05-ci-triage/01-red-workflows.md`](../../agents/evidence/audits/2026-05-ci-triage/01-red-workflows.md)
  — current red-workflow inventory.
- `AGENTS.md` § Emergency triage — root-of-repo pointer for agents.
