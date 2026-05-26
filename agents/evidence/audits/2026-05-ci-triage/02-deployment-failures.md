---
audit_date: 2026-05-26
roadmap_ref: road-to-adoption-proof-and-ci-green.md
phase: A
step: 3
hard_floor: deployment-behaviour
---

# 2026-05 CI Triage — deployment-side failures (Cloud Release + Deploy MCP Worker)

> Phase A Step 3 of `road-to-adoption-proof-and-ci-green.md`.
> Deployment-shaped failures. **Hard-Floor adjacent — no autonomous
> edits.** Maintainer decides which path to take. This document is
> the remediation menu, not the fix.

## Why this stays Hard-Floor

The `engineering-safety-floor` rule + `non-destructive-by-default`
Hard-Floor list together cover any change that "touches deploy
behaviour". Cloud Release and Deploy MCP Worker:

- Push artefacts to a public release surface (GitHub Release assets).
- Deploy code to a production runtime (Cloudflare Worker).
- Require secret rotation / token review for the rate-limit and
  401-auth fixes respectively.

Each of those is a maintainer-owned call. The agent's job is to
surface the finding and the menu; the maintainer picks.

## Finding 1 — Cloud Release secondary rate-limit

**Workflow:** `.github/workflows/cloud-release.yml`
**Last failure:** run `26400399520`, tag `v3.3.0`, 2026-05-25 12:41 UTC.
**Step:** `Attach artefacts to GitHub Release` (via
`softprops/action-gh-release@v2`).
**Error:** `##[error]You have exceeded a secondary rate limit. Please
wait a few minutes before you try again.` (request id `78A7:104E2D:…`).

### Pattern

The job uploads ~350 individual `<skill>.zip` artefacts to the
GitHub Release in a serial loop — each upload is one REST call.
GitHub's secondary rate-limit fires when the per-endpoint write
budget is exceeded, which 350 sequential `PATCH /releases/:id/assets`
calls reliably trip.

### Recent history

- `26400399520` (2026-05-25 12:25) — **failure** (rate-limit).
- `26393864384` (2026-05-25 09:37) — **success** (same workflow,
  caught the budget at a different time of day).
- `26365377397` (2026-05-24 15:33) — **success**.
- `26364232689` (2026-05-24 14:43) — **success**.
- `26209995988` (2026-05-21 06:42) — **success**.

Pattern is "transient when the budget allows, blocked when it
doesn't" — typical secondary-rate-limit shape.

### Remediation menu (maintainer picks)

1. **Batch upload (recommended).** Replace the 350-call upload loop
   with a single `cloud-bundles-<version>.tar.gz` archive upload —
   one API call. The `cloud-bundles-3.3.0.tar.gz` archive already
   exists (the log shows it uploaded successfully on every run),
   so this is a delete-the-loop change, not a new feature.
   - Trade-off: consumers downloading individual skill ZIPs lose
     that convenience; they pull the tarball and unzip locally.
2. **Retry with backoff.** Wrap each upload in a retry loop
   (`max_retries=5`, `backoff=10s · 30s · 60s · 120s · 300s`) so
   rate-limit hits self-heal. Doesn't reduce API calls; spreads
   them out so the budget refills mid-loop.
   - Trade-off: workflow runtime balloons from ~3 min to ~10+ min
     on rate-limit days.
3. **Migrate to GitHub release-asset upload via `actions/upload-artifact`
   + a separate "attach-to-release" worker.** Decouples build from
   publish; the worker can throttle to the GitHub API budget.
   - Trade-off: structural change; needs a maintainer ADR.

The agent recommends option 1 for the smallest diff. The maintainer
decides.

### Out of scope of this roadmap

This roadmap (`road-to-adoption-proof-and-ci-green.md`) **does not
land the fix**. It hands the maintainer this remediation menu and
the file pointer. The fix lives in a follow-up PR authored under
the engineering-safety-floor sign-off (deployment-behaviour change).

## Finding 2 — Deploy MCP Worker post-deploy smoke 5/5 HTTP 401

**Workflow:** `.github/workflows/deploy-mcp-worker.yml`
**Last failure:** run `26400399735`, tag `v3.3.0`, 2026-05-25
12:26 UTC.
**Step:** `Post-deploy smoke`.
**Error:** 5/5 probes (`initialize`, `ping`, `prompts/list`,
`resources/list`, `tools/list`) return HTTP 401 against
`https://agent-config-mcp.***.workers.dev`.

### Pattern

Persistent. Every release since 2026-05-17 fails this step. Not a
flake. The deployed Worker requires authentication that the smoke
probes do not carry.

### Recent history

| Run | Date | Conclusion |
|---|---|---|
| `26400399735` | 2026-05-25 12:26 | failure |
| `26365377441` | 2026-05-24 15:33 | failure |
| `26364232787` | 2026-05-24 14:43 | failure |
| `26209995990` | 2026-05-21 06:42 | failure |
| `26096151923` | 2026-05-19 12:08 | failure |
| `26016687421` | 2026-05-18 06:10 | failure |
| `25989952197` | 2026-05-17 11:47 | failure |
| `25984265630` | 2026-05-17 07:08 | failure |

8 consecutive release deploys broken. The Worker itself may still
be functioning (consumers can still hit it with the proper auth);
only the post-deploy smoke probe is broken — a regression in the
smoke-probe contract, not necessarily a Worker regression.

### Remediation menu (maintainer picks)

1. **Auth header in smoke probe (most likely).** The Worker likely
   added a bearer-token or origin-allow-list gate around 2026-05-17.
   Update the probe to send the matching header. Where the secret
   lives:
   - `MCP_WORKER_URL` is in the workflow env (visible in the log).
   - The matching token would need to be added as
     `MCP_SMOKE_TOKEN` in the `cloud` environment's secret store.
   - The probe code (`packages/cloud/telemetry-worker/scripts/smoke.py`
     or similar) reads it from env and includes it in the
     `Authorization: Bearer` header.
2. **Worker auth roll-back.** If the auth gate was added by mistake,
   roll the Worker back to the pre-2026-05-17 shape. Requires a
   read of the Worker source and a maintainer decision on whether
   the gate is intentional security or accidental over-scope.
3. **Disable the smoke step until the auth contract is decided.**
   Mark the step `continue-on-error: true` so the deploy job
   continues even when the probe fails. **Not recommended** —
   it hides regressions.

The agent recommends option 1 for the smallest diff. The maintainer
decides.

### Out of scope of this roadmap

Same as Finding 1. The fix is a deployment-behaviour change; the
maintainer authors it.

## Reference

- Phase A Step 1 inventory: [`01-red-workflows.md`](01-red-workflows.md).
- Engineering safety floor: `.augment/rules/non-destructive-by-default.md` +
  `.augment/rules/engineering-safety-floor.md`.
- Roadmap Step 3 (this step) explicitly stops autonomous edits at
  this line.
