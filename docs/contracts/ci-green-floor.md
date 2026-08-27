---
stability: beta
keep-beta-until: 2026-09-04
roadmap_ref: road-to-adoption-proof-and-ci-green.md
---

# CI Green Floor

> **Status** · v0 / beta · 2026-05-26. Phase A Step 4 of
> the `road-to-adoption-proof-and-ci-green` roadmap (archived).
> Defines what counts as a **blocking** CI failure (must be green
> before merge) vs. an **advisory** signal (visible but not
> merge-blocking), and the freeze rule that fires when main goes
> red on a required check.
>
> **Beta review, 2026-08-27 — extended to 2026-09-04, and the date is the
> anchor's, not a round number.** This contract's normative core is delegated:
> § Blocking set says the blocking set "is defined per PR shape … in
> `branch-protection-policy.md`". That file is itself `stability: beta` until
> **2026-09-04**, so promoting this one now would make a stable contract depend
> on a beta one. **What has to happen before promotion:** `branch-protection-policy.md`
> is promoted or its own window is resolved, and the two advisory rows below
> that carry pending maintainer work — `cloud-release.yml`'s rate-limit fix and
> `deploy-mcp-worker.yml`'s auth alignment, each with a stated promotion
> criterion — reach a recorded outcome, **and the resulting classification is
> written into this contract** rather than left implicit in CI history. That is
> a fact about the contract, measurable from CI, not a schedule.
>
> **Decided by AI council 2026-08-27, 2/2 convergent** (extend), under the
> maintainer's delegation of owner-reserved decisions for an autonomous drain
> run. One seat put the reason for extending most sharply: this contract's own
> text declares the partition *not final* and names the two pending migrations,
> so promoting it now would encode an explicitly unfinished state as
> authoritative. It also named this file's self-documenting incompleteness as
> the shape a genuinely-beta contract should have. **Revisit if** either
> workflow meets its stated criterion, or the maintainer formally rejects the
> proposed reclassification.

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

## Workflow convention — a `container:` job marks the workspace safe for git

```
A JOB WITH `container:` RUNS `git config --global --add safe.directory
"$GITHUB_WORKSPACE"` IMMEDIATELY AFTER `actions/checkout`, BEFORE ANY
STEP THAT CAN REACH GIT.
```

`actions/checkout` writes the workspace as the runner user; a
`container:` job then executes as a different UID inside the image.
Git refuses every command on a tree it does not own with
`fatal: detected dubious ownership in repository at '/__w/...'`, so
the job dies inside a step that has nothing to do with git — a lint
that shells out to `git diff`, a version probe, a submodule read. The
failure is a setup defect, not a quality signal, and it costs a full
round-trip to diagnose because the error names ownership rather than
the step's own subject.

Non-containerized jobs never hit this, which is why the class only
surfaces on the release-gated container jobs — the ones that run
least often. [`release-runbook.md`](../release-runbook.md) § 1
dispatches those against `main` before a cut for the same reason.

Reference implementation:
[`evaluator-umbrella.yml`](../../.github/workflows/evaluator-umbrella.yml)
— the only `container:` job in the tree today, and the one this
convention was written from
(`road-to-gates-that-can-fail` Phase 4).

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
gating. The **freeze-guard** is a different mechanism: it locks the
behavioural baseline of the work-engine via golden-transcript diff.
Both apply together; the names don't conflict.

**Corrected 2026-08-27:** this paragraph cited
`.github/workflows/freeze-guard.yml`, which **does not exist in the
tree** — a dead normative citation, found during the beta review. The
mechanism itself survives: the standalone workflow was folded into the
`golden-tests` job of [`tests.yml`](../../.github/workflows/tests.yml),
driven by `task golden-replay`. Nothing under `.github/workflows/`
mentions a golden-transcript diff by that name any more, so a reader
following the old link found nothing and could reasonably have concluded
the guard was gone.

## CI delta — what the local task runner cannot run

```
A LOCAL PASS FOLLOWED BY A REMOTE FAIL IS A DEFECT IN THIS DELTA LIST,
NOT IN THE REMOTE.
```

`task ci` is not a superset of what CI runs, and it never can be: some gates
need a token, a published tarball, a live PR, an OS this machine is not, or a
measurement that is timing-sensitive. Leaving that gap undocumented is what
turns "green locally" into a claim it cannot support.

