---
audit_date: 2026-05-26
roadmap_ref: road-to-adoption-proof-and-ci-green.md
phase: A
step: 1
---

# 2026-05 CI Triage — four red workflows

> Phase A Step 1 of `road-to-adoption-proof-and-ci-green.md`. Categorises
> each of the four red workflows the 2026-05-25 review named, plus the
> two visibility workflows that still register phantom failures today.

## Inventory

`gh run list --limit 30` snapshot (2026-05-26, after the
`feat/frictionless-employee-workspace` merge to main):

| Workflow | Recent state | Class |
|---|---|---|
| `.github/workflows/sync-visibility.yml` | failure (every push to main) | **(b) flake / phantom run** |
| `.github/workflows/check-visibility-drift.yml` | failure (every push to main) | **(b) flake / phantom run** |
| `Cloud Release` (`cloud-release.yml`) | failure on 2026-05-25 tag push | **(c) infra outage** |
| `Deploy MCP Worker` (`deploy-mcp-worker.yml`) | failure on every release | **(c) infra outage** |

## Per-workflow finding

### sync-visibility.yml — phantom (b)

- **Trigger:** `workflow_dispatch` only. No `push:`, no `pull_request:`.
- **Symptom:** Every push to main registers a run with `Jobs: 0`,
  `Conclusion: failure`, empty logs.
- **Verification today:** `gh run view 26452580483 --json conclusion,jobs`
  → `Jobs: 0`, `failure`.
- **Root cause:** GitHub Actions check-suite registration for
  `workflow_dispatch`-only workflows. Documented in the workflow
  file header as "GitHub Actions anomaly… cannot be eliminated
  workflow-side". Confirmed.
- **Action:** No code change. The filter belongs in
  `task ci:status` (Phase A Step 6) — exclude 0-job runs from the
  required-check tally. Mitigation locked at the
  `ci-green-floor.md` contract (Phase A Step 4).

### check-visibility-drift.yml — phantom (b)

- **Trigger:** `pull_request:` (paths), `schedule: weekly`,
  `workflow_dispatch`. No `push:` trigger — parent Phase 0 Step 4
  removed it.
- **Symptom:** Every push to main still registers a 0-job failure.
- **Verification today:** `gh run view 26452579144 --json conclusion,jobs`
  → `Jobs: 0`, `failure`. Source confirmed: file header explicitly
  documents the phantom-failure quirk and the parent roadmap's
  fix-attempt.
- **Root cause:** Same as `sync-visibility.yml`. Removing `push:`
  did NOT eliminate the phantom — the GitHub check-suite registration
  fires anyway. Parent Phase 0 Step 4's claim of "fixed" was
  optimistic; the change is in place but the phantom persists.
- **Action:** No code change. Same filter belongs in
  `task ci:status`.

### Cloud Release — infra outage (c)

- **Workflow:** `cloud-release.yml`
- **Trigger:** Release tag push.
- **Last failure:** `26400399520` (2026-05-25 12:25 UTC) on tag
  `v3.3.0`.
- **Failure mode:** Final step `Attach artefacts to GitHub Release`
  → `##[error]You have exceeded a secondary rate limit. Please wait
  a few minutes before you try again.` GitHub API secondary
  rate-limit hit while uploading the cloud-bundle ZIPs (350+
  individual `softprops/action-gh-release@v2` calls in a single
  job).
- **Recent history:** Mixed. `26393864384` (2026-05-25 09:37) and
  `26365377397` (2026-05-24 15:33) succeeded with the same
  workflow shape; only the 12:25 run hit the rate limit. Transient.
- **Action — Hard-Floor adjacent.** Deployment behavior; the
  rate-limit fix is either (i) batched uploads (single
  `cloud-bundles-<version>.tar.gz` archive with all ZIPs inside —
  one API call instead of 350), or (ii) a retry-with-backoff on
  the upload step. Both touch the deploy pipeline. **Maintainer
  decision required.** Logged here so the next release-engineer
  rotation picks it up; see
  [`02-deployment-failures.md`](02-deployment-failures.md) for the
  remediation menu.

### Deploy MCP Worker — infra outage (c)

- **Workflow:** `deploy-mcp-worker.yml`
- **Trigger:** Release tag push (alongside Cloud Release).
- **Last failure:** `26400399735` (2026-05-25 12:26 UTC) on tag
  `v3.3.0`.
- **Failure mode:** `Post-deploy smoke` step — 5/5 probes
  (`initialize`, `ping`, `prompts/list`, `resources/list`,
  `tools/list`) all return HTTP 401 against the deployed worker
  URL `https://agent-config-mcp.***.workers.dev`.
- **Recent history:** Persistently failing — `26365377441`,
  `26364232787`, `26209995990`, `26096151923`, `26016687421`,
  `25989952197`, `25984265630` — every release back to 2026-05-17.
  Not a flake; a real regression on the deployed Worker auth surface.
- **Action — Hard-Floor adjacent.** The probes need to authenticate
  to the Worker; either (i) the Worker now requires a bearer token
  the probes don't carry, (ii) the secret `MCP_WORKER_URL` /
  `MCP_WORKER_TOKEN` rotation broke, or (iii) the Worker auth
  middleware was tightened and the smoke probe surface needs the
  matching header. **Maintainer decision required.** All three
  touch deployment-side auth; logged at
  [`02-deployment-failures.md`](02-deployment-failures.md).

## Summary

| Class | Count | Auto-fix? |
|---|---|---|
| (a) genuine bug | 0 | n/a |
| (b) flake / phantom run | 2 (visibility-pair) | No code change. Filter in `task ci:status` (Phase A Step 6). |
| (c) infra outage | 2 (Cloud Release · Deploy MCP Worker) | Hard-Floor adjacent — maintainer decides. |

## Next steps (this roadmap)

- **Phase A Step 2** — verify the visibility workflows in HEAD match
  the "no `push:` trigger" expectation. Document the persistent
  phantom and route the filter through Step 6.
- **Phase A Step 3** — file the deployment-side findings to
  `02-deployment-failures.md`. STOP autonomous edits there.
- **Phase A Step 4** — author `docs/contracts/ci-green-floor.md`
  with the "phantom 0-job runs are advisory, not blocking" rule.
- **Phase A Step 6** — build `task ci:status` to surface the
  required-check set with phantom-runs filtered.