**The list is `src/config/ci-local-parity.yml`, not this file.** Enumerating the
delta in prose beside a machine-readable manifest would create two sources that
drift, so this section names the manifest, its vocabulary, and the gate that
keeps it fresh — never a copy of its rows.

| Class | What it means | Examples |
|---|---|---|
| `network` | needs a token, a registry, or a live API | `adoption_snapshot`, `sync_github_metadata`, `rule_trigger_eval` |
| `release` | verifies tag / release / published-package / release-PR state | `check_release_surface_equality`, `check_release_highlights`, `check_finding_dispositions` |
| `artifact` | needs something only CI builds (site, tarball, bundle) | `check_site_links`, `pack_mcp_content` |
| `benchmark` | a measurement — timing-sensitive or paid | `bench_hook_latency`, `bench_drift_check` |
| `matrix` | needs an OS or Node version this machine is not | `consumer_matrix` |
| `resolver` | not a gate — a helper a workflow step calls; it decides and blocks nothing | `resolve_lint_scope` |

**Freshness is enforced, not asserted.** `check_ci_local_parity` walks both
directions — every gate a workflow reaches, and the transitive closure of the
`ci` / `consistency` task roots — and fails on any gate in one set and not the
other that the manifest does not declare, with a reason. A stale delta list is a
build failure.

The reverse direction (`local_only:`) is the more dangerous one and the manifest
says so out loud: a gate that only runs locally is the direction that lets real
defects merge. Prefer wiring it into a workflow over declaring it.

### The local-only backlog — decided 2026-08-13

**166 of 251 local gates have no remote reach, and that is an accepted standing
state with a shrink-only ratchet, not an open task.** (The two comparable pairs
are 167 of 250 before this change and 166 of 251 after it — the wiring moved both
terms, so a post-wiring numerator against a pre-wiring denominator, as this line
first read, is not a ratio of anything.) The number was 0 until the
same day, by construction: `check_ci_local_parity` built its CI-side set by
regexing raw workflow text for `task <name>`, and several workflow *comments*
contain the literal string `task ci` while stating that no workflow invokes it.
The prose documenting the gap was what suppressed the gate that would have
reported it.

**What was done instead of draining it.** The two gates that make the mechanism
observable at all were wired into `consistency.yml`, the only required status
check: `check_ci_local_parity` itself — which existed to report gates with no
remote reach and had none — and `check_gate_coverage`, which reads every other
gate's floor and was referenced by **nothing**, not even `task ci`, so its reds
were visible only to whoever ran the script by hand. Measured cost: 0.53 s for
the parity gate against ~225 s of headroom under the 5-minute per-job ceiling in
[`ci-cost-budget.md`](ci-cost-budget.md).

**Why the backlog is not drained — and the first version of this paragraph
priced it wrong by roughly 8×.** A 22-gate sample run individually found **3
already red** locally, i.e. ~14 %. Wiring **all 166** at that rate lands on the
order of **23 merge-blocking reds** on the first run of the only required check —
the "gate that lands as N instant blockers" shape this repository has refused
before, and the same reason the 166 were baselined rather than hard-failed.
Serial runtime is not the obstacle: sample mean 0.92 s, so all 166 is roughly
154 s.

The correction matters because it changes what was actually declined. The
original text attached the 23-red figure to the 23 gates that would have restored
the *old* floor, which is arithmetic nonsense — 23 gates at 14 % is ~3 reds, not
23. **A partial drain is therefore much cheaper than this paragraph first
implied**, and it stays on the table: wiring ten or twenty gates a change, each
red fixed as it appears, is a legitimate way to shrink the ratchet and is what
"lowering happens by wiring gates into workflows" already means. What is declined
here is the *sweep*, not the drain.

**What the standing answer buys, stated narrowly.** A *new* gate registered in
`task ci` with no workflow reds immediately, and the ratchet is now remotely
enforced rather than local-only. What it does not buy: any of the existing 166
running remotely. Draining happens the way this entry's own drain did — by wiring
a gate into a workflow, or by declaring it under `local_only:` with a structural
reason of the shape the two existing declarations establish (CI has no commit; CI
has no staged set), never by growing the declaration list to move a number.

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
